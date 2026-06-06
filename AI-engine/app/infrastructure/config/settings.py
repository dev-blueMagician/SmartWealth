from __future__ import annotations

from pathlib import Path
from typing import Literal
from urllib.parse import parse_qsl, quote_plus, urlencode, urlparse, urlunparse

from pydantic import AliasChoices, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _project_root_with_pyproject() -> Path:
    """Checkout root (directory containing ``pyproject.toml``)."""
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "pyproject.toml").is_file():
            return parent
    return here.parents[4]


_PROJECT_ROOT = _project_root_with_pyproject()


def _merge_search_path_into_url(url: str, schema: str) -> str:
    """Set libpq `options=-csearch_path=...`, preserving other query params."""
    parsed = urlparse(url)
    pairs = dict(parse_qsl(parsed.query, keep_blank_values=True))
    pairs["options"] = f"-csearch_path={schema}"
    return urlunparse(parsed._replace(query=urlencode(pairs)))


class Settings(BaseSettings):
    """
    Loads from environment variables and optional .env at project root.
    """

    model_config = SettingsConfigDict(
        env_file=str(_PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "SmartWealth AI Core"
    app_env: str = "local"
    log_level: str = "INFO"
    internal_workflow_event_token: str = ""

    # Either set DATABASE_URL, or use DB_* below.
    database_url: str | None = Field(default=None)
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "postgres"
    db_password: SecretStr = Field(default_factory=lambda: SecretStr(""))
    db_name: str = "smartwealth"
    # PostgreSQL search_path (e.g. "myapp" or "myapp,public"). Ignored if empty.
    db_schema: str | None = None

    # DeepSeek (OpenAI-compatible API). Used by scripts/try_deepseek_prompt.py and DeepSeekAdapter.
    deepseek_api_key: SecretStr = Field(default_factory=lambda: SecretStr(""))
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    # LLM_PROVIDER: deepseek | azure_openai (see app.infrastructure.llm.factory).
    llm_provider: Literal["deepseek", "azure_openai"] = "deepseek"
    # Azure OpenAI (REST). Used when LLM_PROVIDER=azure_openai.
    azure_openai_endpoint: str = ""
    azure_openai_api_key: SecretStr = Field(
        default_factory=lambda: SecretStr(""),
        validation_alias=AliasChoices("AZURE_OPENAI_API_KEY", "AZURE_OPENAI_KEY"),
    )
    azure_openai_deployment: str = ""
    azure_openai_api_version: str = "2024-02-15-preview"
    # When true and credentials for ``llm_provider`` are set, assessment uses rules + LLM.
    assessment_llm_enabled: bool = False
    # Legacy DB/UI flag; routing no longer uses a separate LangGraph loop (catalog graph only).
    completeness_loop_graph_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "COMPLETENESS_LOOP_GRAPH_ENABLED",
            "AI01_LOOP_GRAPH_ENABLED",
        ),
    )

    @field_validator("db_schema", mode="before")
    @classmethod
    def _normalize_db_schema(cls, v: object) -> str | None:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return str(v)

    @property
    def resolved_database_url(self) -> str:
        """Connection string for SQLAlchemy/psycopg/asyncpg-style clients."""
        if self.database_url:
            base = self.database_url
        else:
            password = self.db_password.get_secret_value()
            user_q = quote_plus(self.db_user)
            pw_q = quote_plus(password)
            base = (
                f"postgresql://{user_q}:{pw_q}"
                f"@{self.db_host}:{self.db_port}/{self.db_name}"
            )
        if self.db_schema:
            return _merge_search_path_into_url(base, self.db_schema)
        return base
