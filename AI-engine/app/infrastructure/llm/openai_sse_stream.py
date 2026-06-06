"""OpenAI-compatible ``chat/completions`` SSE streaming (DeepSeek, Azure OpenAI)."""

from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any

import httpx


def iter_openai_chat_sse_text_deltas(
    *,
    url: str,
    headers: dict[str, str],
    payload: dict[str, Any],
    timeout_s: float = 120.0,
) -> Iterator[str]:
    """
  Yields non-empty ``choices[0].delta.content`` fragments from a streaming completion.
    """
    body = {**payload, "stream": True}
    with httpx.Client(timeout=timeout_s) as client:
        with client.stream("POST", url, headers=headers, json=body) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line:
                    continue
                if line.startswith("data:"):
                    data = line[5:].strip()
                else:
                    continue
                if not data or data == "[DONE]":
                    if data == "[DONE]":
                        break
                    continue
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue
                choices = chunk.get("choices")
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
                content = delta.get("content")
                if isinstance(content, str) and content:
                    yield content
