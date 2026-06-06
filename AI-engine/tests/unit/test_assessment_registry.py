from __future__ import annotations

import pytest

from app.orchestration.assessment.codes import AssessmentCode
from app.orchestration.assessment.registry import (
    ensure_builtin_assessment_runners,
    run_registered_assessment,
    supported_assessment_codes,
)


def test_builtin_registers_onboarding_completeness_code() -> None:
    ensure_builtin_assessment_runners()
    assert AssessmentCode.ONBOARDING_COMPLETENESS.value in supported_assessment_codes()


def test_unknown_assessment_code_raises_before_using_connection() -> None:
    ensure_builtin_assessment_runners()
    with pytest.raises(ValueError, match="No assessment runner"):
        run_registered_assessment(None, "ignored", "NOT-A-REGISTERED-CODE")
