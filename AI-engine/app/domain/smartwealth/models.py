from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4


class WorkflowStatus(str, Enum):
    RECEIVED = "RECEIVED"
    VALIDATED = "VALIDATED"
    DRAFTED = "DRAFTED"
    PENDING_HUMAN_APPROVAL = "PENDING_HUMAN_APPROVAL"
    HUMAN_APPROVED = "HUMAN_APPROVED"
    HUMAN_REJECTED = "HUMAN_REJECTED"


class ActorType(str, Enum):
    ORCHESTRATOR = "ORCHESTRATOR"
    AGENT = "AGENT"
    TOOL = "TOOL"
    HUMAN = "HUMAN"
    SYSTEM = "SYSTEM"


class WorkflowTriggerSource(str, Enum):
    SYSTEM = "SYSTEM"
    USER = "USER"


@dataclass(slots=True)
class WorkflowEvent:
    entity_type: str
    entity_id: str
    from_state: str
    to_state: str
    triggered_by: WorkflowTriggerSource
    occurred_at: datetime


class DecisionStatus(str, Enum):
    DRAFT = "DRAFT"
    STOP = "STOP"
    ESCALATE = "ESCALATE"


@dataclass(slots=True)
class AuditEvent:
    workflow_id: str
    event_type: str
    actor_type: ActorType
    actor_id: str
    payload: dict[str, Any]
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    event_id: str = field(default_factory=lambda: str(uuid4()))


@dataclass(frozen=True, slots=True)
class InteractionCatalogView:
    """Snapshot of ``loop_input`` plus derived fields for runtime (e.g. catalog-driven tools)."""

    loop_input: dict[str, object]
    catalog_tool_ids: tuple[str, ...]


@dataclass(slots=True)
class OrchestrationRequest:
    request_id: str
    workflow_id: str
    user_id: str
    correlation_id: str
    input_text: str
    input_language: str
    source_channel: str
    priority: int
    requested_at: datetime
    confidence_threshold: float
    human_approval_required: bool
    ssot_record_id: str
    ssot_record_type: str
    ssot_record_version: str
    ssot_correlation_id: str
    assessment_code: str = "onboarding_completeness"


@dataclass(slots=True)
class OrchestrationContext:
    context_id: str
    request_id: str
    session_id: str
    current_step: str
    attempt_count: int
    environment: str
    feature_flags: dict[str, bool]
    variables: dict[str, str]
    previous_result_ids: list[str]
    escalation_required: bool
    confidence_threshold: float
    human_approval_required: bool
    human_approval_status: str
    human_approver_id: str
    human_approval_at: datetime | None
    ssot_record_id: str
    ssot_record_type: str
    ssot_record_version: str
    ssot_snapshot_id: str
    assessment_code: str
    catalog: InteractionCatalogView
    input_text: str = ""
    input_language: str = "en"


@dataclass(slots=True)
class AIResult:
    result_id: str
    request_id: str
    step_name: str
    provider: str
    model: str
    output_text: str
    confidence_score: float
    confidence_threshold: float
    decision: DecisionStatus
    decision_reason: str
    latency_ms: int
    input_tokens: int
    output_tokens: int
    produced_at: datetime
    trace_id: str
    safety_flagged: bool
    safety_category: str
    human_approval_required: bool
    human_approval_status: str
    approved_by_user_id: str
    approved_at: datetime | None
    ssot_record_id: str
    ssot_record_type: str
    ssot_record_version: str
    ssot_snapshot_id: str


@dataclass(slots=True)
class AuditRecord:
    record_id: str
    request_id: str
    context_id: str
    event_type: str
    event_action: str
    actor_type: ActorType
    actor_id: str
    status: DecisionStatus
    message: str
    changed_field: str
    old_value: str
    new_value: str
    occurred_at: datetime
    correlation_id: str
    confidence_threshold: float
    human_approval_required: bool
    human_approval_status: str
    human_approver_id: str
    ssot_record_id: str
    ssot_record_type: str
    ssot_record_version: str
    ssot_snapshot_id: str


@dataclass(slots=True)
class AIDraft:
    content: str
    source_fields: list[str]
    generated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(slots=True)
class WorkflowState:
    workflow_id: str
    status: WorkflowStatus
    input_payload: dict[str, Any]
    ai_draft: AIDraft | None = None
    human_decision: dict[str, Any] | None = None
    version: int = 1
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def bump_version(self) -> None:
        self.version += 1
        self.updated_at = datetime.now(timezone.utc)
