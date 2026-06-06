from __future__ import annotations

from datetime import date
from typing import Any

from psycopg import Connection
from psycopg.errors import UndefinedColumn, UndefinedTable
from psycopg.rows import dict_row

from app.domain.smartwealth.interfaces import ReadOnlyDataTool
from app.infrastructure.config.settings import Settings
from app.infrastructure.data_loaders.case_resolver import norm_uuid_str, select_case_client
from app.infrastructure.data_loaders.registry import LoaderRegistry, default_loader_registry


class ClientProfileSqlTool(ReadOnlyDataTool):
    """
    Read-only SELECT of client data using the **Loader registry**.

    Which data sections are fetched is determined by ``tool_input["sections"]``.
    When omitted the tool falls back to the legacy set (identity, household, documents)
    so that existing ONBOARDING catalog entries keep working unchanged.

    Also exposes ``apply_profile_patch`` for controlled onboarding writes (used by
    ``client_profile_chat_patch_tool`` in the catalog assessment executor).

    Expects tool_input::

        {
            "case_id": "<uuid str optional>",
            "client_id": "<uuid str optional>",
            "sections": ["identity", "household", "documents", "assets", "goals"]  # optional
        }
    """

    def __init__(self, registry: LoaderRegistry | None = None) -> None:
        self._registry = registry or default_loader_registry()

    @property
    def tool_id(self) -> str:
        return "client_profile_sql_tool"

    def fetch(self, query: dict[str, Any]) -> dict[str, Any]:
        case_id = norm_uuid_str(query.get("case_id"))
        client_id = norm_uuid_str(query.get("client_id"))
        if not case_id and not client_id:
            return {
                "profile_snapshot": None,
                "error": "client_profile_sql_tool requires non-empty case_id or client_id",
            }

        sections = query.get("sections")

        try:
            settings = Settings()
            conninfo = settings.resolved_database_url
        except Exception as exc:
            return {"profile_snapshot": None, "error": f"settings: {exc}"}

        try:
            import psycopg

            with psycopg.connect(conninfo) as conn:
                return self._fetch_via_registry(
                    conn,
                    case_id=case_id,
                    client_id=client_id,
                    sections=sections,
                )
        except OSError as exc:
            return {"profile_snapshot": None, "error": f"database: {exc}"}

    def apply_profile_patch(
        self,
        *,
        case_id: str,
        client_id: str | None,
        patch: dict[str, Any],
        household_patch: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Persist allowed onboarding updates to ``client`` / ``client_household``.

        Not part of the ``ReadOnlyDataTool`` port; used by chat profile-capture flow and tests.
        """
        return apply_profile_patch_to_db(
            case_id=case_id,
            client_id=client_id,
            patch=patch,
            household_patch=household_patch,
        )

    def _fetch_via_registry(
        self,
        conn: Connection,
        *,
        case_id: str | None,
        client_id: str | None,
        sections: list[str] | None,
    ) -> dict[str, Any]:
        resolved_client = client_id
        case_row: dict[str, Any] | None = None

        try:
            if not resolved_client and case_id:
                case_row = select_case_client(conn, case_id)
                if case_row is None:
                    return {"profile_snapshot": None, "error": f"case not found: {case_id}"}
                resolved_client = str(case_row["client_id"])

            if not resolved_client:
                return {"profile_snapshot": None, "error": "could not resolve client_id"}

            loaded = self._registry.load(
                conn,
                client_id=resolved_client,
                case_id=case_id,
                sections=sections,
            )

            snapshot: dict[str, Any] = {
                "case_id": case_id,
                "case_type": case_row.get("type") if case_row else None,
                "case_status": case_row.get("status") if case_row else None,
                "case_phase": case_row.get("phase") if case_row else None,
            }

            section_key_map = {
                "identity": "identity_demographics",
                "household": "household_related_parties",
            }
            for key, value in loaded.items():
                snapshot_key = section_key_map.get(key, key)
                snapshot[snapshot_key] = value

            return {"profile_snapshot": snapshot, "error": None}

        except (UndefinedTable, UndefinedColumn) as exc:
            return {
                "profile_snapshot": None,
                "error": (
                    "schema_mismatch: apply backend Flyway through "
                    "V7__document_and_case_document.sql (and V6 onboarding) or run "
                    "AI-engine scripts/sql/migrate_client_profile_onboarding.sql: "
                    f"{exc}"
                ),
            }


# ---------------------------------------------------------------------------
# Write helpers (kept in this module for backward compatibility)
# ---------------------------------------------------------------------------


def apply_profile_patch_to_db(
    *,
    case_id: str,
    client_id: str | None,
    patch: dict[str, Any],
    household_patch: dict[str, Any],
) -> dict[str, Any]:
    """
    Apply allowed updates to ``client`` / ``client_household`` for onboarding profile capture.

    ``patch`` keys (subset): full_name, date_of_birth, marital_status, nationality, primary_phone,
    primary_email, contact_address, residency, risk_profile, status.

    ``household_patch`` keys (subset): spouse_present, dependents_count, beneficiary_profile_completed,
    guardian_notes, trustee_notes, trust_structure_indicated.
    """
    cid = norm_uuid_str(client_id)
    c_case = norm_uuid_str(case_id)
    if not c_case and not cid:
        return {"applied": False, "error": "case_id or client_id is required", "resolved_client_id": None}

    norm_patch = _normalize_client_patch(patch)
    norm_hh = _normalize_household_patch(household_patch)
    if not norm_patch and not norm_hh:
        return {"applied": False, "error": None, "resolved_client_id": cid, "updated_columns": []}

    try:
        settings = Settings()
        conninfo = settings.resolved_database_url
    except Exception as exc:
        return {"applied": False, "error": f"settings: {exc}", "resolved_client_id": cid}

    try:
        import psycopg

        with psycopg.connect(conninfo) as conn:
            resolved = cid
            if not resolved and c_case:
                row = select_case_client(conn, c_case)
                if row is None:
                    return {"applied": False, "error": f"case not found: {c_case}", "resolved_client_id": None}
                resolved = str(row["client_id"])
            if not resolved:
                return {"applied": False, "error": "could not resolve client_id", "resolved_client_id": None}

            updated: list[str] = []
            if norm_patch:
                cols = _execute_client_update(conn, resolved, norm_patch)
                updated.extend(cols)
            if norm_hh:
                try:
                    _upsert_household_row(conn, resolved, norm_hh)
                    updated.append("client_household")
                except UndefinedTable as exc:
                    return {
                        "applied": bool(updated),
                        "error": f"client_household table missing: {exc}",
                        "resolved_client_id": resolved,
                        "updated_columns": updated,
                    }

            return {
                "applied": True,
                "error": None,
                "resolved_client_id": resolved,
                "updated_columns": updated,
            }
    except (OSError, UndefinedTable, UndefinedColumn) as exc:
        return {"applied": False, "error": str(exc), "resolved_client_id": cid}


def _normalize_client_patch(patch: dict[str, Any]) -> dict[str, Any]:
    allowed_in = {
        "full_name",
        "date_of_birth",
        "marital_status",
        "nationality",
        "primary_phone",
        "primary_email",
        "contact_address",
        "residency",
        "risk_profile",
        "status",
    }
    out: dict[str, Any] = {}
    for k, v in patch.items():
        if k not in allowed_in or v is None:
            continue
        if isinstance(v, str) and not v.strip() and k != "contact_address":
            continue
        if k == "date_of_birth":
            parsed = _parse_date_only(v)
            if parsed is None:
                continue
            out["date_of_birth"] = parsed
            continue
        if isinstance(v, str):
            out[k] = v.strip() if v.strip() else None
            if out[k] is None and k != "contact_address":
                out.pop(k, None)
        else:
            out[k] = v
    return {k: v for k, v in out.items() if v is not None or k == "contact_address"}


def _normalize_household_patch(hp: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    if "spouse_present" in hp and hp["spouse_present"] is not None:
        out["spouse_present"] = bool(hp["spouse_present"])
    if "dependents_count" in hp and hp["dependents_count"] is not None:
        try:
            n = int(hp["dependents_count"])
            if n >= 0:
                out["dependents_count"] = n
        except (TypeError, ValueError):
            pass
    if "beneficiary_profile_completed" in hp and hp["beneficiary_profile_completed"] is not None:
        out["beneficiary_profile_completed"] = bool(hp["beneficiary_profile_completed"])
    for key in ("guardian_notes", "trustee_notes"):
        if key in hp and hp[key] is not None and isinstance(hp[key], str):
            out[key] = hp[key].strip()
    if "trust_structure_indicated" in hp and hp["trust_structure_indicated"] is not None:
        out["trust_structure_indicated"] = bool(hp["trust_structure_indicated"])
    return out


def _parse_date_only(value: object) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    s = str(value).strip()[:10]
    if not s:
        return None
    try:
        parts = s.split("-")
        if len(parts) != 3:
            return None
        y, mo, d = int(parts[0]), int(parts[1]), int(parts[2])
        return date(y, mo, d)
    except (ValueError, TypeError):
        return None


def _execute_client_update(conn: Connection, client_id: str, patch: dict[str, Any]) -> list[str]:
    col_map = {
        "full_name": "name",
        "date_of_birth": "date_of_birth",
        "marital_status": "marital_status",
        "nationality": "nationality",
        "primary_phone": "primary_phone",
        "primary_email": "primary_email",
        "contact_address": "contact_address",
        "residency": "residency",
        "risk_profile": "risk_profile",
        "status": "status",
    }
    sets: list[str] = []
    params: list[Any] = []
    updated_labels: list[str] = []
    for api_key, col in col_map.items():
        if api_key not in patch:
            continue
        val = patch[api_key]
        sets.append(f"{col} = %s")
        params.append(val)
        updated_labels.append(col)
    if not sets:
        return []
    params.append(client_id)
    sql = f'UPDATE client SET {", ".join(sets)} WHERE id = %s::uuid'
    with conn.cursor() as cur:
        cur.execute(sql, params)
    return updated_labels


def _upsert_household_row(conn: Connection, client_id: str, hp: dict[str, Any]) -> None:
    defaults = {
        "spouse_present": False,
        "dependents_count": 0,
        "beneficiary_profile_completed": False,
        "guardian_notes": None,
        "trustee_notes": None,
        "trust_structure_indicated": False,
    }
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM client_household WHERE client_id = %s::uuid LIMIT 1",
            (client_id,),
        )
        row = cur.fetchone()
    merged = dict(defaults)
    if row:
        merged.update({k: row.get(k) for k in defaults})
    merged.update(hp)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO client_household (
                client_id, spouse_present, dependents_count, beneficiary_profile_completed,
                guardian_notes, trustee_notes, trust_structure_indicated, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (client_id) DO UPDATE SET
                spouse_present = EXCLUDED.spouse_present,
                dependents_count = EXCLUDED.dependents_count,
                beneficiary_profile_completed = EXCLUDED.beneficiary_profile_completed,
                guardian_notes = EXCLUDED.guardian_notes,
                trustee_notes = EXCLUDED.trustee_notes,
                trust_structure_indicated = EXCLUDED.trust_structure_indicated,
                updated_at = now()
            """,
            (
                client_id,
                merged["spouse_present"],
                merged["dependents_count"],
                merged["beneficiary_profile_completed"],
                merged.get("guardian_notes"),
                merged.get("trustee_notes"),
                merged["trust_structure_indicated"],
            ),
        )
