from __future__ import annotations

from typing import Protocol

from app.infrastructure.config.settings import Settings
from app.infrastructure.llm.azure_openai_adapter import azure_openai_adapter_from_settings
from app.infrastructure.llm.deepseek_adapter import deepseek_adapter_from_settings
from app.infrastructure.llm.types import LlmChatResult


class LlmChatClient(Protocol):
    """Anything that implements OpenAI-style ``chat(system=..., user=...)``."""

    def chat(self, *, system: str, user: str) -> LlmChatResult: ...


def chat_completion_adapter_from_settings(settings: Settings) -> LlmChatClient:
    if settings.llm_provider == "azure_openai":
        return azure_openai_adapter_from_settings(settings)
    if settings.llm_provider == "deepseek":
        return deepseek_adapter_from_settings(settings)
    raise ValueError(f"Unknown llm_provider: {settings.llm_provider!r}")


def assessment_llm_ready(settings: Settings) -> bool:
    """True when assessment LLM is enabled and selected provider credentials are present."""
    if not settings.assessment_llm_enabled:
        return False
    if settings.llm_provider == "azure_openai":
        return bool(
            (settings.azure_openai_api_key.get_secret_value() or "").strip()
            and (settings.azure_openai_endpoint or "").strip()
            and (settings.azure_openai_deployment or "").strip()
        )
    return bool((settings.deepseek_api_key.get_secret_value() or "").strip())


def assessment_llm_identity(settings: Settings) -> tuple[str, str]:
    """``(provider_id, model_label)`` for ``AIResult`` and tracing."""
    if settings.llm_provider == "azure_openai":
        dep = (settings.azure_openai_deployment or "").strip()
        return ("azure_openai", dep if dep else "azure-openai")
    return ("deepseek", settings.deepseek_model)


def narrative_label_for_provider(provider_id: str) -> str:
    return {"deepseek": "DeepSeek", "azure_openai": "Azure OpenAI"}.get(provider_id, provider_id)
