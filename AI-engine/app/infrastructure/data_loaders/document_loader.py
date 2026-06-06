"""Loader for case-scoped documents (``case_document`` + ``document``)."""

from __future__ import annotations

from typing import Any

from psycopg import Connection
from psycopg.errors import UndefinedTable
from psycopg.rows import dict_row

from app.infrastructure.data_loaders.registry import DataLoader

_ALWAYS_REQUIRED_DOC_KINDS: tuple[str, ...] = ()

_ALL_KNOWN_DOC_KINDS: tuple[str, ...] = (
    "TRUST_DEED",
    "BENEFICIARY_SUPPORT",
    "GUARDIAN_SUPPORT",
)

_VERIFIED_STATUS = "VERIFIED"


def select_case_documents(conn: Connection, case_id: str) -> list[dict[str, Any]]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                cd.id::text AS case_document_id,
                cd.doc_kind,
                cd.status,
                cd.phase_code,
                cd.notes,
                cd.created_at AS linked_at,
                d.id::text AS document_id,
                d.storage_key,
                d.original_filename,
                d.content_type,
                d.byte_size
            FROM case_document cd
            INNER JOIN document d ON d.id = cd.document_id
            WHERE cd.case_id = %s::uuid
            ORDER BY cd.doc_kind ASC, cd.created_at DESC
            """,
            (case_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def compute_expected_doc_kinds(household: dict[str, Any] | None) -> list[str]:
    required = list(_ALWAYS_REQUIRED_DOC_KINDS)
    if household is None:
        return required
    if household.get("trust_structure_indicated") or household.get("trust_indicated"):
        required.append("TRUST_DEED")
    dependents = household.get("dependents_count") or 0
    beneficiary_done = household.get("beneficiary_profile_completed") or household.get(
        "beneficiary_information_completed"
    )
    if dependents > 0 or household.get("guardian_notes"):
        required.append("GUARDIAN_SUPPORT")
    if (dependents > 0 or household.get("spouse_present")) and not beneficiary_done:
        required.append("BENEFICIARY_SUPPORT")
    return required


def documents_by_kind(
    rows: list[dict[str, Any]],
    *,
    scoped_to_case: bool,
    household: dict[str, Any] | None = None,
) -> dict[str, Any]:
    by_kind: dict[str, dict[str, Any]] = {}
    for r in rows:
        k = str(r.get("doc_kind") or "")
        if not k or k in by_kind:
            continue
        row_status = str(r.get("status") or "PENDING").upper()
        by_kind[k] = {
            "status": row_status,
            "file_ref": r.get("storage_key"),
            "notes": r.get("notes"),
            "document_id": r.get("document_id"),
            "case_document_id": r.get("case_document_id"),
            "phase_code": r.get("phase_code"),
            "original_filename": r.get("original_filename"),
        }
    expected = compute_expected_doc_kinds(household)
    verified_kinds = {k for k, v in by_kind.items() if v.get("status") == _VERIFIED_STATUS}
    missing = [k for k in expected if k not in verified_kinds]
    pending = [k for k in expected if k in by_kind and by_kind[k].get("status") == "PENDING"]
    rejected = [k for k in expected if k in by_kind and by_kind[k].get("status") == "REJECTED"]
    out: dict[str, Any] = {
        "by_kind": by_kind,
        "expected_kinds": expected,
        "all_known_kinds": list(_ALL_KNOWN_DOC_KINDS),
    }
    if missing:
        out["missing_kinds_in_db"] = missing
    if pending:
        out["pending_review_kinds"] = pending
    if rejected:
        out["rejected_kinds"] = rejected
    if not scoped_to_case:
        out["case_document_scope_note"] = (
            "Provide case_id in tool input to load documents for that case via case_document "
            "→ document (client_id-only queries intentionally omit case-scoped files)."
        )
    return out


class DocumentLoader(DataLoader):
    """Requires ``case_id`` for scoped document loading; returns summary when absent."""

    @property
    def section_id(self) -> str:
        return "documents"

    def load(
        self,
        conn: Connection,
        *,
        client_id: str,
        case_id: str | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if not case_id:
            return documents_by_kind([], scoped_to_case=False)
        try:
            rows = select_case_documents(conn, case_id)
        except UndefinedTable:
            rows = []
        from app.infrastructure.data_loaders.household_loader import select_household

        try:
            household = select_household(conn, client_id)
        except (UndefinedTable, Exception):
            household = None
        return documents_by_kind(rows, scoped_to_case=True, household=household)
