from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import MagicMock

from app.domain.smartwealth.interaction_catalog import get_interaction_spec, spec_to_catalog_view
from app.domain.smartwealth.models import DecisionStatus, InteractionCatalogView, OrchestrationContext
from app.infrastructure.llm.types import LlmChatResult
from app.orchestration.smartwealth.agents.completeness_llm_agent import CompletenessLlmAgent


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
        "input_text": "Please assess completeness.",
        "input_language": "en",
    }
    base.update(overrides)
    return OrchestrationContext(**base)


def test_completeness_llm_agent_appends_llm_assistant() -> None:
    llm = MagicMock()
    llm.chat.return_value = LlmChatResult(
        text="Mock narrative.",
        model="deepseek-chat",
        input_tokens=12,
        output_tokens=3,
        raw={},
    )
    agent = CompletenessLlmAgent(llm)
    context = _build_context()

    result = agent.execute(context)

    payload = json.loads(result.output_text)
    assert result.provider == "deepseek"
    assert result.model == "deepseek-chat"
    assert payload["llm_assistant"] == "Mock narrative."
    assert payload["missing_items"] == []
    assert result.decision == DecisionStatus.STOP
    assert result.input_tokens == 12
    assert result.output_tokens == 3
    llm.chat.assert_called_once()
    call_kw = llm.chat.call_args.kwargs
    assert "ASSESS_ONBOARDING_COMPLETENESS" in call_kw["system"]
    assert "C001" in call_kw["user"]
    assert "Please assess completeness." in call_kw["user"]


def test_completeness_llm_agent_works_without_input_text() -> None:
    llm = MagicMock()
    llm.chat.return_value = LlmChatResult(
        text="ok",
        model="deepseek-chat",
        input_tokens=1,
        output_tokens=1,
        raw={},
    )
    agent = CompletenessLlmAgent(llm)
    context = _build_context(input_text="", human_approval_at=datetime.now(timezone.utc))

    result = agent.execute(context)

    assert json.loads(result.output_text)["llm_assistant"] == "ok"
    assert result.decision == DecisionStatus.STOP
    assert "OrchestrationRequest.input_text" not in llm.chat.call_args.kwargs["user"]


def test_completeness_llm_agent_decision_draft_when_llm_empty() -> None:
    llm = MagicMock()
    llm.chat.return_value = LlmChatResult(
        text="   ",
        model="deepseek-chat",
        input_tokens=0,
        output_tokens=0,
        raw={},
    )
    agent = CompletenessLlmAgent(llm)
    context = _build_context()

    result = agent.execute(context)

    assert result.decision == DecisionStatus.DRAFT
    assert "empty" in result.decision_reason.lower()


def test_completeness_llm_agent_decision_draft_when_structurally_incomplete() -> None:
    llm = MagicMock()
    llm.chat.return_value = LlmChatResult(
        text="Some narrative.",
        model="deepseek-chat",
        input_tokens=1,
        output_tokens=1,
        raw={},
    )
    agent = CompletenessLlmAgent(llm)
    context = _build_context(variables={})

    result = agent.execute(context)

    payload = json.loads(result.output_text)
    assert payload.get("is_complete") is False
    assert result.decision == DecisionStatus.DRAFT


def test_completeness_llm_agent_decision_escalate_when_flagged() -> None:
    llm = MagicMock()
    llm.chat.return_value = LlmChatResult(
        text="ok",
        model="deepseek-chat",
        input_tokens=1,
        output_tokens=1,
        raw={},
    )
    agent = CompletenessLlmAgent(llm)
    context = _build_context(escalation_required=True)

    result = agent.execute(context)

    assert result.decision == DecisionStatus.ESCALATE


def test_completeness_llm_agent_execute_with_tools_runs_tools_before_llm() -> None:
    llm = MagicMock()
    llm.chat.return_value = LlmChatResult(
        text="Narrative after tools.",
        model="deepseek-chat",
        input_tokens=2,
        output_tokens=2,
        raw={},
    )
    agent = CompletenessLlmAgent(llm)
    catalog = InteractionCatalogView(
        loop_input={"tools": ["ssot_lookup_tool"]},
        catalog_tool_ids=("ssot_lookup_tool",),
    )
    context = _build_context(catalog=catalog)
    tool_calls: list[str] = []

    def execute_tool(name: str, inp: dict) -> dict:
        tool_calls.append(name)
        return {"values": {"customer_id": "C001"}, "missing_fields": []}

    result = agent.execute_with_tools(context, execute_tool)

    assert tool_calls == ["ssot_lookup_tool"]
    payload = json.loads(result.output_text)
    assert payload["catalog_tools_executed"] == ["ssot_lookup_tool"]
    assert payload["llm_assistant"] == "Narrative after tools."
    llm.chat.assert_called_once()
