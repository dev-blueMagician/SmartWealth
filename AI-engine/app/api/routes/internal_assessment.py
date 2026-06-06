from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.api.routes.internal_workflow import verify_internal_workflow_call
from app.domain.smartwealth.models import AIResult
from app.infrastructure.container import container

router = APIRouter(prefix="/internal/assessment", tags=["internal-assessment"])


class ExecuteAssessmentBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_id: str = Field(min_length=1, description="Primary key in orchestration_request.")


def _ai_result_to_jsonable(result: AIResult) -> dict[str, Any]:
    return {
        "result_id": result.result_id,
        "request_id": result.request_id,
        "step_name": result.step_name,
        "provider": result.provider,
        "model": result.model,
        "output_text": result.output_text,
        "confidence_score": result.confidence_score,
        "confidence_threshold": result.confidence_threshold,
        "decision": result.decision.value,
        "decision_reason": result.decision_reason,
        "latency_ms": result.latency_ms,
        "input_tokens": result.input_tokens,
        "output_tokens": result.output_tokens,
        "produced_at": result.produced_at.isoformat(),
        "trace_id": result.trace_id,
        "safety_flagged": result.safety_flagged,
        "safety_category": result.safety_category,
        "human_approval_required": result.human_approval_required,
        "human_approval_status": result.human_approval_status,
        "approved_by_user_id": result.approved_by_user_id,
        "approved_at": result.approved_at.isoformat() if result.approved_at else None,
        "ssot_record_id": result.ssot_record_id,
        "ssot_record_type": result.ssot_record_type,
        "ssot_record_version": result.ssot_record_version,
        "ssot_snapshot_id": result.ssot_snapshot_id,
    }


@router.post("/execute")
def post_execute_assessment(
    body: ExecuteAssessmentBody,
    _auth: None = Depends(verify_internal_workflow_call),
) -> dict[str, Any]:
    """
    Load one row from orchestration_request (request header + runtime columns on same row),
    resolve OrchestrationContext via SqlContextDataRepository, run the assessment agent.

    Rule-only path uses ``CompletenessAgent``. When ``ASSESSMENT_LLM_ENABLED=true`` and
    credentials for ``LLM_PROVIDER`` are set, runs rules plus LLM (see ``CompletenessLlmAgent``);
    merged JSON includes ``llm_assistant``.

    Does not persist ai_result; use POST /internal/workflow/process-ai-events for DB-backed queue flow.
    Requires DATABASE_URL / DB_* and AI-engine/scripts/sql/orchestration_minimal.sql (+ seeds).
    """
    try:
        result = container.assessment_execute_service.execute_by_request_id(body.request_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "PostgreSQL driver not installed. Run: pip install 'psycopg[binary]' "
                f"(import error: {exc})"
            ),
        ) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Database unavailable: {exc}",
        ) from exc

    payload = _ai_result_to_jsonable(result)
    try:
        payload["findings"] = json.loads(result.output_text)
    except json.JSONDecodeError:
        payload["findings"] = None
    return payload
