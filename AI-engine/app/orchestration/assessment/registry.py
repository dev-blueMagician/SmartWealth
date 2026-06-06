from __future__ import annotations

from collections.abc import Callable

from app.domain.smartwealth.models import AIResult

AssessmentRunner = Callable[..., AIResult]

_RUNNERS: dict[str, AssessmentRunner] = {}
_BUILTIN_INSTALLED = False


def register_assessment_runner(assessment_code: str, runner: AssessmentRunner) -> None:
    """Register an executor for an assessment_code (e.g. from DB workflow_ai_trigger)."""
    _RUNNERS[assessment_code] = runner


def unregister_assessment_runner(assessment_code: str) -> None:
    _RUNNERS.pop(assessment_code, None)


def ensure_builtin_assessment_runners() -> None:
    """Register runners shipped with this service (idempotent)."""
    global _BUILTIN_INSTALLED
    if _BUILTIN_INSTALLED:
        return
    from app.infrastructure.db.assessment_pg import execute_assessment_with_conn
    from app.orchestration.assessment.codes import AssessmentCode

    def _runner_for(code: str) -> AssessmentRunner:
        def _run(conn, request_id: str) -> AIResult:
            return execute_assessment_with_conn(
                conn, request_id, triggered_assessment_code=code
            )

        return _run

    register_assessment_runner(
        AssessmentCode.ONBOARDING_COMPLETENESS.value,
        _runner_for(AssessmentCode.ONBOARDING_COMPLETENESS.value),
    )
    register_assessment_runner(
        AssessmentCode.CLIENT_PROFILE_CONTEXT.value,
        _runner_for(AssessmentCode.CLIENT_PROFILE_CONTEXT.value),
    )
    _BUILTIN_INSTALLED = True


def supported_assessment_codes() -> frozenset[str]:
    ensure_builtin_assessment_runners()
    return frozenset(_RUNNERS.keys())


def run_registered_assessment(conn, request_id: str, assessment_code: str) -> AIResult:
    """
    Dispatch by assessment_code. Unknown codes raise ValueError — DB-only triggers
    must match a registered runner (or be ignored upstream).
    """
    ensure_builtin_assessment_runners()
    runner = _RUNNERS.get(assessment_code)
    if runner is None:
        raise ValueError(f"No assessment runner registered for code={assessment_code!r}")
    return runner(conn, request_id)
