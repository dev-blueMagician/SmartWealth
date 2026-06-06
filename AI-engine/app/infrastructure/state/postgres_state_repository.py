from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json

from app.domain.smartwealth.interfaces.ports import StateRepository
from app.domain.smartwealth.models import AIDraft, WorkflowState, WorkflowStatus


def _parse_datetime(value: object) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    raise TypeError(f"Unsupported datetime value: {type(value)!r}")


def _aidraft_to_json(draft: AIDraft | None) -> Any:
    if draft is None:
        return None
    return {
        "content": draft.content,
        "source_fields": draft.source_fields,
        "generated_at": draft.generated_at.isoformat(),
    }


def _aidraft_from_json(raw: Any) -> AIDraft | None:
    if raw is None:
        return None
    if isinstance(raw, str):
        raw = json.loads(raw)
    if not isinstance(raw, dict):
        return None
    return AIDraft(
        content=str(raw["content"]),
        source_fields=list(raw["source_fields"]),
        generated_at=_parse_datetime(raw["generated_at"]),
    )


class PostgresStateRepository(StateRepository):
    """Persist ``WorkflowState`` in PostgreSQL (``workflow_state`` table)."""

    def __init__(self, conninfo: str) -> None:
        self._conninfo = conninfo

    def create(self, payload: dict[str, Any]) -> WorkflowState:
        workflow_id = str(uuid4())
        state = WorkflowState(
            workflow_id=workflow_id,
            status=WorkflowStatus.RECEIVED,
            input_payload=payload,
            updated_at=datetime.now(timezone.utc),
        )
        with psycopg.connect(self._conninfo) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO workflow_state (
                        workflow_id, status, input_payload, ai_draft, human_decision, version, updated_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        workflow_id,
                        state.status.value,
                        Json(payload),
                        None,
                        None,
                        state.version,
                        state.updated_at,
                    ),
                )
            conn.commit()
        return state

    def get(self, workflow_id: str) -> WorkflowState:
        with psycopg.connect(self._conninfo) as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    """
                    SELECT workflow_id, status, input_payload, ai_draft, human_decision, version, updated_at
                    FROM workflow_state
                    WHERE workflow_id = %s
                    """,
                    (workflow_id,),
                )
                row = cur.fetchone()
        if row is None:
            raise KeyError(f"Workflow {workflow_id} not found")
        return self._row_to_state(dict(row))

    def save(self, state: WorkflowState) -> WorkflowState:
        with psycopg.connect(self._conninfo) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE workflow_state
                    SET status = %s,
                        input_payload = %s,
                        ai_draft = %s,
                        human_decision = %s,
                        version = %s,
                        updated_at = %s
                    WHERE workflow_id = %s
                    """,
                    (
                        state.status.value,
                        Json(state.input_payload),
                        Json(_aidraft_to_json(state.ai_draft))
                        if state.ai_draft is not None
                        else None,
                        Json(state.human_decision) if state.human_decision is not None else None,
                        state.version,
                        state.updated_at,
                        state.workflow_id,
                    ),
                )
                if cur.rowcount == 0:
                    raise KeyError(f"Workflow {state.workflow_id} not found")
            conn.commit()
        return state

    def list(self, limit: int = 100) -> list[WorkflowState]:
        with psycopg.connect(self._conninfo) as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    """
                    SELECT workflow_id, status, input_payload, ai_draft, human_decision, version, updated_at
                    FROM workflow_state
                    ORDER BY updated_at DESC
                    LIMIT %s
                    """,
                    (limit,),
                )
                rows = cur.fetchall()
        return [self._row_to_state(dict(row)) for row in rows]

    def _row_to_state(self, row: dict[str, Any]) -> WorkflowState:
        return WorkflowState(
            workflow_id=str(row["workflow_id"]),
            status=WorkflowStatus(row["status"]),
            input_payload=dict(row["input_payload"]) if row["input_payload"] is not None else {},
            ai_draft=_aidraft_from_json(row["ai_draft"]),
            human_decision=dict(row["human_decision"]) if row["human_decision"] is not None else None,
            version=int(row["version"]),
            updated_at=_parse_datetime(row["updated_at"]),
        )
