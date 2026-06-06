"""Merge active ``ai_llm_profile`` row from PostgreSQL over env-based :class:`Settings`."""

from __future__ import annotations

from typing import Any

from pydantic import SecretStr

from app.infrastructure.config.settings import Settings


def resolve_llm_settings(base: Settings) -> Settings:
    """
    When an active LLM profile exists in ``ai_llm_profile``, non-null DB fields override
    environment defaults (including optional API keys stored via admin UI).
    """
    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError:
        return base

    url = base.resolved_database_url
    try:
        with psycopg.connect(url) as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    """
                    SELECT llm_provider,
                           deepseek_base_url,
                           deepseek_model,
                           deepseek_api_key,
                           azure_openai_endpoint,
                           azure_openai_deployment,
                           azure_openai_api_version,
                           azure_openai_api_key,
                           assessment_llm_enabled,
                           completeness_loop_graph_enabled
                    FROM ai_llm_profile
                    WHERE is_active = true
                    LIMIT 1
                    """
                )
                row = cur.fetchone()
    except Exception:
        return base

    if not row:
        return base

    updates: dict[str, Any] = {}

    lp = str(row.get("llm_provider") or "").strip()
    if lp in ("deepseek", "azure_openai"):
        updates["llm_provider"] = lp

    def pick_str(env_val: str, db_val: object | None) -> str:
        if db_val is None:
            return env_val
        s = str(db_val).strip()
        return s if s else env_val

    updates["deepseek_base_url"] = pick_str(base.deepseek_base_url, row.get("deepseek_base_url"))
    updates["deepseek_model"] = pick_str(base.deepseek_model, row.get("deepseek_model"))
    updates["azure_openai_endpoint"] = pick_str(base.azure_openai_endpoint, row.get("azure_openai_endpoint"))
    updates["azure_openai_deployment"] = pick_str(base.azure_openai_deployment, row.get("azure_openai_deployment"))
    updates["azure_openai_api_version"] = pick_str(base.azure_openai_api_version, row.get("azure_openai_api_version"))

    dk = row.get("deepseek_api_key")
    if dk is not None and str(dk).strip():
        updates["deepseek_api_key"] = SecretStr(str(dk).strip())

    ak = row.get("azure_openai_api_key")
    if ak is not None and str(ak).strip():
        updates["azure_openai_api_key"] = SecretStr(str(ak).strip())

    if row.get("assessment_llm_enabled") is not None:
        updates["assessment_llm_enabled"] = bool(row["assessment_llm_enabled"])
    if row.get("completeness_loop_graph_enabled") is not None:
        updates["completeness_loop_graph_enabled"] = bool(row["completeness_loop_graph_enabled"])

    return base.model_copy(update=updates)
