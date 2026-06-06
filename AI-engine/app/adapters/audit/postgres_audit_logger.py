from __future__ import annotations

from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json

from app.domain.smartwealth.interfaces.ports import AuditLogger
from app.domain.smartwealth.models import ActorType, AuditEvent


class PostgresAuditLogger(AuditLogger):
    """Append-only workflow audit trail in PostgreSQL (``workflow_audit_event``)."""

    def __init__(self, conninfo: str) -> None:
        self._conninfo = conninfo

    def append(self, event: AuditEvent) -> None:
        with psycopg.connect(self._conninfo) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO workflow_audit_event (
                        event_id, workflow_id, event_type, actor_type, actor_id, payload, created_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        event.event_id,
                        event.workflow_id,
                        event.event_type,
                        event.actor_type.value,
                        event.actor_id,
                        Json(event.payload),
                        event.created_at,
                    ),
                )
            conn.commit()

    def list_by_workflow(self, workflow_id: str) -> list[AuditEvent]:
        with psycopg.connect(self._conninfo) as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    """
                    SELECT event_id, workflow_id, event_type, actor_type, actor_id, payload, created_at
                    FROM workflow_audit_event
                    WHERE workflow_id = %s
                    ORDER BY created_at ASC
                    """,
                    (workflow_id,),
                )
                rows = cur.fetchall()
        return [self._row_to_event(dict(r)) for r in rows]

    def _row_to_event(self, row: dict[str, Any]) -> AuditEvent:
        return AuditEvent(
            workflow_id=str(row["workflow_id"]),
            event_type=str(row["event_type"]),
            actor_type=ActorType(row["actor_type"]),
            actor_id=str(row["actor_id"]),
            payload=dict(row["payload"]) if row["payload"] is not None else {},
            created_at=row["created_at"],
            event_id=str(row["event_id"]),
        )
