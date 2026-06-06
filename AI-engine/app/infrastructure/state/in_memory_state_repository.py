from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.domain.smartwealth.interfaces.ports import StateRepository
from app.domain.smartwealth.models import WorkflowState, WorkflowStatus


class InMemoryStateRepository(StateRepository):
    def __init__(self) -> None:
        self._states: dict[str, WorkflowState] = {}

    def create(self, payload: dict) -> WorkflowState:
        workflow_id = str(uuid4())
        state = WorkflowState(
            workflow_id=workflow_id,
            status=WorkflowStatus.RECEIVED,
            input_payload=payload,
            updated_at=datetime.now(timezone.utc),
        )
        self._states[workflow_id] = state
        return state

    def get(self, workflow_id: str) -> WorkflowState:
        state = self._states.get(workflow_id)
        if state is None:
            raise KeyError(f"Workflow {workflow_id} not found")
        return state

    def save(self, state: WorkflowState) -> WorkflowState:
        self._states[state.workflow_id] = state
        return state

    def list(self, limit: int = 100) -> list[WorkflowState]:
        states = sorted(self._states.values(), key=lambda item: item.updated_at, reverse=True)
        return states[:limit]
