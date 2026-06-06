from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from app.domain.smartwealth.models import (
    AIResult,
    AuditEvent,
    DecisionStatus,
    OrchestrationContext,
    OrchestrationRequest,
    WorkflowState,
)


class StateRepository(ABC):
    @abstractmethod
    def create(self, payload: dict[str, Any]) -> WorkflowState:
        raise NotImplementedError

    @abstractmethod
    def get(self, workflow_id: str) -> WorkflowState:
        raise NotImplementedError

    @abstractmethod
    def save(self, state: WorkflowState) -> WorkflowState:
        raise NotImplementedError

    @abstractmethod
    def list(self, limit: int = 100) -> list[WorkflowState]:
        raise NotImplementedError


class AuditLogger(ABC):
    @abstractmethod
    def append(self, event: AuditEvent) -> None:
        raise NotImplementedError

    @abstractmethod
    def list_by_workflow(self, workflow_id: str) -> list[AuditEvent]:
        raise NotImplementedError


class PolicyChecker(ABC):
    @abstractmethod
    def run_policy_check(self, context: OrchestrationContext) -> DecisionStatus:
        raise NotImplementedError


class AgentSelector(ABC):
    @abstractmethod
    def select_agent(self, context: OrchestrationContext) -> str:
        raise NotImplementedError


class Agent(ABC):
    """
    Base contract for a single stateless SmartWealth agent.

    Agent implementations must:
    - be stateless
    - accept only orchestration context as input
    - return AIResult as output
    - never access repositories or tools directly
    """

    @property
    @abstractmethod
    def agent_id(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def execute(self, context: OrchestrationContext) -> AIResult:
        raise NotImplementedError


class AgentExecutor(ABC):
    @abstractmethod
    def execute_agent(self, agent_id: str, context: OrchestrationContext) -> AIResult:
        raise NotImplementedError


class ToolExecutor(ABC):
    @abstractmethod
    def execute_tool(self, tool_name: str, tool_input: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError


class ConfidenceGate(ABC):
    @abstractmethod
    def apply_confidence_gate(self, result: AIResult, context: OrchestrationContext) -> AIResult:
        raise NotImplementedError


class Orchestrator(ABC):
    @abstractmethod
    def receive_trigger_event(self, trigger_event: OrchestrationRequest) -> OrchestrationRequest:
        raise NotImplementedError

    @abstractmethod
    def build_context(self, request: OrchestrationRequest) -> OrchestrationContext:
        raise NotImplementedError

    @abstractmethod
    def run_policy_check(self, context: OrchestrationContext) -> DecisionStatus:
        raise NotImplementedError

    @abstractmethod
    def select_agent(self, context: OrchestrationContext) -> str:
        raise NotImplementedError

    @abstractmethod
    def execute_agent(self, agent_id: str, context: OrchestrationContext) -> AIResult:
        raise NotImplementedError

    @abstractmethod
    def apply_confidence_gate(self, result: AIResult, context: OrchestrationContext) -> AIResult:
        raise NotImplementedError

    @abstractmethod
    def produce_result(self, result: AIResult) -> AIResult:
        raise NotImplementedError


class SessionRepository(ABC):
    @abstractmethod
    def get_session_id(self, request_id: str) -> str | None:
        raise NotImplementedError

    @abstractmethod
    def get_environment(self, request_id: str) -> str | None:
        raise NotImplementedError

    @abstractmethod
    def get_feature_flags(self, request_id: str) -> dict[str, bool] | None:
        raise NotImplementedError

    @abstractmethod
    def get_variables(self, request_id: str) -> dict[str, str] | None:
        raise NotImplementedError


class ContextStateRepository(ABC):
    @abstractmethod
    def get_current_step(self, request_id: str) -> str | None:
        raise NotImplementedError

    @abstractmethod
    def get_attempt_count(self, request_id: str) -> int | None:
        raise NotImplementedError

    @abstractmethod
    def get_previous_result_ids(self, request_id: str) -> list[str] | None:
        raise NotImplementedError

    @abstractmethod
    def is_escalation_required(self, request_id: str) -> bool | None:
        raise NotImplementedError

    @abstractmethod
    def get_human_approval_status(self, request_id: str) -> str | None:
        raise NotImplementedError

    @abstractmethod
    def get_human_approver_id(self, request_id: str) -> str | None:
        raise NotImplementedError

    @abstractmethod
    def get_human_approval_at(self, request_id: str) -> datetime | None:
        raise NotImplementedError


class SSOTTraceRepository(ABC):
    @abstractmethod
    def get_snapshot_id(self, ssot_record_id: str, ssot_record_version: str) -> str | None:
        raise NotImplementedError


class ContextResolver(ABC):
    @abstractmethod
    def resolve(self, request: OrchestrationRequest) -> OrchestrationContext:
        raise NotImplementedError


class ContextDataRepository(ABC):
    @abstractmethod
    def get_session_id(self, request_id: str) -> str | None:
        raise NotImplementedError

    @abstractmethod
    def get_environment(self, request_id: str) -> str | None:
        raise NotImplementedError

    @abstractmethod
    def get_feature_flags(self, request_id: str) -> dict[str, bool] | None:
        raise NotImplementedError

    @abstractmethod
    def get_variables(self, request_id: str) -> dict[str, str] | None:
        raise NotImplementedError

    @abstractmethod
    def get_current_step(self, request_id: str) -> str | None:
        raise NotImplementedError

    @abstractmethod
    def get_attempt_count(self, request_id: str) -> int | None:
        raise NotImplementedError

    @abstractmethod
    def get_previous_result_ids(self, request_id: str) -> list[str] | None:
        raise NotImplementedError

    @abstractmethod
    def is_escalation_required(self, request_id: str) -> bool | None:
        raise NotImplementedError

    @abstractmethod
    def get_human_approval_status(self, request_id: str) -> str | None:
        raise NotImplementedError

    @abstractmethod
    def get_human_approver_id(self, request_id: str) -> str | None:
        raise NotImplementedError

    @abstractmethod
    def get_human_approval_at(self, request_id: str) -> datetime | None:
        raise NotImplementedError

    @abstractmethod
    def get_ssot_snapshot_id(self, request_id: str) -> str | None:
        raise NotImplementedError


class ReadOnlyDataTool(ABC):
    """
    Tool contract for deterministic, read-only data retrieval.
    """

    @property
    @abstractmethod
    def tool_id(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def fetch(self, query: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError


class RuleCheckTool(ABC):
    """
    Tool contract for policy/rule evaluation that returns a pass/fail decision.
    """

    @property
    @abstractmethod
    def tool_id(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def check(self, facts: dict[str, Any]) -> bool:
        raise NotImplementedError


class ComputationTool(ABC):
    """
    Tool contract for pure computations over provided inputs.
    """

    @property
    @abstractmethod
    def tool_id(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def compute(self, inputs: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError
