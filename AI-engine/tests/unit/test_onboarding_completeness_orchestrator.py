from __future__ import annotations

import json
from datetime import datetime, timezone

from app.domain.smartwealth.interfaces.ports import ContextDataRepository
from app.domain.smartwealth.models import DecisionStatus, OrchestrationRequest
from app.infrastructure.config.settings import Settings
from app.orchestration.assessment.codes import AssessmentCode
from app.orchestration.smartwealth import (
    RepositoryBackedContextResolver,
    build_catalog_assessment_orchestrator,
)


class StubContextDataRepository(ContextDataRepository):
    def __init__(self, *, variables: dict[str, str] | None = None) -> None:
        self._variables = variables

    def get_session_id(self, request_id: str) -> str | None:
        _ = request_id
        return "session-001"

    def get_environment(self, request_id: str) -> str | None:
        _ = request_id
        return "dev"

    def get_feature_flags(self, request_id: str) -> dict[str, bool] | None:
        _ = request_id
        return {"onboarding_completeness_enabled": True}

    def get_variables(self, request_id: str) -> dict[str, str] | None:
        _ = request_id
        return self._variables if self._variables is not None else {"customer_id": "C001"}

    def get_current_step(self, request_id: str) -> str | None:
        _ = request_id
        return "onboarding"

    def get_attempt_count(self, request_id: str) -> int | None:
        _ = request_id
        return 1

    def get_previous_result_ids(self, request_id: str) -> list[str] | None:
        _ = request_id
        return []

    def is_escalation_required(self, request_id: str) -> bool | None:
        _ = request_id
        return False

    def get_human_approval_status(self, request_id: str) -> str | None:
        _ = request_id
        return "NOT_REQUIRED"

    def get_human_approver_id(self, request_id: str) -> str | None:
        _ = request_id
        return None

    def get_human_approval_at(self, request_id: str) -> datetime | None:
        _ = request_id
        return None

    def get_ssot_snapshot_id(self, request_id: str) -> str | None:
        _ = request_id
        return "snap-001"


def _build_request(
    *, assessment_code: str | None = None
) -> OrchestrationRequest:
    code = (
        assessment_code
        if assessment_code is not None
        else AssessmentCode.ONBOARDING_COMPLETENESS.value
    )
    return OrchestrationRequest(
        request_id="req-001",
        workflow_id="wf-001",
        user_id="user-001",
        correlation_id="corr-001",
        input_text="Assess onboarding completeness",
        input_language="en",
        source_channel="web",
        priority=1,
        requested_at=datetime.now(timezone.utc),
        confidence_threshold=0.8,
        human_approval_required=False,
        ssot_record_id="record-001",
        ssot_record_type="onboarding",
        ssot_record_version="v1",
        ssot_correlation_id="ssot-corr-001",
        assessment_code=code,
    )


def test_onboarding_completeness_orchestrator_routes_to_completeness_agent() -> None:
    resolver = RepositoryBackedContextResolver(StubContextDataRepository())
    orchestrator = build_catalog_assessment_orchestrator(
        context_resolver=resolver,
        settings=Settings(assessment_llm_enabled=False),
    )

    result = orchestrator.Execute(_build_request())
    payload = json.loads(result.output_text)

    assert result.model == "completeness_agent"
    assert result.step_name == "assess_catalog_interaction"
    assert result.decision == DecisionStatus.DRAFT
    assert payload["assessment_id"] == AssessmentCode.ONBOARDING_COMPLETENESS.value
    assert payload["missing_items"] == []


def test_orchestrator_runs_client_explain_when_request_uses_that_code() -> None:
    resolver = RepositoryBackedContextResolver(StubContextDataRepository())
    orchestrator = build_catalog_assessment_orchestrator(
        context_resolver=resolver,
        settings=Settings(assessment_llm_enabled=False),
    )
    code = AssessmentCode.CLIENT_EXPLAIN_ONBOARDING.value
    result = orchestrator.Execute(_build_request(assessment_code=code))
    payload = json.loads(result.output_text)
    assert payload["assessment_id"] == code
    assert payload["assessment_name"] == code


def test_catalog_pipeline_routes_document_agent_for_ai03() -> None:
    resolver = RepositoryBackedContextResolver(StubContextDataRepository())
    orchestrator = build_catalog_assessment_orchestrator(
        context_resolver=resolver,
        settings=Settings(assessment_llm_enabled=False),
    )
    result = orchestrator.Execute(_build_request(assessment_code=AssessmentCode.DOCUMENT_REQUEST_DRAFT.value))
    payload = json.loads(result.output_text)
    assert result.model == "document_agent"
    assert result.step_name == "document_catalog_assessment"
    assert payload["agent_role"] == "document_intake"
    assert payload["assessment_id"] == AssessmentCode.DOCUMENT_REQUEST_DRAFT.value
    assert payload["catalog_tools_executed"] == ["ssot_lookup_tool"]
    assert payload["tool_enrichment"]["values"]["customer_id"] == "C001"
    assert sorted(payload["tool_enrichment"]["missing_fields"]) == ["case_id", "client_id"]


def test_catalog_pipeline_routes_search_agent_via_variables_override() -> None:
    resolver = RepositoryBackedContextResolver(
        StubContextDataRepository(variables={"customer_id": "C001", "catalog_agent": "search_agent"}),
    )
    orchestrator = build_catalog_assessment_orchestrator(
        context_resolver=resolver,
        settings=Settings(assessment_llm_enabled=False),
    )
    result = orchestrator.Execute(_build_request())
    payload = json.loads(result.output_text)
    assert result.model == "search_agent"
    assert payload["agent_role"] == "knowledge_search"
    assert payload["catalog_tools_executed"] == ["client_profile_sql_tool"]
    te = payload["tool_enrichment"]
    assert isinstance(te, dict)
    assert te.get("profile_snapshot") is None
    assert te.get("error") and "case_id" in te["error"].lower()


def test_onboarding_completeness_orchestrator_reports_missing_items_explicitly() -> None:
    resolver = RepositoryBackedContextResolver(
        StubContextDataRepository(variables={}),
    )
    orchestrator = build_catalog_assessment_orchestrator(
        context_resolver=resolver,
        settings=Settings(assessment_llm_enabled=False),
    )

    result = orchestrator.Execute(_build_request())
    payload = json.loads(result.output_text)

    assert result.decision == DecisionStatus.DRAFT
    assert payload["is_complete"] is False
    assert payload["missing_items"] == ["variables"]
