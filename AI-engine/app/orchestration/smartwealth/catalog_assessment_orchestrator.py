from __future__ import annotations

from typing import Any

from app.domain.smartwealth.interfaces.ports import (
    Agent,
    AgentExecutor,
    AgentSelector,
    ConfidenceGate,
    ContextResolver,
    PolicyChecker,
    ToolExecutor,
)
from app.domain.smartwealth.models import AIResult, DecisionStatus, OrchestrationContext
from app.infrastructure.config.settings import Settings
from app.infrastructure.llm.factory import assessment_llm_ready
from app.orchestration.smartwealth.agents.completeness_agent import CompletenessAgent
from app.orchestration.smartwealth.agents.document_agent import DocumentAgent
from app.orchestration.smartwealth.agents.search_agent import SearchAgent
from app.orchestration.smartwealth.catalog_agent_routing import select_catalog_agent_id
from app.orchestration.smartwealth.catalog_assessment_graph import CatalogAssessmentOrchestrator
from app.orchestration.smartwealth.tool_executor import RegistryToolExecutor
from app.tools.client_profile_chat_patch_tool import ClientProfileChatPatchTool
from app.tools.client_profile_sql_tool import ClientProfileSqlTool
from app.tools.discovery_dataset_sql_tool import DiscoveryDatasetSqlTool
from app.tools.ssot_lookup_tool import SSOTLookupTool


class CatalogAssessmentPolicyCheck(PolicyChecker):
    """
    Allow any ``assessment_code`` that exists in ``interaction_catalog.INTERACTIONS``.

    ``receive_trigger_event`` on the orchestrator has already validated the code against the catalog;
    this step only records policy outcome (DRAFT) for the graph.
    """

    def run_policy_check(self, context: OrchestrationContext) -> DecisionStatus:
        return DecisionStatus.DRAFT


class CatalogAssessmentAgentSelector(AgentSelector):
    """Routes catalog assessments to document, search, or completeness agents."""

    def select_agent(self, context: OrchestrationContext) -> str:
        return select_catalog_agent_id(context)


class LocalAgentExecutor(AgentExecutor):
    """Resolve agents in-process (registry in RAM); optional tool execution via ToolExecutor."""

    def __init__(
        self,
        agents: list[Agent],
        *,
        tool_executor: ToolExecutor | None = None,
        tool_permissions: dict[str, set[str]] | None = None,
    ) -> None:
        self._agents = {agent.agent_id: agent for agent in agents}
        self._tool_executor = tool_executor
        self._tool_permissions = tool_permissions or {}

    def execute_agent(self, agent_id: str, context: OrchestrationContext) -> AIResult:
        agent = self._agents.get(agent_id)
        if agent is None:
            raise ValueError(f"Unknown agent_id: {agent_id}")
        execute_with_tools = getattr(agent, "execute_with_tools", None)
        if callable(execute_with_tools):
            if self._tool_executor is None:
                raise ValueError(
                    f"Agent '{agent_id}' requires tool execution but no ToolExecutor is configured."
                )
            return execute_with_tools(
                context=context,
                execute_tool=lambda tool_name, tool_input: self._execute_tool_request(
                    agent_id=agent_id,
                    tool_name=tool_name,
                    tool_input=tool_input,
                ),
            )
        return agent.execute(context)

    def _execute_tool_request(
        self,
        *,
        agent_id: str,
        tool_name: str,
        tool_input: dict[str, Any],
    ) -> dict[str, Any]:
        self._validate_tool_permission(agent_id=agent_id, tool_name=tool_name)
        if self._tool_executor is None:
            raise ValueError("ToolExecutor is not configured.")
        return self._tool_executor.execute_tool(tool_name=tool_name, tool_input=tool_input)

    def _validate_tool_permission(self, *, agent_id: str, tool_name: str) -> None:
        allowed_tools = self._tool_permissions.get(agent_id, set())
        if tool_name not in allowed_tools:
            raise ValueError(f"Agent '{agent_id}' is not allowed to execute tool '{tool_name}'.")


class CatalogAssessmentConfidenceGate(ConfidenceGate):
    """Maps runtime escalation + confidence to STOP/ESCALATE vs DRAFT."""

    def apply_confidence_gate(self, result: AIResult, context: OrchestrationContext) -> AIResult:
        from dataclasses import replace

        if context.escalation_required:
            return replace(
                result,
                decision=DecisionStatus.ESCALATE,
                decision_reason="Escalation required per orchestration context (catalog HITL may apply).",
            )
        return result


def build_catalog_assessment_orchestrator(
    context_resolver: ContextResolver,
    settings: Settings | None = None,
) -> CatalogAssessmentOrchestrator:
    """
    Build ``CatalogAssessmentOrchestrator`` (LangGraph) for catalog-driven assessments (per ``INTERACTIONS``).

    ``OrchestrationRequest.assessment_code`` selects the interaction row and prompt template.
    When ``settings.assessment_llm_enabled`` is true and credentials for ``settings.llm_provider`` are set,
    uses ``CompletenessLlmAgent`` (rules + LLM); otherwise ``CompletenessAgent`` only.
    """

    st = settings or Settings()
    use_llm = assessment_llm_ready(st)
    if use_llm:
        from app.infrastructure.llm.factory import assessment_llm_identity, chat_completion_adapter_from_settings
        from app.orchestration.smartwealth.agents.completeness_llm_agent import CompletenessLlmAgent

        prov, _ = assessment_llm_identity(st)
        completeness_agent: Agent = CompletenessLlmAgent(
            chat_completion_adapter_from_settings(st),
            result_provider=prov,
        )
    else:
        completeness_agent = CompletenessAgent()

    agents: list[Agent] = [
        completeness_agent,
        DocumentAgent(),
        SearchAgent(),
    ]
    ssot_lookup_tool = SSOTLookupTool()
    client_profile_sql_tool = ClientProfileSqlTool()
    discovery_dataset_sql_tool = DiscoveryDatasetSqlTool()
    profile_chat_patch_tool = ClientProfileChatPatchTool(st)
    tool_executor = RegistryToolExecutor(
        read_only_tools=[ssot_lookup_tool, client_profile_sql_tool, discovery_dataset_sql_tool],
        computation_tools=[profile_chat_patch_tool],
    )
    tool_permissions = {
        "document_agent": {ssot_lookup_tool.tool_id},
        "search_agent": {
            ssot_lookup_tool.tool_id,
            client_profile_sql_tool.tool_id,
            discovery_dataset_sql_tool.tool_id,
        },
        "completeness_agent": {
            ssot_lookup_tool.tool_id,
            client_profile_sql_tool.tool_id,
            discovery_dataset_sql_tool.tool_id,
            profile_chat_patch_tool.tool_id,
        },
    }
    return CatalogAssessmentOrchestrator(
        policy_checker=CatalogAssessmentPolicyCheck(),
        context_resolver=context_resolver,
        agent_selector=CatalogAssessmentAgentSelector(),
        agent_executor=LocalAgentExecutor(
            agents,
            tool_executor=tool_executor,
            tool_permissions=tool_permissions,
        ),
        confidence_gate=CatalogAssessmentConfidenceGate(),
    )
