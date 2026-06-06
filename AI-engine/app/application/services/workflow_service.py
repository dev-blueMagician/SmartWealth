from __future__ import annotations

from app.domain.smartwealth.interfaces.ports import AuditLogger, StateRepository
from app.domain.smartwealth.models import ActorType, AuditEvent
from app.orchestration.smartwealth.graph import SmartWealthOrchestrator


class WorkflowService:
    def __init__(
        self,
        state_repository: StateRepository,
        audit_logger: AuditLogger,
        orchestrator: SmartWealthOrchestrator,
    ) -> None:
        self._state_repository = state_repository
        self._audit_logger = audit_logger
        self._orchestrator = orchestrator

    def create_workflow(self, payload: dict) -> dict:
        state = self._state_repository.create(payload)
        self._audit_logger.append(
            AuditEvent(
                workflow_id=state.workflow_id,
                event_type="WORKFLOW_CREATED",
                actor_type=ActorType.SYSTEM,
                actor_id="workflow_service",
                payload={"payload_keys": list(payload.keys())},
            )
        )
        return {"workflow_id": state.workflow_id, "status": state.status.value}

    async def run_workflow(self, workflow_id: str) -> dict:
        return await self._orchestrator.run_until_human_gate(workflow_id)

    def get_workflow(self, workflow_id: str) -> dict:
        state = self._state_repository.get(workflow_id)
        return self._orchestrator._to_response(state)  # explicit for day-0 baseline

    def list_workflows(self, limit: int = 100) -> list[dict]:
        states = self._state_repository.list(limit=limit)
        return [self._orchestrator._to_response(state) for state in states]

    def list_audit_events(self, workflow_id: str) -> list[dict]:
        events = self._audit_logger.list_by_workflow(workflow_id)
        return [
            {
                "event_id": event.event_id,
                "event_type": event.event_type,
                "actor_type": event.actor_type.value,
                "actor_id": event.actor_id,
                "payload": event.payload,
                "created_at": event.created_at.isoformat(),
            }
            for event in events
        ]

    def apply_human_approval(
        self,
        workflow_id: str,
        approved: bool,
        reviewer_id: str,
        note: str | None = None,
    ) -> dict:
        return self._orchestrator.apply_human_decision(
            workflow_id=workflow_id,
            approved=approved,
            reviewer_id=reviewer_id,
            note=note,
        )
