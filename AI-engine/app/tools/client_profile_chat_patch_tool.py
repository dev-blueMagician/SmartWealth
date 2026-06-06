"""Catalog tool: LLM extract from chat + apply onboarding profile patch to PostgreSQL."""

from __future__ import annotations

import json
from typing import Any

from app.application.services.chat_profile_patch_service import run_chat_profile_patch
from app.domain.smartwealth.interfaces import ComputationTool
from app.infrastructure.config.settings import Settings


class ClientProfileChatPatchTool(ComputationTool):
    """
    Side-effect tool (registered as ``ComputationTool`` for ``RegistryToolExecutor``).

    Input: ``case_id``, optional ``client_id``, ``user_message``, optional ``conversation_history``
    (list of dicts or JSON string in variables — caller passes list from dispatch).
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def tool_id(self) -> str:
        return "client_profile_chat_patch_tool"

    def compute(self, inputs: dict[str, Any]) -> dict[str, Any]:
        case_id = str(inputs.get("case_id") or "").strip()
        client_raw = inputs.get("client_id")
        client_id = str(client_raw).strip() if client_raw else None
        if not client_id:
            client_id = None
        user_message = str(inputs.get("user_message") or "").strip()
        hist_raw = inputs.get("conversation_history")
        history: list[dict[str, Any]] | None = None
        if isinstance(hist_raw, list):
            history = [h for h in hist_raw if isinstance(h, dict)]
        elif isinstance(hist_raw, str) and hist_raw.strip():
            try:
                parsed = json.loads(hist_raw)
                if isinstance(parsed, list):
                    history = [h for h in parsed if isinstance(h, dict)]
            except json.JSONDecodeError:
                history = None
        return run_chat_profile_patch(
            settings=self._settings,
            case_id=case_id,
            client_id=client_id,
            user_message=user_message,
            conversation_history=history,
        )
