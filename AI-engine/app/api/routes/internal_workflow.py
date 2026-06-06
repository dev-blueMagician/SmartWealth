from __future__ import annotations

import hmac
from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from app.domain.smartwealth.interfaces.ports import AuditLogger
from app.domain.smartwealth.models import WorkflowEvent, WorkflowTriggerSource
from app.infrastructure.config.settings import Settings
from app.infrastructure.container import container
from app.orchestration.assessment.codes import AssessmentCode
from app.orchestration.smartwealth.graph import SmartWealthOrchestrator

router = APIRouter(prefix="/internal/workflow", tags=["internal-workflow"])


def get_settings() -> Settings:
    return container.settings


def get_orchestrator() -> SmartWealthOrchestrator:
    return container.orchestrator


def get_audit_logger() -> AuditLogger:
    return container.audit_logger


def verify_internal_workflow_call(
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
    x_internal_token: Annotated[str | None, Header(alias="X-Internal-Token")] = None,
) -> None:
    expected = settings.internal_workflow_event_token
    if not expected:
        raise HTTPException(status_code=503, detail="Internal workflow ingress is not configured.")
    provided = x_internal_token
    if provided is None and authorization and authorization.lower().startswith("bearer "):
        provided = authorization[7:].strip()
    if not provided:
        raise HTTPException(status_code=401, detail="Missing credentials.")
    if not hmac.compare_digest(provided.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(status_code=403, detail="Invalid credentials.")


class WorkflowStateChangedRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entity_type: str = Field(min_length=1)
    entity_id: str = Field(min_length=1)
    from_state: str = Field(min_length=1)
    to_state: str = Field(min_length=1)
    triggered_by: WorkflowTriggerSource
    occurred_at: datetime


class WorkflowStateChangedResponse(BaseModel):
    status: Literal["accepted"] = "accepted"
    workflow_id: str = Field(description="Same as request entity_id; key for audit lookup.")
    audit_event_id: str = Field(description="Id of the ENTITY_STATE_CHANGED audit row.")
    event_type: str = Field(default="ENTITY_STATE_CHANGED")


class ProcessAiEventsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    limit: int = Field(default=20, ge=1, le=500)


class SeedWorkflowFixturesBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    workflow_id: str = Field(
        min_length=1,
        description="Workflow UUID from /api/v1/workflows to keep queue seeding linked.",
    )
    request_id: str | None = Field(
        default=None,
        description="Optional UUID. If omitted, endpoint generates one.",
    )
    assessment_code: str = Field(
        default=AssessmentCode.ONBOARDING_COMPLETENESS.value,
        min_length=1,
    )
    to_states: list[str] = Field(
        default_factory=lambda: ["READY_FOR_VALIDATION"],
        description="State list to upsert in workflow_ai_trigger and optionally enqueue events.",
    )
    seed_events: bool = Field(
        default=True,
        description="When true, inserts one workflow_event per state transition.",
    )
    start_from_state: str = Field(
        default="DATA_CAPTURE",
        min_length=1,
        description="Initial from_state for the first seeded event.",
    )


@router.post("/process-ai-events")
def post_process_ai_events(
    body: ProcessAiEventsBody = ProcessAiEventsBody(),
    _auth: None = Depends(verify_internal_workflow_call),
) -> dict[str, Any]:
    """
    Queue drain: workflow_event → workflow_ai_trigger (to_state → assessment_code from DB) →
    registered runners only → latest orchestration_request by workflow_id → ai_result + ai_finding.
    orchestration_request is a single table (request + runtime context + ssot_snapshot_id).
    Apply orchestration_minimal.sql then workflow_ai_pipeline.sql (+ seed trigger).
    """
    try:
        return container.workflow_ai_event_processor.process_pending(limit=body.limit)
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "PostgreSQL driver not installed. Run: pip install 'psycopg[binary]' "
                f"(import error: {exc})"
            ),
        ) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Database unavailable: {exc}",
        ) from exc


@router.post("/seed-fixtures")
def post_seed_workflow_fixtures(
    body: SeedWorkflowFixturesBody,
    _auth: None = Depends(verify_internal_workflow_call),
) -> dict[str, Any]:
    """
    Seed queue fixtures for workflow AI processing.

    Mirrors sample SQL seeds by creating/updating one orchestration_request,
    upserting workflow_ai_trigger rows for requested states, and optionally
    inserting workflow_event rows so /process-ai-events can consume them.

    Idempotence:
    - orchestration_request uses a deterministic request_id per workflow when omitted.
    - workflow_event inserts are skipped when this workflow_id already has a *pending*
      row (processed_at IS NULL) with the same from_state → to_state.
    Response includes skipped_duplicate_pending_events when any transition was skipped.
    """
    try:
        return container.workflow_seed_service.seed_queue_fixtures(
            workflow_id=body.workflow_id,
            request_id=body.request_id,
            assessment_code=body.assessment_code,
            to_states=body.to_states,
            seed_events=body.seed_events,
            start_from_state=body.start_from_state,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "PostgreSQL driver not installed. Run: pip install 'psycopg[binary]' "
                f"(import error: {exc})"
            ),
        ) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Database unavailable: {exc}",
        ) from exc


@router.post("/state-changed", response_model=WorkflowStateChangedResponse)
def post_workflow_state_changed(
    body: WorkflowStateChangedRequest,
    _auth: None = Depends(verify_internal_workflow_call),
    orchestrator: SmartWealthOrchestrator = Depends(get_orchestrator),
) -> WorkflowStateChangedResponse:
    event = WorkflowEvent(
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        from_state=body.from_state,
        to_state=body.to_state,
        triggered_by=body.triggered_by,
        occurred_at=body.occurred_at,
    )
    outcome = orchestrator.handleWorkflowEvent(event)
    return WorkflowStateChangedResponse(
        workflow_id=str(outcome["workflow_id"]),
        audit_event_id=str(outcome["audit_event_id"]),
        event_type=str(outcome["event_type"]),
    )


@router.get("/orchestration-seed-hints/{workflow_id}")
def get_orchestration_seed_hints(
    workflow_id: str,
    assessment_code: str = Query(
        default=AssessmentCode.ONBOARDING_COMPLETENESS.value,
        min_length=1,
    ),
    _auth: None = Depends(verify_internal_workflow_call),
) -> dict[str, Any]:
    """
    UI hints for seed-fixtures: latest orchestration_request row for workflow_id plus
    from_state / to_states from the latest workflow_event whose to_state maps to this
    assessment_code via workflow_ai_trigger; if none, defaults + trigger to_states.
    """
    try:
        return container.workflow_orchestration_context_service.get_seed_hints(
            workflow_id=workflow_id,
            assessment_code=assessment_code,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "PostgreSQL driver not installed. Run: pip install 'psycopg[binary]' "
                f"(import error: {exc})"
            ),
        ) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Database unavailable: {exc}",
        ) from exc


@router.get("/audit/{workflow_id}")
def get_internal_workflow_audit(
    workflow_id: str,
    _auth: None = Depends(verify_internal_workflow_call),
    audit_logger: AuditLogger = Depends(get_audit_logger),
) -> list[dict]:
    """List persisted workflow audit events for workflow_id (matches entity_id on state-changed)."""
    events = audit_logger.list_by_workflow(workflow_id)
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
