"""Resolve catalog ``tools`` / ``catalog_tool_ids`` into ordered tool runs per agent allowlist."""

from __future__ import annotations

import json
from typing import Any, Final

from app.domain.smartwealth.models import OrchestrationContext

CLIENT_PROFILE_SQL_TOOL: Final[str] = "client_profile_sql_tool"
DISCOVERY_DATASET_SQL_TOOL: Final[str] = "discovery_dataset_sql_tool"
SSOT_LOOKUP_TOOL: Final[str] = "ssot_lookup_tool"
CLIENT_PROFILE_CHAT_PATCH_TOOL: Final[str] = "client_profile_chat_patch_tool"

# Must stay aligned with ``LocalAgentExecutor`` tool_permissions in ``catalog_assessment_orchestrator``.
SEARCH_AGENT_TOOL_ALLOWLIST: Final[frozenset[str]] = frozenset(
    {CLIENT_PROFILE_SQL_TOOL, DISCOVERY_DATASET_SQL_TOOL, SSOT_LOOKUP_TOOL}
)
DOCUMENT_AGENT_TOOL_ALLOWLIST: Final[frozenset[str]] = frozenset({SSOT_LOOKUP_TOOL})
COMPLETENESS_AGENT_TOOL_ALLOWLIST: Final[frozenset[str]] = frozenset(
    {
        CLIENT_PROFILE_SQL_TOOL,
        DISCOVERY_DATASET_SQL_TOOL,
        SSOT_LOOKUP_TOOL,
        CLIENT_PROFILE_CHAT_PATCH_TOOL,
    }
)


def ordered_allowed_catalog_tools(
    catalog_tool_ids: tuple[str, ...],
    allowed: frozenset[str],
) -> tuple[str, ...]:
    """Preserve catalog order, drop unknown/disallowed ids, dedupe."""
    seen: set[str] = set()
    out: list[str] = []
    for tid in catalog_tool_ids:
        if tid in allowed and tid not in seen:
            seen.add(tid)
            out.append(tid)
    return tuple(out)


def build_catalog_tool_input(
    tool_id: str,
    *,
    context: OrchestrationContext,
) -> dict[str, Any]:
    """Map ``OrchestrationContext.variables`` (+ context text) to each tool's input shape."""
    vars_ = context.variables or {}
    if tool_id == CLIENT_PROFILE_SQL_TOOL:
        tool_input: dict[str, Any] = {
            "case_id": vars_.get("case_id"),
            "client_id": vars_.get("client_id"),
        }
        sections = _resolve_loader_sections(context)
        if sections:
            tool_input["sections"] = sections
        return tool_input
    if tool_id == DISCOVERY_DATASET_SQL_TOOL:
        tool_input = {
            "case_id": vars_.get("case_id"),
            "filled_limit": vars_.get("discovery_filled_limit", 40),
            "missing_limit": vars_.get("discovery_missing_limit", 30),
            "unmapped_limit": vars_.get("discovery_unmapped_limit", 15),
        }
        domain = vars_.get("discovery_data_domain")
        if isinstance(domain, str) and domain.strip():
            tool_input["data_domain"] = domain.strip()
        return tool_input
    if tool_id == SSOT_LOOKUP_TOOL:
        return {
            "payload": dict(vars_),
            "required_fields": ["customer_id", "client_id", "case_id"],
        }
    if tool_id == CLIENT_PROFILE_CHAT_PATCH_TOOL:
        raw_hist = vars_.get("chat_conversation_json")
        hist: list[dict[str, Any]] = []
        if raw_hist and isinstance(raw_hist, str) and raw_hist.strip():
            try:
                parsed = json.loads(raw_hist)
                if isinstance(parsed, list):
                    hist = [h for h in parsed if isinstance(h, dict)]
            except json.JSONDecodeError:
                pass
        msg = (context.input_text or "").strip() or (vars_.get("chat_user_message") or "")
        return {
            "case_id": vars_.get("case_id"),
            "client_id": vars_.get("client_id"),
            "user_message": msg,
            "conversation_history": hist,
        }
    raise ValueError(f"Unsupported tool_id for catalog dispatch: {tool_id!r}")


def _resolve_loader_sections(context: OrchestrationContext) -> list[str] | None:
    """
    Read ``loader_sections`` from catalog ``loop_input``.

    Catalog entries can declare which data domains to load, e.g.::

        "loader_sections": ["identity", "household", "documents", "assets", "goals"]

    When absent the registry uses its default sections (identity + household + documents).
    """
    li = context.catalog.loop_input if context.catalog else {}
    raw = li.get("loader_sections")
    if isinstance(raw, list):
        return [str(s) for s in raw if isinstance(s, str) and s.strip()]
    if isinstance(raw, str) and raw.strip():
        return [s.strip() for s in raw.split(",") if s.strip()]
    return None
