from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from app.infrastructure.config.settings import Settings


class WorkflowOrchestrationContextService:
    """Seed hints: orchestration_request for context; from/to from workflow_event (+ assessment via trigger)."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def get_seed_hints(self, *, workflow_id: str, assessment_code: str) -> dict[str, Any]:
        import psycopg

        wf_raw = workflow_id.strip()
        code = assessment_code.strip()
        if not wf_raw:
            raise ValueError("workflow_id must not be empty.")
        if not code:
            raise ValueError("assessment_code must not be empty.")
        try:
            wf_uuid = UUID(wf_raw)
        except ValueError as exc:
            raise ValueError("workflow_id must be a valid UUID.") from exc

        url = self._settings.resolved_database_url
        with psycopg.connect(url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT request_id, assessment_code, current_step, variables, requested_at
                    FROM orchestration_request
                    WHERE workflow_id = %s
                    ORDER BY requested_at DESC
                    LIMIT 1
                    """,
                    (wf_uuid,),
                )
                orq_row = cur.fetchone()

                cur.execute(
                    """
                    SELECT DISTINCT to_state
                    FROM workflow_ai_trigger
                    WHERE assessment_code = %s AND enabled = TRUE
                    ORDER BY to_state
                    """,
                    (code,),
                )
                trigger_states = [str(r[0]) for r in cur.fetchall()]

                cur.execute(
                    """
                    SELECT we.event_id, we.from_state, we.to_state, we.occurred_at
                    FROM workflow_event we
                    INNER JOIN workflow_ai_trigger wat
                      ON wat.to_state = we.to_state
                     AND wat.assessment_code = %s
                     AND wat.enabled = TRUE
                    WHERE we.workflow_id = %s
                    ORDER BY we.occurred_at DESC
                    LIMIT 1
                    """,
                    (code, wf_uuid),
                )
                matched_ev = cur.fetchone()

        orchestration_request: dict[str, Any] | None = None
        if orq_row:
            req_id, req_code, current_step, variables_raw, requested_at = orq_row
            variables: dict[str, Any] = {}
            if isinstance(variables_raw, dict):
                variables = variables_raw
            elif isinstance(variables_raw, str):
                try:
                    parsed = json.loads(variables_raw)
                    variables = parsed if isinstance(parsed, dict) else {}
                except json.JSONDecodeError:
                    variables = {}
            orchestration_request = {
                "request_id": str(req_id),
                "assessment_code": str(req_code),
                "current_step": str(current_step),
                "variables": variables,
                "requested_at": requested_at.isoformat() if requested_at else None,
            }

        workflow_event_match: dict[str, Any] | None = None
        if matched_ev:
            ev_id, ev_from, ev_to, ev_at = matched_ev
            workflow_event_match = {
                "event_id": str(ev_id),
                "from_state": str(ev_from),
                "to_state": str(ev_to),
                "occurred_at": ev_at.isoformat() if ev_at else None,
            }
            suggested_from = str(ev_from)
            suggested_to = [str(ev_to)]
            from_source = "workflow_event.from_state"
            to_source = "workflow_event.to_state"
        else:
            suggested_from = "DATA_CAPTURE"
            suggested_to = trigger_states if trigger_states else ["READY_FOR_VALIDATION"]
            from_source = "default_no_matching_workflow_event"
            to_source = "workflow_ai_trigger" if trigger_states else "default_no_trigger"

        return {
            "workflow_id": str(wf_uuid),
            "assessment_code": code,
            "orchestration_request": orchestration_request,
            "workflow_event": workflow_event_match,
            "from_state": suggested_from,
            "to_states": suggested_to,
            "sources": {
                "from_state": from_source,
                "to_states": to_source,
            },
        }
