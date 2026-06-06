from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

import httpx

from app.infrastructure.config.settings import Settings
from app.infrastructure.llm.openai_sse_stream import iter_openai_chat_sse_text_deltas
from app.infrastructure.llm.types import LlmChatResult


@dataclass(frozen=True, slots=True)
class AzureOpenAIAdapter:
    """
    Azure OpenAI chat completions via REST (same message schema as OpenAI).

    ``endpoint`` is the resource base, e.g. ``https://{resource}.openai.azure.com``.
    """

    api_key: str
    endpoint: str
    deployment: str
    api_version: str
    timeout_s: float = 120.0

    def chat(self, *, system: str, user: str) -> LlmChatResult:
        key = (self.api_key or "").strip()
        if not key:
            raise ValueError(
                "Azure OpenAI API key is empty; set AZURE_OPENAI_API_KEY or azure_openai_api_key in settings"
            )
        base = (self.endpoint or "").strip().rstrip("/")
        dep = (self.deployment or "").strip()
        if not base:
            raise ValueError("Azure OpenAI endpoint is empty; set AZURE_OPENAI_ENDPOINT")
        if not dep:
            raise ValueError("Azure OpenAI deployment is empty; set AZURE_OPENAI_DEPLOYMENT")

        url = f"{base}/openai/deployments/{dep}/chat/completions?api-version={self.api_version}"
        payload: dict[str, Any] = {
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        headers = {
            "api-key": key,
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=self.timeout_s) as client:
            response = client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
        choice = data["choices"][0]["message"]["content"]
        if not isinstance(choice, str):
            choice = str(choice)
        usage = data.get("usage") or {}
        model_name = str(data.get("model") or dep)
        return LlmChatResult(
            text=choice.strip(),
            model=model_name,
            input_tokens=usage.get("prompt_tokens"),
            output_tokens=usage.get("completion_tokens"),
            raw=data,
        )

    def iter_chat_deltas(self, *, system: str, user: str) -> Iterator[str]:
        key = (self.api_key or "").strip()
        if not key:
            raise ValueError(
                "Azure OpenAI API key is empty; set AZURE_OPENAI_API_KEY or azure_openai_api_key in settings"
            )
        base = (self.endpoint or "").strip().rstrip("/")
        dep = (self.deployment or "").strip()
        if not base:
            raise ValueError("Azure OpenAI endpoint is empty; set AZURE_OPENAI_ENDPOINT")
        if not dep:
            raise ValueError("Azure OpenAI deployment is empty; set AZURE_OPENAI_DEPLOYMENT")

        url = f"{base}/openai/deployments/{dep}/chat/completions?api-version={self.api_version}"
        payload: dict[str, Any] = {
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        headers = {
            "api-key": key,
            "Content-Type": "application/json",
        }
        yield from iter_openai_chat_sse_text_deltas(
            url=url,
            headers=headers,
            payload=payload,
            timeout_s=self.timeout_s,
        )


def azure_openai_adapter_from_settings(settings: Settings) -> AzureOpenAIAdapter:
    return AzureOpenAIAdapter(
        api_key=settings.azure_openai_api_key.get_secret_value(),
        endpoint=settings.azure_openai_endpoint,
        deployment=settings.azure_openai_deployment,
        api_version=settings.azure_openai_api_version,
    )
