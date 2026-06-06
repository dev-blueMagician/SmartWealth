"""Shared helper: resolve ``client_id`` from ``case_id`` and load case metadata."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.rows import dict_row


def norm_uuid_str(value: object) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        return str(UUID(s))
    except ValueError:
        return None


def select_case_client(conn: Connection, case_id: str) -> dict[str, Any] | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT c.id::text AS id, c.client_id::text AS client_id, c.type, c.status, c.phase
            FROM "case" c
            WHERE c.id = %s::uuid
            LIMIT 1
            """,
            (case_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
