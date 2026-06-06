from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.application.services.workflow_service import WorkflowService
from app.infrastructure.container import container

router = APIRouter(prefix="/api/v1/workflows", tags=["workflows"])


class CreateWorkflowRequest(BaseModel):
    payload: dict[str, Any] = Field(default_factory=dict)


class HumanApprovalRequest(BaseModel):
    approved: bool
    reviewer_id: str
    note: str | None = None


def get_workflow_service() -> WorkflowService:
    return container.workflow_service


@router.post("")
def create_workflow(
    request: CreateWorkflowRequest,
    service: WorkflowService = Depends(get_workflow_service),
) -> dict:
    return service.create_workflow(payload=request.payload)


@router.post("/{workflow_id}/run")
async def run_workflow(
    workflow_id: str,
    service: WorkflowService = Depends(get_workflow_service),
) -> dict:
    try:
        return await service.run_workflow(workflow_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("")
def list_workflows(
    limit: int = Query(default=100, ge=1, le=1000),
    service: WorkflowService = Depends(get_workflow_service),
) -> list[dict]:
    return service.list_workflows(limit=limit)


@router.get("/{workflow_id}")
def get_workflow(
    workflow_id: str,
    service: WorkflowService = Depends(get_workflow_service),
) -> dict:
    try:
        return service.get_workflow(workflow_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{workflow_id}/audit-events")
def list_audit_events(
    workflow_id: str,
    service: WorkflowService = Depends(get_workflow_service),
) -> list[dict]:
    try:
        return service.list_audit_events(workflow_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{workflow_id}/human-approval")
def apply_human_approval(
    workflow_id: str,
    request: HumanApprovalRequest,
    service: WorkflowService = Depends(get_workflow_service),
) -> dict:
    try:
        return service.apply_human_approval(
            workflow_id=workflow_id,
            approved=request.approved,
            reviewer_id=request.reviewer_id,
            note=request.note,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
