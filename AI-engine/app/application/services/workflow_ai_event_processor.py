from __future__ import annotations

from uuid import UUID

from app.infrastructure.config.settings import Settings
from app.infrastructure.db.persist_assessment_pg import persist_assessment_result_and_findings
from app.orchestration.assessment.registry import (
    run_registered_assessment,
    supported_assessment_codes,
)


def _mark_event_done(conn, event_id: UUID, error: str | None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE workflow_event
            SET processed_at = NOW(),
                processing_error = %s
            WHERE event_id = %s
            """,
            (error, event_id),
        )


def _resolve_latest_request_id(conn, workflow_id: UUID) -> UUID | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT request_id
            FROM orchestration_request
            WHERE workflow_id = %s
            ORDER BY requested_at DESC
            LIMIT 1
            """,
            (workflow_id,),
        )
        row = cur.fetchone()
        return None if row is None else row[0]


def _fetch_ai_trigger_codes(conn, to_state: str) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT assessment_code
            FROM workflow_ai_trigger
            WHERE enabled AND to_state = %s
            ORDER BY assessment_code
            """,
            (to_state,),
        )
        return [r[0] for r in cur.fetchall()]


class WorkflowAiEventProcessor:
    """
    Reads pending rows from workflow_event, matches workflow_ai_trigger.assessment_code
    against the in-process assessment runner registry, runs each registered code in order
    (orchestration_request by workflow_id), persists ai_result + ai_finding per run.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def process_one_pending(self) -> dict | None:
        """Lock one pending event and process it. Returns outcome dict or None if queue empty."""
        import psycopg

        url = self._settings.resolved_database_url
        with psycopg.connect(url) as conn:
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT event_id, workflow_id, from_state, to_state
                        FROM workflow_event
                        WHERE processed_at IS NULL
                        ORDER BY occurred_at ASC
                        LIMIT 1
                        FOR UPDATE SKIP LOCKED
                        """
                    )
                    row = cur.fetchone()
                    if row is None:
                        return None
                    event_id: UUID = row[0]
                    workflow_id: UUID = row[1]
                    _from_state: str = row[2]
                    to_state: str = row[3]

                outcome = self._dispatch(conn, event_id, workflow_id, to_state)
                return outcome

    def process_pending(self, *, limit: int = 20) -> dict[str, int | list]:
        """Process up to `limit` pending events (one DB transaction each)."""
        outcomes: list[dict] = []
        processed = 0
        for _ in range(max(1, limit)):
            one = self.process_one_pending()
            if one is None:
                break
            processed += 1
            outcomes.append(one)
        return {"processed": processed, "outcomes": outcomes}

    def _dispatch(
        self,
        conn,
        event_id: UUID,
        workflow_id: UUID,
        to_state: str,
    ) -> dict:
        codes = _fetch_ai_trigger_codes(conn, to_state)
        if not codes:
            _mark_event_done(conn, event_id, "NO_AI_TRIGGER")
            return {
                "event_id": str(event_id),
                "status": "skipped",
                "reason": "NO_AI_TRIGGER",
            }

        supported = supported_assessment_codes()
        runnable = [c for c in codes if c in supported]
        if not runnable:
            _mark_event_done(
                conn,
                event_id,
                f"NO_HANDLER_FOR_ASSESSMENTS:{','.join(codes)}",
            )
            return {
                "event_id": str(event_id),
                "status": "skipped",
                "reason": "NO_REGISTERED_RUNNER",
                "assessment_codes": codes,
                "supported_codes": sorted(supported),
            }

        request_id = _resolve_latest_request_id(conn, workflow_id)
        if request_id is None:
            _mark_event_done(conn, event_id, "ORCHESTRATION_REQUEST_NOT_FOUND")
            return {
                "event_id": str(event_id),
                "status": "failed",
                "reason": "ORCHESTRATION_REQUEST_NOT_FOUND",
            }

        assessments: list[dict[str, str]] = []
        try:
            for code in runnable:
                result = run_registered_assessment(conn, str(request_id), code)
                persist_assessment_result_and_findings(
                    conn, workflow_event_id=event_id, result=result
                )
                assessments.append(
                    {"assessment_code": code, "result_id": result.result_id}
                )
            _mark_event_done(conn, event_id, None)
        except Exception as exc:
            _mark_event_done(conn, event_id, f"{type(exc).__name__}:{exc}")
            return {
                "event_id": str(event_id),
                "status": "failed",
                "reason": str(exc),
            }

        out: dict = {
            "event_id": str(event_id),
            "status": "completed",
            "request_id": str(request_id),
            "assessments": assessments,
        }
        if len(assessments) == 1:
            out["assessment"] = assessments[0]["assessment_code"]
            out["result_id"] = assessments[0]["result_id"]
        return out
