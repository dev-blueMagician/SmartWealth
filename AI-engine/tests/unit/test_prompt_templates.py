from __future__ import annotations

import pytest

from app.infrastructure.prompts import (
    interaction_spec_to_mapping,
    render_interaction_prompt,
    render_prompt_template,
)
from app.orchestration.assessment.codes import AssessmentCode


def test_render_interaction_prompt_ai34_keeps_unmapped_placeholders() -> None:
    text = render_interaction_prompt(AssessmentCode.ASSESSMENT_34.value)
    assert "{{interaction_id}}" in text
    assert "{{request_intent}}" in text


def test_render_interaction_prompt_onboarding_completeness_substitutes_catalog_fields() -> None:
    text = render_interaction_prompt(AssessmentCode.ONBOARDING_COMPLETENESS.value)
    assert "completeness_lp_000" in text
    assert "ASSESS_ONBOARDING_COMPLETENESS" in text
    assert "{{" not in text
    assert "}}" not in text


def test_render_interaction_prompt_extra_overrides() -> None:
    out = render_interaction_prompt(
        AssessmentCode.ONBOARDING_COMPLETENESS.value,
        extra={"loop_input": "OVERRIDE_LOOP_INPUT"},
    )
    assert "OVERRIDE_LOOP_INPUT" in out
    assert "{{" not in out


def test_render_prompt_template_unknown_placeholder_preserved() -> None:
    s = render_prompt_template("Hello {{known}} {{unknown}}", {"known": "X"})
    assert s == "Hello X {{unknown}}"


def test_interaction_spec_to_mapping_exposes_loop_input_only() -> None:
    from app.domain.smartwealth.interaction_catalog import get_interaction_spec

    spec = get_interaction_spec(AssessmentCode.ONBOARDING_COMPLETENESS.value)
    assert spec is not None
    m = interaction_spec_to_mapping(spec)
    assert set(m) == {"loop_input"}
    assert "completeness_lp_000" in m["loop_input"]


def test_unknown_assessment_raises() -> None:
    with pytest.raises(ValueError, match="Unknown"):
        render_interaction_prompt("AI-99")
