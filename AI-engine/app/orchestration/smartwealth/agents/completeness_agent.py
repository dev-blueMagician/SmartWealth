from __future__ import annotations

import json
from dataclasses import replace
from datetime import datetime, timezone
from typing import Any, Callable
from uuid import NAMESPACE_URL, uuid5

from app.domain.smartwealth.interfaces import Agent
from app.domain.smartwealth.models import AIResult, DecisionStatus, OrchestrationContext
from app.orchestration.smartwealth.catalog_agent_tool_dispatch import (
    CLIENT_PROFILE_CHAT_PATCH_TOOL,
    COMPLETENESS_AGENT_TOOL_ALLOWLIST,
    build_catalog_tool_input,
    ordered_allowed_catalog_tools,
)


def _extract_doc_status(tool_runs: list[tuple[str, dict[str, Any]]]) -> dict[str, list[str]]:
    """Pull document status lists from client_profile_sql_tool output."""
    for _tid, body in tool_runs:
        snap = body.get("profile_snapshot") if isinstance(body, dict) else None
        if not isinstance(snap, dict):
            continue
        docs = snap.get("documents")
        if not isinstance(docs, dict):
            continue
        result: dict[str, list[str]] = {}
        for key in ("missing_kinds_in_db", "pending_review_kinds", "rejected_kinds"):
            val = docs.get(key)
            if isinstance(val, list) and val:
                result[key] = sorted(str(k) for k in val if k)
        return result
    return {}


def _extract_missing_doc_kinds(tool_runs: list[tuple[str, dict[str, Any]]]) -> list[str]:
    """Pull ``missing_kinds_in_db`` from client_profile_sql_tool output (if present)."""
    return _extract_doc_status(tool_runs).get("missing_kinds_in_db", [])


def _should_inject_profile_chat_patch(context: OrchestrationContext) -> bool:
    """Chat supplement path: intent + onboarding completeness assessment."""
    v = context.variables or {}
    if (v.get("chat_intent") or "").strip() != "UPDATE_INFORMATION":
        return False
    return (context.assessment_code or "").strip() == "onboarding_completeness"


class CompletenessAgent(Agent):
    """
    Stateless agent that checks whether required context fields are present.

    Optional catalog-driven tools (``catalog.catalog_tool_ids``): when non-empty,
    ``execute_with_tools`` runs allowed tools and merges outputs into findings.

    When ``variables.chat_intent`` is ``UPDATE_INFORMATION`` and ``assessment_code`` is
    ``onboarding_completeness``, ``client_profile_chat_patch_tool`` is run first (LLM extract
    + DB patch) unless already listed in the catalog tool order.
    """

    _REQUIRED_FIELDS: tuple[str, ...] = (
        "context_id",
        "request_id",
        "session_id",
        "current_step",
        "environment",
        "variables",
        "ssot_record_id",
        "ssot_record_type",
        "ssot_record_version",
        "ssot_snapshot_id",
        "assessment_code",
        "catalog",
    )

    @property
    def agent_id(self) -> str:
        return "completeness_agent"

    def execute_with_tools(
        self,
        context: OrchestrationContext,
        execute_tool: Callable[[str, dict[str, Any]], dict[str, Any]],
    ) -> AIResult:
        """
        When ``context.catalog.catalog_tool_ids`` lists allowed read tools, run them and merge
        outputs into rule-based findings. Otherwise identical to ``execute`` (no tool calls).
        """
        planned = list(
            ordered_allowed_catalog_tools(
                context.catalog.catalog_tool_ids,
                COMPLETENESS_AGENT_TOOL_ALLOWLIST,
            )
        )
        if _should_inject_profile_chat_patch(context) and CLIENT_PROFILE_CHAT_PATCH_TOOL not in planned:
            planned.insert(0, CLIENT_PROFILE_CHAT_PATCH_TOOL)
        tool_runs: list[tuple[str, dict[str, Any]]] = []
        for tool_id in planned:
            tool_input = build_catalog_tool_input(tool_id, context=context)
            tool_runs.append((tool_id, execute_tool(tool_id, tool_input)))
        base = self.execute(context)
        if not tool_runs:
            return base
        findings = json.loads(base.output_text)
        findings["catalog_tools_executed"] = [t for t, _ in tool_runs]
        if len(tool_runs) == 1:
            findings["tool_enrichment"] = tool_runs[0][1]
        else:
            findings["tool_enrichments"] = {tid: body for tid, body in tool_runs}

        doc_statuses = _extract_doc_status(tool_runs)
        doc_missing = doc_statuses.get("missing_kinds_in_db", [])
        doc_pending = doc_statuses.get("pending_review_kinds", [])
        doc_rejected = doc_statuses.get("rejected_kinds", [])
        if doc_missing:
            existing: list[str] = findings.get("missing_items") or []
            prefixed = [f"document:{k}" for k in doc_missing]
            findings["missing_items"] = sorted(set(existing) | set(prefixed))
            findings["is_complete"] = False
            findings["missing_document_kinds"] = doc_missing
        if doc_pending:
            findings["pending_review_document_kinds"] = doc_pending
        if doc_rejected:
            findings["rejected_document_kinds"] = doc_rejected

        return replace(
            base,
            output_text=json.dumps(findings, separators=(",", ":"), sort_keys=True),
        )

    def execute(self, context: OrchestrationContext) -> AIResult:
        missing_fields = sorted(self._find_missing_fields(context))
        findings = {
            "assessment_id": context.assessment_code,
            "assessment_name": context.assessment_code,
            "is_complete": len(missing_fields) == 0,
            "missing_items": missing_fields,
            "ruleset_version": "1.0",
            "loop_input": context.catalog.loop_input,
        }

        # Stable identifiers keep outputs easy to diff and audit.
        result_seed = f"{context.request_id}|{context.context_id}|{findings['missing_items']}"
        result_id = str(uuid5(NAMESPACE_URL, result_seed))
        produced_at = datetime.now(timezone.utc)

        return AIResult(
            result_id=result_id,
            request_id=context.request_id,
            step_name="assess_catalog_interaction",
            provider="internal",
            model=self.agent_id,
            output_text=json.dumps(findings, separators=(",", ":"), sort_keys=True),
            confidence_score=1.0 if not missing_fields else 0.0,
            confidence_threshold=context.confidence_threshold,
            decision=DecisionStatus.DRAFT,
            decision_reason=(
                "Agent provides findings only; workflow outcome is decided by policy and gating."
            ),
            latency_ms=0,
            input_tokens=0,
            output_tokens=0,
            produced_at=produced_at,
            trace_id=context.context_id,
            safety_flagged=False,
            safety_category="NONE",
            human_approval_required=context.human_approval_required,
            human_approval_status=context.human_approval_status,
            approved_by_user_id=context.human_approver_id,
            approved_at=context.human_approval_at,
            ssot_record_id=context.ssot_record_id,
            ssot_record_type=context.ssot_record_type,
            ssot_record_version=context.ssot_record_version,
            ssot_snapshot_id=context.ssot_snapshot_id,
        )

    def _find_missing_fields(self, context: OrchestrationContext) -> list[str]:
        missing_fields: list[str] = []
        for field_name in self._REQUIRED_FIELDS:
            value = getattr(context, field_name)
            if self._is_missing(value):
                missing_fields.append(field_name)
        return missing_fields

    @staticmethod
    def _is_missing(value: object) -> bool:
        if value is None:
            return True
        if isinstance(value, str):
            return value.strip() == ""
        if isinstance(value, (dict, list, tuple, set)):
            return len(value) == 0
        return False
