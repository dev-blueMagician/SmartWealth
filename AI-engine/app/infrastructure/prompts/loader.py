from __future__ import annotations

import json
import re

from app.domain.smartwealth.interaction_catalog import InteractionSpec, get_interaction_spec

_PLACEHOLDER = re.compile(r"\{\{(\w+)\}\}")


def load_prompt_template(assessment_code: str) -> str:
    """
    Return the prompt **template body** (Markdown with ``{{placeholders}}``).

    Source: ``InteractionSpec.system_prompt`` from PostgreSQL ``ai_interaction`` (loaded via catalog).
    """
    code = (assessment_code or "").strip()
    spec = get_interaction_spec(code)
    if spec is None:
        raise ValueError(f"Unknown assessment_code: {assessment_code!r}")

    sp = (spec.system_prompt or "").strip()
    if sp:
        return sp

    raise ValueError(
        f"No system_prompt for {code!r}. "
        "Populate ai_interaction.system_prompt (or run tests with SMARTWEALTH_INTERACTION_CATALOG_SOURCE=snapshot)."
    )


def interaction_spec_to_mapping(spec: InteractionSpec) -> dict[str, str]:
    """Map ``InteractionSpec`` to prompt template keys."""
    loop_input_json = json.dumps(spec.loop_input, ensure_ascii=False, indent=2)
    return {
        "loop_input": loop_input_json,
    }


def render_prompt_template(template: str, mapping: dict[str, str]) -> str:
    """Replace ``{{token}}`` placeholders; unknown tokens left unchanged."""

    def _sub(m: re.Match[str]) -> str:
        key = m.group(1)
        return mapping[key] if key in mapping else m.group(0)

    return _PLACEHOLDER.sub(_sub, template)


def render_interaction_prompt(
    assessment_code: str,
    extra: dict[str, str] | None = None,
) -> str:
    """
    Load prompt body from catalog ``system_prompt`` and fill from ``InteractionSpec`` + optional ``extra``.

    Use ``extra`` for runtime-only keys (e.g. ``variables_json``, ``input_text``).
    """
    spec = get_interaction_spec(assessment_code.strip())
    if spec is None:
        raise ValueError(f"Unknown assessment_code: {assessment_code!r}")
    template = load_prompt_template(assessment_code)
    base = interaction_spec_to_mapping(spec)
    if extra:
        merged = {**base, **extra}
    else:
        merged = dict(base)
    return render_prompt_template(template, merged)
