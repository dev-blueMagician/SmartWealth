from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class LlmChatResult:
    text: str
    model: str
    input_tokens: int | None
    output_tokens: int | None
    raw: dict[str, Any]
