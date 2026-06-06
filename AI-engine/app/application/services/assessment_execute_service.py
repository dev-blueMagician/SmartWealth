from __future__ import annotations

from app.domain.smartwealth.models import AIResult
from app.infrastructure.config.settings import Settings


class AssessmentExecuteService:
    """
    Direct assessment run by orchestration_request id (PostgreSQL path).
    Uses the built-in onboarding completeness pipeline (same runner as registry onboarding_completeness).
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def execute_by_request_id(self, request_id: str) -> AIResult:
        # Lazy import so unit tests and environments without psycopg can still import the app.
        from app.infrastructure.db.assessment_pg import execute_assessment_postgres

        return execute_assessment_postgres(self._settings, request_id)
