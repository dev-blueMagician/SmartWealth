"""Loader for ``client_household`` (related parties, trust structure)."""

from __future__ import annotations

from typing import Any

from psycopg import Connection
from psycopg.errors import UndefinedTable
from psycopg.rows import dict_row

from app.infrastructure.data_loaders.registry import DataLoader


def select_household(conn: Connection, client_id: str) -> dict[str, Any] | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT spouse_present, dependents_count, beneficiary_profile_completed,
                   guardian_notes, trustee_notes, trust_structure_indicated
            FROM client_household
            WHERE client_id = %s::uuid
            LIMIT 1
            """,
            (client_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


_MISSING_HOUSEHOLD: dict[str, Any] = {
    "spouse_present": None,
    "dependents_count": None,
    "beneficiary_information_completed": None,
    "guardian_notes": None,
    "trustee_notes": None,
    "trust_indicated": None,
    "note": "client_household row missing or table absent",
}


class HouseholdLoader(DataLoader):

    @property
    def section_id(self) -> str:
        return "household"

    def load(
        self,
        conn: Connection,
        *,
        client_id: str,
        case_id: str | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        try:
            row = select_household(conn, client_id)
        except UndefinedTable:
            return dict(_MISSING_HOUSEHOLD)
        if row is None:
            return dict(_MISSING_HOUSEHOLD)
        return {
            "spouse_present": row.get("spouse_present"),
            "dependents_count": row.get("dependents_count"),
            "beneficiary_information_completed": row.get("beneficiary_profile_completed"),
            "guardian_notes": row.get("guardian_notes"),
            "trustee_notes": row.get("trustee_notes"),
            "trust_indicated": row.get("trust_structure_indicated"),
        }
