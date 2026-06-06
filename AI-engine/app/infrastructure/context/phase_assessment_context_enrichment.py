"""
Merge DB-backed context into orchestration ``variables`` for a phase + assessment.

- Reads ``ai_interaction.loop_input`` (catalog template / hints) for the interaction id.
- Optionally loads SmartWealth ``case`` + ``client`` when ``case_id`` is a UUID.

Catalog rows are not mutated; values are copied into runtime variables only.
"""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.errors import UndefinedTable
from psycopg.rows import dict_row


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def enrich_assessment_variables_from_db(
    conn: Connection,
    *,
    case_id: str,
    phase_code: str,
    assessment_code: str,
) -> dict[str, str]:
    """
    Build string-valued variable overlays for ``ContextDataRepository.get_variables``.

    Keys are stable and safe for prompt / resolver consumption:
    - ``catalog_loop_input_json``: full ``loop_input`` JSON from ``ai_interaction`` (may be ``{}``).
    - ``wealth_case_context_json``: case + client summary when tables and id exist.
    """
    out: dict[str, str] = {}
    loop = _fetch_loop_input(conn, interaction_id=assessment_code.strip(), phase_code=phase_code.strip())
    out["catalog_loop_input_json"] = _json_dumps(loop)

    summary = _fetch_wealth_case_summary(conn, case_id=case_id.strip())
    if summary is not None:
        out["wealth_case_context_json"] = _json_dumps(summary)

    return out


def _fetch_loop_input(conn: Connection, *, interaction_id: str, phase_code: str) -> dict[str, Any]:
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT loop_input
                FROM ai_interaction
                WHERE interaction_id = %s
                  AND phase_code = %s
                LIMIT 1
                """,
                (interaction_id, phase_code.upper()),
            )
            row = cur.fetchone()
            if row is None or row[0] is None:
                return {}
            raw = row[0]
            if isinstance(raw, dict):
                return dict(raw)
            if isinstance(raw, str):
                try:
                    parsed = json.loads(raw)
                    return dict(parsed) if isinstance(parsed, dict) else {}
                except json.JSONDecodeError:
                    return {}
            return {}
    except (UndefinedTable, OSError):
        return {}


def _fetch_wealth_case_summary(conn: Connection, *, case_id: str) -> dict[str, Any] | None:
    try:
        cid = UUID(case_id.strip())
    except ValueError:
        return None
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT
                    c.id::text AS case_id,
                    c.phase AS case_phase,
                    c.status AS case_status,
                    c.type AS case_type,
                    cl.id::text AS client_id,
                    cl.name AS client_name,
                    cl.residency AS client_residency,
                    cl.risk_profile AS client_risk_profile,
                    cl.status AS client_status
                FROM "case" c
                INNER JOIN client cl ON cl.id = c.client_id
                WHERE c.id = %s
                LIMIT 1
                """,
                (cid,),
            )
            row = cur.fetchone()
            if row is None:
                return None
            return dict(row)
    except (UndefinedTable, OSError):
        return None


def merge_string_dicts(base: dict[str, str], overlay: dict[str, str]) -> dict[str, str]:
    merged = dict(base)
    merged.update(overlay)
    return merged
