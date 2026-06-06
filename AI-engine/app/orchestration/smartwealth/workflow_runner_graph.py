"""
LangGraph runner for HTTP workflow execution until the human gate.

One node performs a single persisted transition (mirrors the former ``while`` loop).
Cycles until ``WorkflowStatus`` reaches a terminal gate state.
"""

from __future__ import annotations

from typing import Any, Literal

from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict

from app.domain.smartwealth.models import (
    AIDraft,
    ActorType,
    AuditEvent,
    WorkflowStatus,
)


class WorkflowRunGraphState(TypedDict, total=False):
    workflow_id: str
    finished: bool
    response: dict


def build_smartwealth_run_graph(orch: Any):
    terminal = {
        WorkflowStatus.PENDING_HUMAN_APPROVAL,
        WorkflowStatus.HUMAN_APPROVED,
        WorkflowStatus.HUMAN_REJECTED,
    }

    def advance_once(state: WorkflowRunGraphState) -> WorkflowRunGraphState:
        workflow_id = state["workflow_id"]
        wf_state = orch._state_repository.get(workflow_id)

        if wf_state.status in terminal:
            return {
                "workflow_id": workflow_id,
                "finished": True,
                "response": orch._to_response(wf_state),
            }

        if wf_state.status == WorkflowStatus.RECEIVED:
            validation = orch._validation_agent.validate(wf_state.input_payload)
            orch._audit_logger.append(
                AuditEvent(
                    workflow_id=workflow_id,
                    event_type="VALIDATION_EXECUTED",
                    actor_type=ActorType.AGENT,
                    actor_id=orch._validation_agent.agent_id,
                    payload={
                        "is_valid": validation.is_valid,
                        "errors": validation.errors,
                    },
                )
            )

            if not validation.is_valid:
                wf_state.status = WorkflowStatus.PENDING_HUMAN_APPROVAL
                wf_state.bump_version()
                orch._state_repository.save(wf_state)
                orch._audit_logger.append(
                    AuditEvent(
                        workflow_id=workflow_id,
                        event_type="WORKFLOW_BLOCKED_BY_VALIDATION",
                        actor_type=ActorType.ORCHESTRATOR,
                        actor_id="smartwealth_orchestrator",
                        payload={"reason": validation.errors},
                    )
                )
                final_state = orch._state_repository.get(workflow_id)
                return {
                    "workflow_id": workflow_id,
                    "finished": True,
                    "response": orch._to_response(final_state),
                }

            wf_state.status = WorkflowStatus.VALIDATED
            wf_state.bump_version()
            orch._state_repository.save(wf_state)
            orch._audit_logger.append(
                AuditEvent(
                    workflow_id=workflow_id,
                    event_type="STATE_TRANSITION",
                    actor_type=ActorType.ORCHESTRATOR,
                    actor_id="smartwealth_orchestrator",
                    payload={"to_state": WorkflowStatus.VALIDATED.value},
                )
            )
            return {"workflow_id": workflow_id, "finished": False}

        if wf_state.status == WorkflowStatus.VALIDATED:
            required_fields = list(wf_state.input_payload.keys())
            tool_name = orch._drafting_agent.request_tool_name()
            lookup = orch._execute_tool_request(
                agent_id=orch._drafting_agent.agent_id,
                tool_name=tool_name,
                tool_input={
                    "payload": wf_state.input_payload,
                    "required_fields": required_fields,
                },
            )
            orch._audit_logger.append(
                AuditEvent(
                    workflow_id=workflow_id,
                    event_type="TOOL_EXECUTED",
                    actor_type=ActorType.TOOL,
                    actor_id=tool_name,
                    payload={
                        "required_fields": required_fields,
                        "missing_fields": lookup.get("missing_fields", []),
                    },
                )
            )

            draft = orch._drafting_agent.create_draft(lookup.get("values", {}))
            wf_state.ai_draft = AIDraft(content=draft.draft_text, source_fields=draft.source_fields)
            wf_state.status = WorkflowStatus.DRAFTED
            wf_state.bump_version()
            orch._state_repository.save(wf_state)
            orch._audit_logger.append(
                AuditEvent(
                    workflow_id=workflow_id,
                    event_type="AI_DRAFT_CREATED",
                    actor_type=ActorType.AGENT,
                    actor_id=orch._drafting_agent.agent_id,
                    payload={
                        "draft_preview": draft.draft_text,
                        "source_fields": draft.source_fields,
                    },
                )
            )
            return {"workflow_id": workflow_id, "finished": False}

        if wf_state.status == WorkflowStatus.DRAFTED:
            wf_state.status = WorkflowStatus.PENDING_HUMAN_APPROVAL
            wf_state.bump_version()
            orch._state_repository.save(wf_state)
            orch._audit_logger.append(
                AuditEvent(
                    workflow_id=workflow_id,
                    event_type="STATE_TRANSITION",
                    actor_type=ActorType.ORCHESTRATOR,
                    actor_id="smartwealth_orchestrator",
                    payload={"to_state": WorkflowStatus.PENDING_HUMAN_APPROVAL.value},
                )
            )
            final_state = orch._state_repository.get(workflow_id)
            return {
                "workflow_id": workflow_id,
                "finished": True,
                "response": orch._to_response(final_state),
            }

        raise ValueError(f"Unsupported workflow state: {wf_state.status}")

    def route_continue(state: WorkflowRunGraphState) -> Literal["advance", "done"]:
        return "done" if state.get("finished") else "advance"

    graph = StateGraph(WorkflowRunGraphState)
    graph.add_node("advance", advance_once)
    graph.add_edge(START, "advance")
    graph.add_conditional_edges(
        "advance",
        route_continue,
        {"advance": "advance", "done": END},
    )

    return graph.compile()
