"""Case phase → assessment_code manifest: PostgreSQL when seeded, else embedded bootstrap (`catalog_seed`)."""

from __future__ import annotations

from functools import lru_cache
from typing import Any, Final

_PHASE_ORDER: Final[tuple[str, ...]] = (
    "ONBOARDING",
    "DISCOVERY",
    "PLANNING",
    "COLLABORATION",
    "EXECUTION",
    "MONITORING",
)


def _default_case_phase_manifest() -> dict[str, Any]:
    from app.domain.smartwealth.catalog_seed import CASE_PHASE_ASSESSMENT_MANIFEST

    raw = dict(CASE_PHASE_ASSESSMENT_MANIFEST)
    phases = raw.get("phases")
    if not isinstance(phases, dict):
        raise ValueError("catalog_seed manifest.phases must be a JSON object.")
    for key, codes in phases.items():
        if not isinstance(key, str):
            raise ValueError("manifest phase keys must be strings.")
        if not isinstance(codes, list) or not all(isinstance(c, str) for c in codes):
            raise ValueError(f"manifest.phases[{key!r}] must be a list of strings.")
    return raw


def _load_case_phase_manifest_from_db() -> dict[str, Any]:
    from app.infrastructure.catalog.postgres_ai_catalog import fetch_case_phase_manifest_dict
    from app.infrastructure.config.settings import Settings

    return fetch_case_phase_manifest_dict(Settings().resolved_database_url)


@lru_cache(maxsize=1)
def load_case_phase_manifest() -> dict[str, Any]:
    try:
        return _load_case_phase_manifest_from_db()
    except Exception:
        return _default_case_phase_manifest()


def clear_case_phase_manifest_cache() -> None:
    """Invalidate cached manifest (e.g. after updating ``case_phase`` / ``ai_interaction``)."""
    load_case_phase_manifest.cache_clear()


def list_phase_keys_in_order(manifest: dict[str, Any]) -> tuple[str, ...]:
    phases = manifest.get("phases", {})
    if not isinstance(phases, dict):
        return ()
    ordered = [p for p in _PHASE_ORDER if p in phases]
    rest = sorted(k for k in phases.keys() if k not in ordered)
    return tuple(ordered + rest)


def assessments_for_phase(manifest: dict[str, Any], case_phase: str) -> list[str]:
    phases = manifest.get("phases", {})
    if not isinstance(phases, dict):
        return []
    codes = phases.get(case_phase.strip())
    if not isinstance(codes, list):
        return []
    return [str(c) for c in codes]
