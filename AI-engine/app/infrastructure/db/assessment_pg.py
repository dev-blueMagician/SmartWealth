from __future__ import annotations

"""
PostgreSQL assessment execution via the catalog LangGraph orchestrator.
Requires psycopg when connecting: pip install "psycopg[binary]".
"""

from dataclasses import replace

from app.domain.smartwealth.models import AIResult
from app.infrastructure.config.settings import Settings
from app.infrastructure.llm.resolve_llm_settings import resolve_llm_settings


def execute_assessment_with_conn(
    conn,
    request_id: str,
    settings: Settings | None = None,
    *,
    triggered_assessment_code: str | None = None,
) -> AIResult:
    from app.infrastructure.context.sql_context_data_repository import SqlContextDataRepository
    from app.infrastructure.orchestration.sql_orchestration_request_loader import (
        load_orchestration_request,
    )
    from app.orchestration.smartwealth.catalog_assessment_orchestrator import (
        build_catalog_assessment_orchestrator,
    )
    from app.orchestration.smartwealth import RepositoryBackedContextResolver

    st = resolve_llm_settings(settings or Settings())
    request = load_orchestration_request(conn, request_id)
    if request is None:
        raise LookupError(f"orchestration_request not found for request_id={request_id}")

    effective = (triggered_assessment_code or request.assessment_code or "").strip()
    request = replace(request, assessment_code=effective)

    context_repo = SqlContextDataRepository(conn)
    resolver = RepositoryBackedContextResolver(context_repo)

    orchestrator = build_catalog_assessment_orchestrator(context_resolver=resolver, settings=st)
    return orchestrator.Execute(request)


def execute_assessment_postgres(settings: Settings, request_id: str) -> AIResult:
    import psycopg

    url = settings.resolved_database_url
    with psycopg.connect(url) as conn:
        return execute_assessment_with_conn(conn, request_id, settings)
