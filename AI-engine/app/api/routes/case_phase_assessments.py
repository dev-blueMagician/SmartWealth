from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.domain.smartwealth.case_phase_manifest import (
    assessments_for_phase,
    list_phase_keys_in_order,
    load_case_phase_manifest,
)

router = APIRouter(prefix="/api/v1", tags=["case-phase-assessments"])


@router.get("/case-phase-assessments")
def get_case_phase_assessments(
    case_phase: str | None = Query(
        default=None,
        description="Filter assessments for one phase (e.g. ONBOARDING). Omit for full manifest.",
    ),
) -> dict[str, Any]:
    manifest = load_case_phase_manifest()
    version = manifest.get("version", "1")
    phases_obj = manifest.get("phases")
    if not isinstance(phases_obj, dict):
        raise HTTPException(status_code=500, detail="Invalid manifest: phases.")

    if case_phase is None or not str(case_phase).strip():
        return {
            "version": version,
            "phase_order": list(list_phase_keys_in_order(manifest)),
            "phases": phases_obj,
        }

    key = case_phase.strip().upper()
    if key not in phases_obj:
        allowed = ", ".join(list_phase_keys_in_order(manifest))
        raise HTTPException(
            status_code=400,
            detail=f"Unknown case_phase {case_phase!r}. Allowed: {allowed}",
        )
    return {
        "version": version,
        "case_phase": key,
        "assessments": assessments_for_phase(manifest, key),
    }
