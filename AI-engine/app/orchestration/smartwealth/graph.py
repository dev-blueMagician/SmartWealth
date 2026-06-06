from __future__ import annotations

from app.domain.smartwealth.interfaces.ports import AuditLogger, StateRepository, ToolExecutor
from app.domain.smartwealth.models import (
    ActorType,
    AuditEvent,
    WorkflowEvent,
    WorkflowStatus,
    WorkflowTriggerSource,
)
from app.orchestration.smartwealth.agents.data_validation_agent import DataValidationAgent
from app.orchestration.smartwealth.agents.drafting_agent import DraftingAgent
from app.orchestration.smartwealth.workflow_runner_graph import build_smartwealth_run_graph


class SmartWealthOrchestrator:
    """
    Explicit state machine coordinator.
    Orchestrator owns transitions; agents/tools are step executors only.
    """

    def __init__(
        self,
        state_repository: StateRepository,
        audit_logger: AuditLogger,
        validation_agent: DataValidationAgent,
        drafting_agent: DraftingAgent,
        tool_executor: ToolExecutor,
        tool_permissions: dict[str, set[str]] | None = None,
    ) -> None:
        self._state_repository = state_repository
        self._audit_logger = audit_logger
        self._validation_agent = validation_agent
        self._drafting_agent = drafting_agent
        self._tool_executor = tool_executor
        self._tool_permissions = tool_permissions or {}
        self._run_until_human_gate_graph = build_smartwealth_run_graph(self)

    def handleWorkflowEvent(self, event: WorkflowEvent) -> dict[str, object]:
        actor_type = (
            ActorType.SYSTEM
            if event.triggered_by == WorkflowTriggerSource.SYSTEM
            else ActorType.HUMAN
        )
        audit_event = AuditEvent(
            workflow_id=event.entity_id,
            event_type="ENTITY_STATE_CHANGED",
            actor_type=actor_type,
            actor_id=event.triggered_by.value,
            payload={
                "entity_type": event.entity_type,
                "from_state": event.from_state,
                "to_state": event.to_state,
                "occurred_at": event.occurred_at.isoformat(),
            },
        )
        self._audit_logger.append(audit_event)
        return {
            "accepted": True,
            "workflow_id": event.entity_id,
            "audit_event_id": audit_event.event_id,
            "event_type": audit_event.event_type,
        }

    async def run_until_human_gate(self, workflow_id: str) -> dict:
        """Run the workflow graph until a terminal human gate (``ainvoke``)."""
        out = await self._run_until_human_gate_graph.ainvoke({"workflow_id": workflow_id})
        if not out.get("finished"):
            raise RuntimeError("Workflow graph stopped before reaching a terminal gate state.")
        response = out.get("response")
        if response is None:
            raise RuntimeError("Workflow graph finished without a response payload.")
        return response

    def apply_human_decision(
        self,
        workflow_id: str,
        approved: bool,
        reviewer_id: str,
        note: str | None,
    ) -> dict:
        state = self._state_repository.get(workflow_id)
        if state.status != WorkflowStatus.PENDING_HUMAN_APPROVAL:
            raise ValueError("Human decision is allowed only at PENDING_HUMAN_APPROVAL state.")

        state.human_decision = {
            "approved": approved,
            "reviewer_id": reviewer_id,
            "note": note,
        }
        state.status = WorkflowStatus.HUMAN_APPROVED if approved else WorkflowStatus.HUMAN_REJECTED
        state.bump_version()
        self._state_repository.save(state)

        self._audit_logger.append(
            AuditEvent(
                workflow_id=workflow_id,
                event_type="HUMAN_DECISION_RECORDED",
                actor_type=ActorType.HUMAN,
                actor_id=reviewer_id,
                payload={"approved": approved, "note": note},
            )
        )
        return self._to_response(state)

    def _to_response(self, state) -> dict:
        return {
            "workflow_id": state.workflow_id,
            "status": state.status.value,
            "version": state.version,
            "ai_draft": None
            if state.ai_draft is None
            else {
                "content": state.ai_draft.content,
                "source_fields": state.ai_draft.source_fields,
                "generated_at": state.ai_draft.generated_at.isoformat(),
            },
            "human_decision": state.human_decision,
            "updated_at": state.updated_at.isoformat(),
        }

    def _execute_tool_request(
        self,
        agent_id: str,
        tool_name: str,
        tool_input: dict[str, object],
    ) -> dict[str, object]:
        self._validate_tool_permission(agent_id=agent_id, tool_name=tool_name)
        return self._tool_executor.execute_tool(tool_name=tool_name, tool_input=tool_input)

    def _validate_tool_permission(self, agent_id: str, tool_name: str) -> None:
        allowed_tools = self._tool_permissions.get(agent_id, set())
        if tool_name not in allowed_tools:
            raise ValueError(f"Agent '{agent_id}' is not allowed to execute tool '{tool_name}'.")
