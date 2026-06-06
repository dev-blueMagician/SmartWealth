from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import httpx

from app.infrastructure.config.settings import Settings
from app.infrastructure.llm.openai_sse_stream import iter_openai_chat_sse_text_deltas
from app.infrastructure.llm.types import LlmChatResult


class DeepSeekAdapter:
    """
    OpenAI-compatible ``/v1/chat/completions`` client for DeepSeek.

    Docs: https://api-docs.deepseek.com
    """

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = "https://api.deepseek.com",
        model: str = "deepseek-chat",
        timeout_s: float = 120.0,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._timeout = timeout_s

    def chat(self, *, system: str, user: str) -> LlmChatResult:
        if not (self._api_key or "").strip():
            raise ValueError("DeepSeek API key is empty; set DEEPSEEK_API_KEY or deepseek_api_key in settings")
        url = f"{self._base_url}/v1/chat/completions"
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        headers = {
            "Authorization": f"Bearer {self._api_key.strip()}",
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=self._timeout) as client:
            response = client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
        choice = data["choices"][0]["message"]["content"]
        if not isinstance(choice, str):
            choice = str(choice)
        usage = data.get("usage") or {}
        return LlmChatResult(
            text=choice.strip(),
            model=str(data.get("model", self._model)),
            input_tokens=usage.get("prompt_tokens"),
            output_tokens=usage.get("completion_tokens"),
            raw=data,
        )

    def iter_chat_deltas(self, *, system: str, user: str) -> Iterator[str]:
        if not (self._api_key or "").strip():
            raise ValueError("DeepSeek API key is empty; set DEEPSEEK_API_KEY or deepseek_api_key in settings")
        url = f"{self._base_url}/v1/chat/completions"
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        headers = {
            "Authorization": f"Bearer {self._api_key.strip()}",
            "Content-Type": "application/json",
        }
        yield from iter_openai_chat_sse_text_deltas(
            url=url,
            headers=headers,
            payload=payload,
            timeout_s=self._timeout,
        )


def deepseek_adapter_from_settings(settings: Settings) -> DeepSeekAdapter:
    return DeepSeekAdapter(
        api_key=settings.deepseek_api_key.get_secret_value(),
        base_url=settings.deepseek_base_url,
        model=settings.deepseek_model,
    )
