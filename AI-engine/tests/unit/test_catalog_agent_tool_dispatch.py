from __future__ import annotations

import json

from app.domain.smartwealth.models import InteractionCatalogView, OrchestrationContext
from app.orchestration.smartwealth.catalog_agent_tool_dispatch import (
    CLIENT_PROFILE_CHAT_PATCH_TOOL,
    CLIENT_PROFILE_SQL_TOOL,
    DOCUMENT_AGENT_TOOL_ALLOWLIST,
    SEARCH_AGENT_TOOL_ALLOWLIST,
    SSOT_LOOKUP_TOOL,
    build_catalog_tool_input,
    ordered_allowed_catalog_tools,
)


def _ctx(*, variables: dict[str, str], catalog_tool_ids: tuple[str, ...]) -> OrchestrationContext:
    catalog = InteractionCatalogView(loop_input={}, catalog_tool_ids=catalog_tool_ids)
    return OrchestrationContext(
        context_id="ctx-1",
        request_id="req-1",
        session_id="sess-1",
        current_step="s",
        attempt_count=1,
        environment="dev",
        feature_flags={},
        variables=variables,
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
        input_text="hi",
        input_language="en",
    )


def test_ordered_allowed_preserves_order_and_dedupes() -> None:
    got = ordered_allowed_catalog_tools(
        ("ssot_lookup_tool", "unknown", "client_profile_sql_tool", "ssot_lookup_tool"),
        SEARCH_AGENT_TOOL_ALLOWLIST,
    )
    assert got == ("ssot_lookup_tool", "client_profile_sql_tool")


def test_build_catalog_tool_input_shapes() -> None:
    ctx = _ctx(
        variables={"case_id": "c1", "client_id": "cl1", "customer_id": "cu1"},
        catalog_tool_ids=(),
    )
    assert build_catalog_tool_input(CLIENT_PROFILE_SQL_TOOL, context=ctx) == {
        "case_id": "c1",
        "client_id": "cl1",
    }
    ssot = build_catalog_tool_input(SSOT_LOOKUP_TOOL, context=ctx)
    assert ssot["required_fields"] == ["customer_id", "client_id", "case_id"]
    assert ssot["payload"]["customer_id"] == "cu1"


def test_document_allowlist_filters_unknown() -> None:
    assert ordered_allowed_catalog_tools(
        ("client_profile_sql_tool", SSOT_LOOKUP_TOOL),
        DOCUMENT_AGENT_TOOL_ALLOWLIST,
    ) == (SSOT_LOOKUP_TOOL,)


def test_build_chat_patch_tool_input_prefers_input_text() -> None:
    hist = json.dumps([{"role": "user", "content": "old"}])
    catalog = InteractionCatalogView(loop_input={}, catalog_tool_ids=())
    ctx = OrchestrationContext(
        context_id="ctx-1",
        request_id="req-1",
        session_id="sess-1",
        current_step="s",
        attempt_count=1,
        environment="dev",
        feature_flags={},
        variables={
            "case_id": "ca-1",
            "client_id": "cl-1",
            "chat_conversation_json": hist,
            "chat_user_message": "from vars",
        },
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
        assessment_code="onboarding_completeness",
        catalog=catalog,
        input_text="from input_text",
        input_language="en",
    )
    inp = build_catalog_tool_input(CLIENT_PROFILE_CHAT_PATCH_TOOL, context=ctx)
    assert inp["case_id"] == "ca-1"
    assert inp["client_id"] == "cl-1"
    assert inp["user_message"] == "from input_text"
    assert inp["conversation_history"] == [{"role": "user", "content": "old"}]
