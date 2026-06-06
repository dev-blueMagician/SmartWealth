from __future__ import annotations

import json
import time
from dataclasses import replace
from typing import Any, Callable

from app.domain.smartwealth.interfaces import Agent
from app.domain.smartwealth.models import AIResult, DecisionStatus, OrchestrationContext
from app.infrastructure.llm.factory import LlmChatClient, narrative_label_for_provider
from app.infrastructure.prompts import render_interaction_prompt
from app.orchestration.smartwealth.agents.completeness_agent import CompletenessAgent


def _llm_user_message(context: OrchestrationContext, structural: dict[str, object]) -> str:
    parts = [
        "## Variables (runtime / SSOT slice)",
        json.dumps(context.variables, ensure_ascii=False, indent=2),
        "## Structural completeness (rule-based)",
        json.dumps(structural, ensure_ascii=False, indent=2),
    ]
    if context.input_text.strip():
        parts.extend(["", "## OrchestrationRequest.input_text", context.input_text.strip()])
    if context.input_language.strip():
        parts.extend(["", f"## Preferred language hint: {context.input_language.strip()}"])
    return "\n".join(parts)


class CompletenessLlmAgent(Agent):
    """
    Runs ``CompletenessAgent`` then calls the configured LLM using catalog ``system_prompt`` for ``assessment_code``.

    Exposes the same ``agent_id`` as ``CompletenessAgent`` so selectors stay unchanged.
    """

    def __init__(
        self,
        llm: LlmChatClient,
        *,
        result_provider: str = "deepseek",
    ) -> None:
        self._llm = llm
        self._rules = CompletenessAgent()
        self._result_provider = result_provider

    @property
    def agent_id(self) -> str:
        return "completeness_agent"

    def execute(self, context: OrchestrationContext) -> AIResult:
        started = time.monotonic()
        inner = self._rules.execute(context)
        return self._merge_llm(inner, context, started)

    def execute_with_tools(
        self,
        context: OrchestrationContext,
        execute_tool: Callable[[str, dict[str, Any]], dict[str, Any]],
    ) -> AIResult:
        started = time.monotonic()
        inner = self._rules.execute_with_tools(context, execute_tool)
        return self._merge_llm(inner, context, started)

    def _merge_llm(self, inner: AIResult, context: OrchestrationContext, started: float) -> AIResult:
        structural = json.loads(inner.output_text)
        system = render_interaction_prompt(context.assessment_code)
        user = _llm_user_message(context, structural)
        chat = self._llm.chat(system=system, user=user)
        latency_ms = max(0, int((time.monotonic() - started) * 1000))

        merged: dict[str, object] = dict(structural)
        merged["llm_assistant"] = chat.text

        is_complete = bool(structural.get("is_complete"))
        llm_nonempty = bool((chat.text or "").strip())
        if context.escalation_required:
            decision = DecisionStatus.ESCALATE
            reason = (
                f"{inner.decision_reason} Escalation required; {narrative_label_for_provider(self._result_provider)} "
                "output retained in llm_assistant."
            )
        elif is_complete and llm_nonempty:
            decision = DecisionStatus.STOP
            reason = (
                "Structural completeness satisfied and LLM produced a non-empty narrative "
                f"({narrative_label_for_provider(self._result_provider)} in llm_assistant)."
            )
        elif is_complete and not llm_nonempty:
            decision = DecisionStatus.DRAFT
            reason = (
                f"{inner.decision_reason} Structural checks passed but LLM output was empty; "
                "retry or adjust prompts/credentials."
            )
        else:
            decision = DecisionStatus.DRAFT
            reason = (
                f"{inner.decision_reason} Narrative from {narrative_label_for_provider(self._result_provider)} "
                "in field llm_assistant; structural completeness not satisfied."
            )

        return replace(
            inner,
            provider=self._result_provider,
            model=chat.model,
            output_text=json.dumps(merged, separators=(",", ":"), sort_keys=True),
            confidence_score=inner.confidence_score,
            decision=decision,
            decision_reason=reason,
            latency_ms=latency_ms,
            input_tokens=(chat.input_tokens or 0) + inner.input_tokens,
            output_tokens=(chat.output_tokens or 0) + inner.output_tokens,
        )
