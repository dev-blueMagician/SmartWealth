from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime, timezone

from app.domain.smartwealth.interaction_catalog import get_interaction_spec, spec_to_catalog_view
from app.domain.smartwealth.models import DecisionStatus, InteractionCatalogView, OrchestrationContext
from app.orchestration.smartwealth.agents.completeness_agent import CompletenessAgent


def _default_catalog_view():
    spec = get_interaction_spec("onboarding_completeness")
    assert spec is not None
    return spec_to_catalog_view(spec)


def _build_context(**overrides: object) -> OrchestrationContext:
    base = {
        "context_id": "ctx-001",
        "request_id": "req-001",
        "session_id": "sess-001",
        "current_step": "completeness_check",
        "attempt_count": 1,
        "environment": "dev",
        "feature_flags": {"new_flow": True},
        "variables": {"customer_id": "C001"},
        "previous_result_ids": [],
        "escalation_required": False,
        "confidence_threshold": 0.9,
        "human_approval_required": False,
        "human_approval_status": "NOT_REQUIRED",
        "human_approver_id": "",
        "human_approval_at": None,
        "ssot_record_id": "ssot-001",
        "ssot_record_type": "profile",
        "ssot_record_version": "v1",
        "ssot_snapshot_id": "snap-001",
        "assessment_code": "onboarding_completeness",
        "catalog": _default_catalog_view(),
    }
    base.update(overrides)
    return OrchestrationContext(**base)


def test_completeness_agent_returns_findings_when_required_fields_missing() -> None:
    agent = CompletenessAgent()
    context = _build_context(session_id="", variables={})

    result = agent.execute(context)

    payload = json.loads(result.output_text)
    assert result.decision == DecisionStatus.DRAFT
    assert payload["is_complete"] is False
    assert set(payload["missing_items"]) == {"session_id", "variables"}
    assert (
        result.decision_reason
        == "Agent provides findings only; workflow outcome is decided by policy and gating."
    )
    assert result.step_name == "assess_catalog_interaction"


def test_completeness_agent_returns_draft_when_required_fields_present() -> None:
    agent = CompletenessAgent()
    context = _build_context(human_approval_at=datetime.now(timezone.utc))

    result = agent.execute(context)

    payload = json.loads(result.output_text)
    assert result.decision == DecisionStatus.DRAFT
    assert payload["is_complete"] is True
    assert payload["missing_items"] == []


def test_completeness_agent_does_not_mutate_context() -> None:
    agent = CompletenessAgent()
    context = _build_context()
    before = asdict(context)

    _ = agent.execute(context)

    after = asdict(context)
    assert after == before


def test_completeness_agent_execute_with_tools_skips_when_no_catalog_tools() -> None:
    agent = CompletenessAgent()
    context = _build_context()
    called: list[str] = []

    def execute_tool(name: str, inp: dict) -> dict:
        called.append(name)
        return {}

    result = agent.execute_with_tools(context, execute_tool)
    assert called == []
    assert "catalog_tools_executed" not in json.loads(result.output_text)


def test_completeness_agent_execute_with_tools_merges_enrichment() -> None:
    agent = CompletenessAgent()
    catalog = InteractionCatalogView(
        loop_input={"tools": ["ssot_lookup_tool"]},
        catalog_tool_ids=("ssot_lookup_tool",),
    )
    context = _build_context(catalog=catalog)
    called: list[str] = []

    def execute_tool(name: str, inp: dict) -> dict:
        called.append(name)
        return {"values": {"customer_id": "C001"}, "missing_fields": ["case_id"]}

    result = agent.execute_with_tools(context, execute_tool)
    assert called == ["ssot_lookup_tool"]
    payload = json.loads(result.output_text)
    assert payload["catalog_tools_executed"] == ["ssot_lookup_tool"]
    assert payload["tool_enrichment"]["values"]["customer_id"] == "C001"
    assert payload["is_complete"] is True


def test_completeness_injects_profile_chat_patch_tool_when_update_intent() -> None:
    agent = CompletenessAgent()
    context = _build_context(
        variables={
            "customer_id": "C001",
            "chat_intent": "UPDATE_INFORMATION",
            "case_id": "00000000-0000-0000-0000-000000000001",
            "client_id": "00000000-0000-0000-0000-000000000002",
        },
        assessment_code="onboarding_completeness",
    )
    called: list[str] = []

    def execute_tool(name: str, inp: dict) -> dict:
        called.append(name)
        return {"skipped": True, "reason": "test"}

    agent.execute_with_tools(context, execute_tool)
    assert called[0] == "client_profile_chat_patch_tool"
