from __future__ import annotations

from uuid import UUID, uuid4, uuid5

from psycopg.types.json import Jsonb

from app.infrastructure.config.settings import Settings

# Stable namespace for deterministic orchestration_request id per workflow (idempotent seed).
_SEED_REQUEST_NS = UUID("01940000-0000-7000-8000-000000000001")


class WorkflowSeedService:
    """
    Seed helper for internal workflow queue demos.

    Creates/updates one orchestration_request row, upserts workflow_ai_trigger rows,
    and optionally appends workflow_event rows for each requested state transition.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def seed_queue_fixtures(
        self,
        *,
        workflow_id: str,
        request_id: str | None,
        assessment_code: str,
        to_states: list[str],
        seed_events: bool,
        start_from_state: str,
    ) -> dict[str, object]:
        import psycopg

        normalized_states = self._normalize_states(to_states)
        code = assessment_code.strip()
        if not code:
            raise ValueError("assessment_code must not be empty.")

        from_state = start_from_state.strip()
        if not from_state:
            raise ValueError("start_from_state must not be empty.")

        wf_id = self._to_uuid(workflow_id, field_name="workflow_id")
        req_id = self._resolve_seed_request_id(request_id, wf_id)
        user_id = uuid4()
        ssot_record_id = uuid4()
        ssot_snapshot_id = uuid4()

        url = self._settings.resolved_database_url
        with psycopg.connect(url) as conn:
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO orchestration_request (
                            request_id, workflow_id, user_id, correlation_id,
                            input_text, input_language, source_channel, priority, requested_at,
                            confidence_threshold, human_approval_required,
                            ssot_record_id, ssot_record_type, ssot_record_version, ssot_correlation_id,
                            assessment_code,
                            ssot_snapshot_id, environment, feature_flags,
                            session_id, current_step, attempt_count,
                            previous_result_ids, escalation_required, human_approval_status,
                            human_approver_id, human_approval_at, variables
                        ) VALUES (
                            %s, %s, %s, %s,
                            %s, %s, %s, %s, NOW(),
                            %s, %s,
                            %s, %s, %s, %s,
                            %s,
                            %s, %s, %s,
                            %s, %s, %s,
                            %s, %s, %s,
                            NULL, NULL, %s
                        )
                        ON CONFLICT (request_id) DO UPDATE SET
                            workflow_id = EXCLUDED.workflow_id,
                            assessment_code = EXCLUDED.assessment_code,
                            feature_flags = EXCLUDED.feature_flags,
                            variables = EXCLUDED.variables,
                            session_id = EXCLUDED.session_id,
                            current_step = EXCLUDED.current_step,
                            context_updated_at = NOW()
                        """,
                        (
                            req_id,
                            wf_id,
                            user_id,
                            f"corr-seed-{wf_id}",
                            "Assess onboarding completeness",
                            "en",
                            "api",
                            1,
                            0.800,
                            False,
                            ssot_record_id,
                            "onboarding",
                            "v1",
                            "ssot-corr-seed",
                            code,
                            ssot_snapshot_id,
                            "dev",
                            Jsonb({"onboarding_completeness_enabled": True}),
                            f"sess-seed-{wf_id}",
                            "onboarding",
                            1,
                            Jsonb([]),
                            False,
                            "NOT_REQUIRED",
                            Jsonb({"customer_id": "C001"}),
                        ),
                    )

                    for state in normalized_states:
                        cur.execute(
                            """
                            INSERT INTO workflow_ai_trigger (to_state, assessment_code, enabled)
                            VALUES (%s, %s, TRUE)
                            ON CONFLICT (to_state, assessment_code) DO UPDATE
                            SET enabled = EXCLUDED.enabled
                            """,
                            (state, code),
                        )

                    seeded_events: list[dict[str, str]] = []
                    skipped_duplicate_pending_events: list[dict[str, str]] = []
                    if seed_events:
                        current_from = from_state
                        for state in normalized_states:
                            if self._pending_duplicate_transition(cur, wf_id, current_from, state):
                                skipped_duplicate_pending_events.append(
                                    {
                                        "workflow_id": str(wf_id),
                                        "from_state": current_from,
                                        "to_state": state,
                                        "reason": "PENDING_DUPLICATE_FROM_TO",
                                    }
                                )
                                current_from = state
                                continue
                            cur.execute(
                                """
                                INSERT INTO workflow_event (
                                    workflow_id, entity_type, from_state, to_state, triggered_by, occurred_at
                                ) VALUES (
                                    %s, 'WORKFLOW', %s, %s, 'SYSTEM', NOW()
                                )
                                RETURNING event_id
                                """,
                                (wf_id, current_from, state),
                            )
                            event_id = str(cur.fetchone()[0])
                            seeded_events.append(
                                {
                                    "event_id": event_id,
                                    "from_state": current_from,
                                    "to_state": state,
                                }
                            )
                            current_from = state

        return {
            "workflow_id": str(wf_id),
            "request_id": str(req_id),
            "assessment_code": code,
            "trigger_states": normalized_states,
            "seeded_events": seeded_events,
            "skipped_duplicate_pending_events": skipped_duplicate_pending_events,
        }

    @staticmethod
    def _normalize_states(states: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for raw in states:
            state = raw.strip()
            if not state:
                continue
            if state in seen:
                continue
            cleaned.append(state)
            seen.add(state)
        if not cleaned:
            raise ValueError("to_states must include at least one non-empty state.")
        return cleaned

    @staticmethod
    def _to_uuid(value: str, *, field_name: str) -> UUID:
        raw = value.strip()
        if not raw:
            raise ValueError(f"{field_name} must not be empty.")
        try:
            return UUID(raw)
        except ValueError as exc:
            raise ValueError(f"{field_name} must be a valid UUID.") from exc

    @staticmethod
    def _deterministic_seed_request_id(workflow_id: UUID) -> UUID:
        """Same workflow always maps to the same request row (ON CONFLICT upsert)."""
        return uuid5(_SEED_REQUEST_NS, f"orchestration-seed:{workflow_id}")

    @classmethod
    def _resolve_seed_request_id(cls, request_id: str | None, workflow_id: UUID) -> UUID:
        if request_id is None or not str(request_id).strip():
            return cls._deterministic_seed_request_id(workflow_id)
        return UUID(str(request_id).strip())

    @staticmethod
    def _pending_duplicate_transition(cur, workflow_id: UUID, from_state: str, to_state: str) -> bool:
        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM workflow_event
                WHERE workflow_id = %s
                  AND from_state = %s
                  AND to_state = %s
                  AND processed_at IS NULL
            )
            """,
            (workflow_id, from_state, to_state),
        )
        row = cur.fetchone()
        return bool(row and row[0])
