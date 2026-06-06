from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Callable
from uuid import NAMESPACE_URL, uuid5

from app.domain.smartwealth.interfaces import Agent
from app.domain.smartwealth.models import AIResult, DecisionStatus, OrchestrationContext
from app.orchestration.smartwealth.catalog_agent_tool_dispatch import (
    SSOT_LOOKUP_TOOL,
    DOCUMENT_AGENT_TOOL_ALLOWLIST,
    build_catalog_tool_input,
    ordered_allowed_catalog_tools,
)


class DocumentAgent(Agent):
    """
    Prepares structured document-request context from catalog + variables (no external APIs).

    Suitable for interactions whose expectation is tailored document asks (e.g. document_request_draft).
    """

    @property
    def agent_id(self) -> str:
        return "document_agent"

    def execute(self, context: OrchestrationContext) -> AIResult:
        return self._build_result(context, tool_runs=None)

    def execute_with_tools(
        self,
        context: OrchestrationContext,
        execute_tool: Callable[[str, dict[str, Any]], dict[str, Any]],
    ) -> AIResult:
        planned = ordered_allowed_catalog_tools(
            context.catalog.catalog_tool_ids,
            DOCUMENT_AGENT_TOOL_ALLOWLIST,
        )
        if not planned:
            planned = (SSOT_LOOKUP_TOOL,)
        tool_runs: list[tuple[str, dict[str, Any]]] = []
        for tool_id in planned:
            tool_input = build_catalog_tool_input(tool_id, context=context)
            tool_runs.append((tool_id, execute_tool(tool_id, tool_input)))
        return self._build_result(context, tool_runs=tool_runs)

    def _build_result(
        self,
        context: OrchestrationContext,
        *,
        tool_runs: list[tuple[str, dict[str, Any]]] | None,
    ) -> AIResult:
        requested = sorted(context.variables.keys()) if context.variables else []
        findings: dict[str, Any] = {
            "agent_role": "document_intake",
            "assessment_id": context.assessment_code,
            "assessment_name": context.assessment_code,
            "variables_keys": requested,
            "document_groups_hint": ["identity", "address", "risk", "legal"],
            "notes": (
                "Document path: tools from catalog ``loop_input.tools`` when allowed; "
                "otherwise defaults to ssot_lookup_tool."
            ),
        }
        if tool_runs:
            findings["catalog_tools_executed"] = [tid for tid, _ in tool_runs]
        if tool_runs and len(tool_runs) == 1:
            _, body = tool_runs[0]
            findings["tool_enrichment"] = body
        elif tool_runs and len(tool_runs) > 1:
            findings["tool_enrichments"] = {tid: body for tid, body in tool_runs}
        result_seed = f"{context.request_id}|{context.context_id}|document|{requested}"
        result_id = str(uuid5(NAMESPACE_URL, result_seed))
        produced_at = datetime.now(timezone.utc)
        return AIResult(
            result_id=result_id,
            request_id=context.request_id,
            step_name="document_catalog_assessment",
            provider="internal",
            model=self.agent_id,
            output_text=json.dumps(findings, separators=(",", ":"), sort_keys=True),
            confidence_score=1.0,
            confidence_threshold=context.confidence_threshold,
            decision=DecisionStatus.DRAFT,
            decision_reason="Document-path stub output; extend with real document status lookups.",
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
