from __future__ import annotations

from app.domain.smartwealth.interaction_catalog import (
    INTERACTIONS,
    OrchestratorHook,
    ORCHESTRATOR_COLUMN_BINDING,
    InteractionSpec,
    get_interaction_spec,
    spec_to_catalog_view,
)
from app.orchestration.assessment.codes import AssessmentCode


def test_catalog_has_full_register() -> None:
    assert len(INTERACTIONS) == len(AssessmentCode)
    assert AssessmentCode.ONBOARDING_COMPLETENESS.value in INTERACTIONS
    assert AssessmentCode.ASSESSMENT_34.value in INTERACTIONS
    assert AssessmentCode.CLIENT_PROFILE_CONTEXT.value in INTERACTIONS


def test_onboarding_completeness_spec_matches_assessment_code_enum() -> None:
    spec = get_interaction_spec(AssessmentCode.ONBOARDING_COMPLETENESS.value)
    assert spec is not None
    assert spec.loop_input["request_type"] == "ASSESS_ONBOARDING_COMPLETENESS"


def test_orchestrator_binding_covers_execute_and_gate() -> None:
    assert "loop_input" in ORCHESTRATOR_COLUMN_BINDING[OrchestratorHook.EXECUTE_AGENT]
    assert "stop_escalate" in ORCHESTRATOR_COLUMN_BINDING[OrchestratorHook.APPLY_CONFIDENCE_GATE]


def test_spec_to_catalog_view_tools_list() -> None:
    spec = InteractionSpec(
        loop_input={"interaction_id": "x", "tools": [" a ", "b", "", 99, "c"]},
    )
    v = spec_to_catalog_view(spec)
    assert v.catalog_tool_ids == ("a", "b", "c")


def test_spec_to_catalog_view_tools_string() -> None:
    spec = InteractionSpec(loop_input={"tools": "  client_profile_sql_tool  "})
    v = spec_to_catalog_view(spec)
    assert v.catalog_tool_ids == ("client_profile_sql_tool",)


def test_spec_to_catalog_view_tools_missing_or_invalid() -> None:
    assert spec_to_catalog_view(InteractionSpec(loop_input={})).catalog_tool_ids == ()
    assert spec_to_catalog_view(InteractionSpec(loop_input={"tools": None})).catalog_tool_ids == ()
    assert spec_to_catalog_view(InteractionSpec(loop_input={"tools": {}})).catalog_tool_ids == ()
