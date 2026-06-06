from __future__ import annotations

import json

from app.domain.smartwealth.models import InteractionCatalogView, OrchestrationContext
from app.orchestration.smartwealth.agents.search_agent import SearchAgent


def _ctx(*, catalog_tool_ids: tuple[str, ...], variables: dict[str, str] | None = None) -> OrchestrationContext:
    catalog = InteractionCatalogView(loop_input={}, catalog_tool_ids=catalog_tool_ids)
    return OrchestrationContext(
        context_id="ctx-1",
        request_id="req-1",
        session_id="sess-1",
        current_step="s",
        attempt_count=1,
        environment="dev",
        feature_flags={},
        variables=variables or {"customer_id": "C001"},
        previous_result_ids=[],
        escalation_required=False,
        confidence_threshold=0.9,
        human_approval_required=False,
        human_approval_status="NONE",
        human_approver_id="",
        human_approval_at=None,
        ssot_record_id="ssot-1",
        ssot_record_type="t",
        ssot_record_version="v1",
        ssot_snapshot_id="snap-1",
        assessment_code="client_profile_context",
        catalog=catalog,
        input_text="q",
        input_language="en",
    )


def test_search_agent_uses_catalog_tools_when_set() -> None:
    calls: list[tuple[str, dict[str, object]]] = []

    def execute_tool(name: str, inp: dict[str, object]) -> dict[str, object]:
        calls.append((name, inp))
        if name == "ssot_lookup_tool":
            return {"values": {"x": 1}, "missing_fields": []}
        return {"profile_snapshot": {"id": "p1"}, "error": None}

    agent = SearchAgent()
    ctx = _ctx(catalog_tool_ids=("ssot_lookup_tool", "client_profile_sql_tool"))
    result = agent.execute_with_tools(ctx, execute_tool)
    payload = json.loads(result.output_text)

    assert [c[0] for c in calls] == ["ssot_lookup_tool", "client_profile_sql_tool"]
    assert payload["catalog_tools_executed"] == ["ssot_lookup_tool", "client_profile_sql_tool"]
    assert "tool_enrichments" in payload
    assert payload["profile_snapshot"] == {"id": "p1"}


def test_search_agent_falls_back_when_catalog_tools_empty() -> None:
    calls: list[str] = []

    def execute_tool(name: str, inp: dict[str, object]) -> dict[str, object]:
        calls.append(name)
        return {"error": "needs ids"}

    agent = SearchAgent()
    result = agent.execute_with_tools(_ctx(catalog_tool_ids=()), execute_tool)
    assert calls == ["client_profile_sql_tool"]
    payload = json.loads(result.output_text)
    assert payload["catalog_tools_executed"] == ["client_profile_sql_tool"]
    assert "tool_enrichment" in payload
