"""Second-pass LLM: natural-language chat reply from pass-1 assessment output + user question."""

from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any

from app.application.services.chat_intent_service import conversation_history_json_safe, scrub_conversation_turns
from app.infrastructure.config.settings import Settings
from app.infrastructure.llm.factory import (
    assessment_llm_identity,
    assessment_llm_ready,
    chat_completion_adapter_from_settings,
)
from app.infrastructure.llm.resolve_llm_settings import resolve_llm_settings
from app.prompts import load_prompt

_DEFAULT_SYSTEM = load_prompt("chat_narrate_system", include_common=True)
_PHASE_TRANSITION_SYSTEM = load_prompt("phase_transition_narrate", include_common=True)
_DOCUMENT_REVIEW_SYSTEM = load_prompt("document_review_narrate", include_common=True)


def _is_phase_transition(findings: dict[str, Any]) -> bool:
    return bool(
        findings.get("phase_transition_success") or findings.get("phase_transition_blocked")
    )


def _is_document_review(findings: dict[str, Any]) -> bool:
    return bool(findings.get("document_review_completed"))


def _resolve_system_prompt(
    system_prompt: str | None,
    findings: dict[str, Any],
) -> str:
    if (system_prompt or "").strip():
        return system_prompt.strip()
    if _is_phase_transition(findings):
        return _PHASE_TRANSITION_SYSTEM
    if _is_document_review(findings):
        return _DOCUMENT_REVIEW_SYSTEM
    return _DEFAULT_SYSTEM


def _coerce_findings_dict(
    pass1_findings: dict[str, Any] | None,
    pass1_output_text: str | None,
) -> dict[str, Any]:
    if isinstance(pass1_findings, dict) and pass1_findings:
        return dict(pass1_findings)
    raw = (pass1_output_text or "").strip()
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
        return {"raw_output_text": raw}
    return {"note": "No pass-1 findings or output provided."}


def _build_user_block(
    *,
    user_message: str,
    findings: dict[str, Any],
    conversation_history: list[dict[str, str]] | None,
    phase_code: str | None,
    assessment_code: str | None,
    input_language: str,
) -> str:
    parts: list[str] = [
        f"## Preferred language hint: {(input_language or 'en').strip()}",
    ]
    if phase_code:
        parts.append(f"## Case phase (context): {phase_code.strip()}")
    if assessment_code:
        parts.append(f"## Assessment code (context): {assessment_code.strip()}")
    parts.append(f"## Current user question\n{(user_message or '').strip()}")
    if conversation_history:
        scrubbed = scrub_conversation_turns(conversation_history)
        if scrubbed:
            parts.append("## Prior conversation (chronological, JSON array)\n")
            parts.append(conversation_history_json_safe(scrubbed))
    blob = json.dumps(findings, ensure_ascii=False, indent=2)
    max_len = 24_000
    if len(blob) > max_len:
        blob = blob[: max_len - 1] + "…"
    parts.append("## Pass-1 engine output (JSON)\n" + blob)
    return "\n\n".join(parts)


def run_chat_narrate(
    *,
    settings: Settings,
    user_message: str,
    pass1_findings: dict[str, Any] | None,
    pass1_output_text: str | None,
    conversation_history: list[dict[str, Any]] | None = None,
    phase_code: str | None = None,
    assessment_code: str | None = None,
    system_prompt: str | None = None,
    input_language: str = "en",
) -> dict[str, Any]:
    """
    Call LLM once to produce ``chat_reply`` for the chat channel.

    Raises ``ValueError`` when the narrate LLM is not configured (same gate as assessment LLM).
    """
    st = resolve_llm_settings(settings)
    if not assessment_llm_ready(st):
        raise ValueError(
            "Chat narrate LLM is not available: set ASSESSMENT_LLM_ENABLED and provider credentials "
            "(same requirements as catalog assessment LLM)."
        )

    findings = _coerce_findings_dict(pass1_findings, pass1_output_text)
    system = _resolve_system_prompt(system_prompt, findings)
    user_block = _build_user_block(
        user_message=user_message,
        findings=findings,
        conversation_history=conversation_history,
        phase_code=phase_code,
        assessment_code=assessment_code,
        input_language=input_language,
    )

    llm = chat_completion_adapter_from_settings(st)
    chat = llm.chat(system=system, user=user_block)
    prov, _model_label = assessment_llm_identity(st)
    text = (chat.text or "").strip()
    if not text:
        raise ValueError("Narrate LLM returned an empty reply.")

    return {
        "chat_reply": text,
        "provider": prov,
        "model": chat.model,
        "input_tokens": chat.input_tokens,
        "output_tokens": chat.output_tokens,
    }


def iter_chat_narrate_text_deltas(
    *,
    settings: Settings,
    user_message: str,
    pass1_findings: dict[str, Any] | None,
    pass1_output_text: str | None,
    conversation_history: list[dict[str, Any]] | None = None,
    phase_code: str | None = None,
    assessment_code: str | None = None,
    system_prompt: str | None = None,
    input_language: str = "en",
) -> Iterator[str]:
    """
    Stream narrate LLM output as text fragments (OpenAI-compatible SSE).
    Raises ``ValueError`` when the narrate LLM is not configured.
    """
    st = resolve_llm_settings(settings)
    if not assessment_llm_ready(st):
        raise ValueError(
            "Chat narrate LLM is not available: set ASSESSMENT_LLM_ENABLED and provider credentials "
            "(same requirements as catalog assessment LLM)."
        )

    findings = _coerce_findings_dict(pass1_findings, pass1_output_text)
    system = _resolve_system_prompt(system_prompt, findings)
    user_block = _build_user_block(
        user_message=user_message,
        findings=findings,
        conversation_history=conversation_history,
        phase_code=phase_code,
        assessment_code=assessment_code,
        input_language=input_language,
    )

    llm = chat_completion_adapter_from_settings(st)
    if not hasattr(llm, "iter_chat_deltas"):
        chat = llm.chat(system=system, user=user_block)
        text = (chat.text or "").strip()
        if text:
            yield text
        return

    yielded = False
    for fragment in llm.iter_chat_deltas(system=system, user=user_block):
        if fragment:
            yielded = True
            yield fragment
    if not yielded:
        raise ValueError("Narrate LLM stream returned no text deltas.")
