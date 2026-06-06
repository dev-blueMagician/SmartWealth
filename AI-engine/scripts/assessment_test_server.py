from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel, Field

from app.api.routes.internal_workflow import router as internal_workflow_router
from app.adapters.audit.postgres_audit_logger import PostgresAuditLogger
from app.domain.smartwealth.interfaces.ports import ContextDataRepository
from app.infrastructure.config.settings import Settings
from app.domain.smartwealth.models import ActorType, AuditEvent, OrchestrationRequest
from app.orchestration.smartwealth import (
    RepositoryBackedContextResolver,
    build_catalog_assessment_orchestrator,
)


class ExecuteAssessmentDemoRequest(BaseModel):
    request_id: str
    workflow_id: str = "wf-assessment-demo"
    user_id: str = "user-001"
    correlation_id: str = "corr-001"
    input_text: str = "Assess onboarding completeness"
    input_language: str = "en"
    source_channel: str = "api"
    priority: int = 1
    confidence_threshold: float = 0.8
    human_approval_required: bool = False
    ssot_record_id: str = "record-001"
    ssot_record_type: str = "onboarding"
    ssot_record_version: str = "v1"
    ssot_correlation_id: str = "ssot-corr-001"
    mock_runtime: dict[str, Any] = Field(default_factory=dict)


class MockContextDataRepository(ContextDataRepository):
    """
    Mock SSOT/context runtime for local testing.
    Override values via request.mock_runtime.
    """

    def __init__(self, runtime: dict[str, Any]) -> None:
        self.runtime = runtime

    def _get(self, key: str, default: Any) -> Any:
        return self.runtime.get(key, default)

    def get_session_id(self, request_id: str) -> str | None:
        _ = request_id
        return self._get("session_id", "session-001")

    def get_environment(self, request_id: str) -> str | None:
        _ = request_id
        return self._get("environment", "dev")

    def get_feature_flags(self, request_id: str) -> dict[str, bool] | None:
        _ = request_id
        return self._get("feature_flags", {"onboarding_completeness_enabled": True})

    def get_variables(self, request_id: str) -> dict[str, str] | None:
        _ = request_id
        return self._get("variables", {"customer_id": "C001"})

    def get_current_step(self, request_id: str) -> str | None:
        _ = request_id
        return self._get("current_step", "onboarding")

    def get_attempt_count(self, request_id: str) -> int | None:
        _ = request_id
        return self._get("attempt_count", 1)

    def get_previous_result_ids(self, request_id: str) -> list[str] | None:
        _ = request_id
        return self._get("previous_result_ids", [])

    def is_escalation_required(self, request_id: str) -> bool | None:
        _ = request_id
        return self._get("escalation_required", False)

    def get_human_approval_status(self, request_id: str) -> str | None:
        _ = request_id
        return self._get("human_approval_status", "NOT_REQUIRED")

    def get_human_approver_id(self, request_id: str) -> str | None:
        _ = request_id
        return self._get("human_approver_id", None)

    def get_human_approval_at(self, request_id: str):
        _ = request_id
        return self._get("human_approval_at", None)

    def get_ssot_snapshot_id(self, request_id: str) -> str | None:
        _ = request_id
        return self._get("ssot_snapshot_id", "snap-001")


app = FastAPI(title="Assessment demo server")
app.include_router(internal_workflow_router)
_settings = Settings()
audit_logger = PostgresAuditLogger(_settings.resolved_database_url)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/assessment/execute")
def execute_assessment_demo(req: ExecuteAssessmentDemoRequest) -> dict[str, Any]:
    audit_logger.append(
        AuditEvent(
            workflow_id=req.workflow_id,
            event_type="HTTP_REQUEST_RECEIVED",
            actor_type=ActorType.SYSTEM,
            actor_id="api_handler",
            payload={"request_id": req.request_id},
        )
    )

    context_repository = MockContextDataRepository({"session_id": "123123"})
    resolver = RepositoryBackedContextResolver(context_repository)

    orchestrator = build_catalog_assessment_orchestrator(
        context_resolver=resolver,
        settings=Settings(),
    )

    orchestration_request = OrchestrationRequest(
        request_id=req.request_id,
        workflow_id=req.workflow_id,
        user_id=req.user_id,
        correlation_id=req.correlation_id,
        input_text=req.input_text,
        input_language=req.input_language,
        source_channel=req.source_channel,
        priority=req.priority,
        requested_at=datetime.now(timezone.utc),
        confidence_threshold=req.confidence_threshold,
        human_approval_required=req.human_approval_required,
        ssot_record_id=req.ssot_record_id,
        ssot_record_type=req.ssot_record_type,
        ssot_record_version=req.ssot_record_version,
        ssot_correlation_id=req.ssot_correlation_id,
        assessment_code="onboarding_completeness",
    )

    result = orchestrator.Execute(orchestration_request)
    findings = json.loads(result.output_text)

    audit_logger.append(
        AuditEvent(
            workflow_id=req.workflow_id,
            event_type="ONBOARDING_COMPLETENESS_EXECUTED",
            actor_type=ActorType.AGENT,
            actor_id=result.model,
            payload={
                "decision": result.decision.value,
                "missing_items": findings.get("missing_items", []),
                "is_complete": findings.get("is_complete"),
            },
        )
    )

    return {
        "result_id": result.result_id,
        "request_id": result.request_id,
        "step_name": result.step_name,
        "provider": result.provider,
        "model": result.model,
        "decision": result.decision.value,
        "decision_reason": result.decision_reason,
        "confidence_score": result.confidence_score,
        "confidence_threshold": result.confidence_threshold,
        "trace_id": result.trace_id,
        "produced_at": result.produced_at.isoformat(),
        "findings": findings,
    }


@app.get("/api/v1/assessment/audit/{workflow_id}")
def get_audit(workflow_id: str) -> list[dict[str, Any]]:
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


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8010)
