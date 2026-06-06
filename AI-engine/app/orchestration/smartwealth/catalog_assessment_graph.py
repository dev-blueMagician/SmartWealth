"""
LangGraph orchestrator for interaction-catalog assessments (any ``assessment_code`` in ``INTERACTIONS``).

Single class ``CatalogAssessmentOrchestrator``: composes ports and runs a compiled linear graph
(seven nodes). Implements the domain ``Orchestrator`` port without inheriting a separate checklist class.
"""

from __future__ import annotations

from typing import Protocol

from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict

from app.domain.smartwealth.interaction_catalog import get_interaction_spec
from app.domain.smartwealth.interfaces.ports import (
    AgentExecutor,
    AgentSelector,
    ConfidenceGate,
    ContextResolver,
    Orchestrator,
    PolicyChecker,
)
from app.domain.smartwealth.models import AIResult, DecisionStatus, OrchestrationContext, OrchestrationRequest


class CatalogAssessmentGraphState(TypedDict, total=False):
    """Mutable graph state for one ``Execute`` run."""

    request: OrchestrationRequest
    context: OrchestrationContext
    policy_decision: DecisionStatus
    agent_id: str
    raw_result: AIResult
    gated_result: AIResult
    final_result: AIResult


class _CatalogStepRunner(Protocol):
    """Steps invoked by LangGraph nodes (implemented by ``CatalogAssessmentOrchestrator``)."""

    def receive_trigger_event(self, trigger_event: OrchestrationRequest) -> OrchestrationRequest: ...

    def build_context(self, request: OrchestrationRequest) -> OrchestrationContext: ...

    def run_policy_check(self, context: OrchestrationContext) -> DecisionStatus: ...

    def select_agent(self, context: OrchestrationContext) -> str: ...

    def execute_agent(self, agent_id: str, context: OrchestrationContext) -> AIResult: ...

    def apply_confidence_gate(self, result: AIResult, context: OrchestrationContext) -> AIResult: ...

    def produce_result(self, result: AIResult) -> AIResult: ...


def build_catalog_assessment_graph(core: _CatalogStepRunner):
    """
    Build a compiled graph that delegates each step to ``core``.

    Linear: validate → context → policy → select agent → execute → gate → finalize.
    """

    def node_receive_trigger(state: CatalogAssessmentGraphState) -> dict:
        req = core.receive_trigger_event(state["request"])
        return {"request": req}

    def node_build_context(state: CatalogAssessmentGraphState) -> dict:
        ctx = core.build_context(state["request"])
        return {"context": ctx}

    def node_policy_check(state: CatalogAssessmentGraphState) -> dict:
        decision = core.run_policy_check(state["context"])
        return {"policy_decision": decision}

    def node_select_agent(state: CatalogAssessmentGraphState) -> dict:
        agent_id = core.select_agent(state["context"])
        return {"agent_id": agent_id}

    def node_execute_agent(state: CatalogAssessmentGraphState) -> dict:
        raw = core.execute_agent(state["agent_id"], state["context"])
        return {"raw_result": raw}

    def node_confidence_gate(state: CatalogAssessmentGraphState) -> dict:
        gated = core.apply_confidence_gate(state["raw_result"], state["context"])
        return {"gated_result": gated}

    def node_finalize(state: CatalogAssessmentGraphState) -> dict:
        final = core.produce_result(state["gated_result"])
        return {"final_result": final}

    graph = StateGraph(CatalogAssessmentGraphState)
    graph.add_node("receive_trigger", node_receive_trigger)
    graph.add_node("build_context", node_build_context)
    graph.add_node("policy_check", node_policy_check)
    graph.add_node("select_agent", node_select_agent)
    graph.add_node("execute_agent", node_execute_agent)
    graph.add_node("confidence_gate", node_confidence_gate)
    graph.add_node("finalize", node_finalize)

    graph.add_edge(START, "receive_trigger")
    graph.add_edge("receive_trigger", "build_context")
    graph.add_edge("build_context", "policy_check")
    graph.add_edge("policy_check", "select_agent")
    graph.add_edge("select_agent", "execute_agent")
    graph.add_edge("execute_agent", "confidence_gate")
    graph.add_edge("confidence_gate", "finalize")
    graph.add_edge("finalize", END)

    return graph.compile()


class CatalogAssessmentOrchestrator(Orchestrator):
    """
    Catalog pipeline: owns injected ports and runs the checklist exclusively via LangGraph.

    Product column ownership (see ``interaction_catalog``): receive_trigger → intent;
    build_context → input; policy / select_agent → guardrails & routing; execute_agent → output;
    apply_confidence_gate → STOP/ESCALATE vs DRAFT.
    """

    def __init__(
        self,
        policy_checker: PolicyChecker,
        context_resolver: ContextResolver,
        agent_selector: AgentSelector,
        agent_executor: AgentExecutor,
        confidence_gate: ConfidenceGate,
    ) -> None:
        self._policy_checker = policy_checker
        self._context_resolver = context_resolver
        self._agent_selector = agent_selector
        self._agent_executor = agent_executor
        self._confidence_gate = confidence_gate
        self._catalog_graph = build_catalog_assessment_graph(self)

    def Execute(self, trigger_event: OrchestrationRequest) -> AIResult:
        out: CatalogAssessmentGraphState = self._catalog_graph.invoke({"request": trigger_event})
        return _require_catalog_final(out)

    def receive_trigger_event(self, trigger_event: OrchestrationRequest) -> OrchestrationRequest:
        if not (trigger_event.assessment_code or "").strip():
            raise ValueError("assessment_code is required on OrchestrationRequest")
        spec = get_interaction_spec(trigger_event.assessment_code.strip())
        if spec is None:
            raise ValueError(f"Unknown assessment_code: {trigger_event.assessment_code!r}")
        return trigger_event

    def build_context(self, request: OrchestrationRequest) -> OrchestrationContext:
        return self._context_resolver.resolve(request)

    def run_policy_check(self, context: OrchestrationContext) -> DecisionStatus:
        return self._policy_checker.run_policy_check(context)

    def select_agent(self, context: OrchestrationContext) -> str:
        return self._agent_selector.select_agent(context)

    def execute_agent(self, agent_id: str, context: OrchestrationContext) -> AIResult:
        return self._agent_executor.execute_agent(agent_id, context)

    def apply_confidence_gate(self, result: AIResult, context: OrchestrationContext) -> AIResult:
        return self._confidence_gate.apply_confidence_gate(result, context)

    def produce_result(self, result: AIResult) -> AIResult:
        return result


def _require_catalog_final(out: CatalogAssessmentGraphState) -> AIResult:
    final = out.get("final_result")
    if final is None:
        raise RuntimeError("Catalog assessment graph finished without final_result")
    return final
