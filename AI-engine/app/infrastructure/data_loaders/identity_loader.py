"""Loader for client identity / demographics from the ``client`` table."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

from app.infrastructure.data_loaders.registry import DataLoader


@dataclass(slots=True)
class ClientRow:
    client_id: str
    full_name: str | None
    date_of_birth: date | None
    marital_status: str | None
    residency: str | None
    nationality: str | None
    primary_phone: str | None
    primary_email: str | None
    contact_address: str | None
    risk_profile: str | None
    status: str | None


def age_from_dob(dob: date | None) -> int | None:
    if dob is None:
        return None
    today = datetime.now(timezone.utc).date()
    years = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return max(0, years)


def select_client_extended(conn: Connection, client_id: str) -> ClientRow | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                cl.id::text AS client_id,
                cl.name AS full_name,
                cl.date_of_birth,
                cl.marital_status,
                cl.residency,
                cl.nationality,
                cl.primary_phone,
                cl.primary_email,
                cl.contact_address,
                cl.risk_profile,
                cl.status
            FROM client cl
            WHERE cl.id = %s::uuid
            LIMIT 1
            """,
            (client_id,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        return ClientRow(
            client_id=str(row["client_id"]),
            full_name=row.get("full_name"),
            date_of_birth=row.get("date_of_birth"),
            marital_status=row.get("marital_status"),
            residency=row.get("residency"),
            nationality=row.get("nationality"),
            primary_phone=row.get("primary_phone"),
            primary_email=row.get("primary_email"),
            contact_address=row.get("contact_address"),
            risk_profile=row.get("risk_profile"),
            status=row.get("status"),
        )


class IdentityLoader(DataLoader):

    @property
    def section_id(self) -> str:
        return "identity"

    def load(
        self,
        conn: Connection,
        *,
        client_id: str,
        case_id: str | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        client = select_client_extended(conn, client_id)
        if client is None:
            return None
        return {
            "client_id": client.client_id,
            "full_name": client.full_name,
            "date_of_birth": client.date_of_birth.isoformat() if client.date_of_birth else None,
            "age": age_from_dob(client.date_of_birth),
            "marital_status": client.marital_status,
            "residency": client.residency,
            "nationality": client.nationality,
            "contact": {
                "primary_phone": client.primary_phone,
                "primary_email": client.primary_email,
                "address": client.contact_address,
            },
            "risk_profile": client.risk_profile,
            "client_status": client.status,
        }
