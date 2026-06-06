from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class DraftingResult:
    draft_text: str
    source_fields: list[str]


class DraftingAgent:
    """
    Agent creates a draft from SSOT fields only.
    """

    agent_id = "drafting_agent"

    def request_tool_name(self) -> str:
        return "ssot_lookup_tool"

    def create_draft(self, source_values: dict[str, Any]) -> DraftingResult:
        if not source_values:
            return DraftingResult(
                draft_text="No usable SSOT fields were available. Human review required.",
                source_fields=[],
            )

        segments: list[str] = []
        source_fields: list[str] = []
        for key, value in source_values.items():
            segments.append(f"{key}={value}")
            source_fields.append(key)

        draft_text = "AI draft (SSOT grounded): " + "; ".join(segments)
        return DraftingResult(draft_text=draft_text, source_fields=source_fields)
