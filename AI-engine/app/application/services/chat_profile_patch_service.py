"""
LLM-assisted extraction of profile updates from chat, then deterministic DB patch.

Used when intent indicates the user is providing / correcting onboarding profile data.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.infrastructure.config.settings import Settings
from app.infrastructure.llm.factory import assessment_llm_ready, chat_completion_adapter_from_settings
from app.prompts import load_prompt
from app.tools.client_profile_sql_tool import apply_profile_patch_to_db

_log = logging.getLogger(__name__)

_SYSTEM = load_prompt("chat_profile_patch_system")


def _strip_json_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
        t = re.sub(r"\s*```$", "", t)
    return t.strip()


def _parse_llm_patch_json(text: str) -> tuple[dict[str, Any], dict[str, Any]]:
    raw = _strip_json_fence(text)
    data = json.loads(raw)
    if not isinstance(data, dict):
        return {}, {}
    patch = data.get("patch")
    hh = data.get("household_patch")
    if not isinstance(patch, dict):
        patch = {}
    if not isinstance(hh, dict):
        hh = {}
    return patch, hh


def run_chat_profile_patch(
    *,
    settings: Settings,
    case_id: str,
    client_id: str | None,
    user_message: str,
    conversation_history: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Extract patch fields via LLM (when enabled), then apply allowed columns in PostgreSQL.

    ``client_id`` may be omitted when ``case_id`` resolves to a single case row.
    """
    if not assessment_llm_ready(settings):
        return {
            "skipped": True,
            "reason": "assessment_llm_not_configured",
            "detail": "Set ASSESSMENT_LLM_ENABLED and provider credentials to enable profile extraction.",
        }

    hist = conversation_history or []
    hist_tail = hist[-12:] if len(hist) > 12 else hist
    user_block = json.dumps(
        {
            "user_message": (user_message or "").strip(),
            "conversation_tail": hist_tail,
        },
        ensure_ascii=False,
        indent=2,
    )

    llm = chat_completion_adapter_from_settings(settings)
    chat = llm.chat(system=_SYSTEM, user=user_block)
    text = (chat.text or "").strip()
    if not text:
        return {"skipped": True, "reason": "llm_empty", "model": chat.model}

    try:
        patch, household_patch = _parse_llm_patch_json(text)
    except json.JSONDecodeError as exc:
        _log.warning("Profile patch LLM returned non-JSON: %s", exc)
        return {
            "skipped": True,
            "reason": "llm_invalid_json",
            "raw_preview": text[:500],
            "error": str(exc),
        }

    if not patch and not household_patch:
        return {
            "applied": False,
            "reason": "no_fields_extracted",
            "model": chat.model,
            "extracted_patch": patch,
            "extracted_household_patch": household_patch,
        }

    db_result = apply_profile_patch_to_db(
        case_id=case_id,
        client_id=client_id,
        patch=patch,
        household_patch=household_patch,
    )
    out: dict[str, Any] = {
        "applied": bool(db_result.get("applied")),
        "model": chat.model,
        "extracted_patch": patch,
        "extracted_household_patch": household_patch,
    }
    out.update(db_result)
    return out
