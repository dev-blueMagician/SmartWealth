from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from app.api.routes.internal_workflow import verify_internal_workflow_call
from app.application.services.planning_docx_renderer import render_docx_base64
from app.infrastructure.container import container

router = APIRouter(prefix="/internal/planning", tags=["internal-planning"])
logger = logging.getLogger(__name__)


class ComposePlanningPayloadBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    template: dict[str, Any] = Field(default_factory=dict)
    discovery: dict[str, Any] = Field(default_factory=dict)
    assumptions: dict[str, Any] = Field(default_factory=dict)
    context: dict[str, Any] = Field(default_factory=dict)
    mappingJson: dict[str, Any] = Field(default_factory=dict)
    templateStructure: dict[str, Any] = Field(default_factory=dict)
    templateBase64: str = ""


class AnalyzeTemplateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    templateBase64: str
    mappingJson: dict[str, Any] = Field(default_factory=dict)


class RenderPlanningDocxBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    templateBase64: str = ""
    placeholders: dict[str, str] = Field(default_factory=dict)
    narratives: dict[str, Any] = Field(default_factory=dict)
    documentTemplate: dict[str, Any] = Field(default_factory=dict)
    sectionContent: dict[str, str] = Field(default_factory=dict)
    exportMode: str = "auto"
    appendSummary: bool = True
    appendDocumentSections: bool = False
    summaryTitle: str = "Tóm tắt kế hoạch (AI)"
    documentTitle: str | None = None


@router.post("/analyze-template")
def post_analyze_template(
    body: AnalyzeTemplateBody,
    _auth: None = Depends(verify_internal_workflow_call),
) -> dict[str, Any]:
    import base64

    logger.info(
        "planning.analyze-template request base64Chars=%d mappingKeys=%d",
        len(body.templateBase64),
        len(body.mappingJson.get("placeholders", {}))
        if isinstance(body.mappingJson.get("placeholders"), dict)
        else 0,
    )
    raw = base64.b64decode(body.templateBase64)
    out = container.planning_agent_service.analyze_template(
        raw,
        mapping_json=body.mappingJson,
    )
    analysis = out.get("templateAnalysis")
    detected = out.get("placeholdersDetected")
    logger.info(
        "planning.analyze-template response blocks=%s placeholders=%d tasks=%s",
        analysis.get("blockCount") if isinstance(analysis, dict) else None,
        len(detected) if isinstance(detected, list) else 0,
        out.get("tasksRun"),
    )
    return out


@router.post("/compose")
def post_compose_planning_payload(
    body: ComposePlanningPayloadBody,
    _auth: None = Depends(verify_internal_workflow_call),
) -> dict[str, Any]:
    context = body.context if isinstance(body.context, dict) else {}
    template = body.template if isinstance(body.template, dict) else {}
    mapping_placeholders = body.mappingJson.get("placeholders") if isinstance(body.mappingJson, dict) else None
    mapping_count = len(mapping_placeholders) if isinstance(mapping_placeholders, dict) else 0
    logger.info(
        "planning.compose request caseId=%s clientId=%s templateCode=%s mappingPlaceholders=%d "
        "assumptions=%d fields=%d hasStructure=%s",
        context.get("caseId"),
        context.get("clientId"),
        template.get("code") or context.get("templateCode"),
        mapping_count,
        len(body.assumptions),
        len(body.discovery.get("fields", [])) if isinstance(body.discovery.get("fields"), list) else 0,
        bool(body.templateStructure),
    )
    out = container.planning_agent_service.compose_payload(body.model_dump())
    payload = out.payload if isinstance(out.payload, dict) else {}
    narratives = payload.get("narratives")
    export_placeholders = payload.get("exportPlaceholders")
    logger.info(
        "planning.compose response caseId=%s agent=%s llmUsed=%s llmProvider=%s narratives=%d "
        "exportPlaceholders=%d tasks=%s",
        context.get("caseId"),
        payload.get("agent"),
        payload.get("llmUsed"),
        payload.get("llmProvider"),
        len(narratives) if isinstance(narratives, dict) else 0,
        len(export_placeholders) if isinstance(export_placeholders, dict) else 0,
        payload.get("tasksRun"),
    )
    return out.payload


@router.post("/render-docx")
def post_render_planning_docx(
    body: RenderPlanningDocxBody,
    _auth: None = Depends(verify_internal_workflow_call),
) -> dict[str, Any]:
    logger.info(
        "planning.render-docx request placeholders=%d narratives=%d appendSummary=%s summaryTitle=%s templateBase64Chars=%d",
        len(body.placeholders),
        len(body.narratives),
        body.appendSummary,
        body.summaryTitle,
        len(body.templateBase64),
    )
    out = render_docx_base64(
        template_base64=body.templateBase64,
        placeholders=body.placeholders,
        narratives=body.narratives,
        document_template=body.documentTemplate,
        section_content=body.sectionContent,
        export_mode=body.exportMode,
        append_summary=body.appendSummary,
        append_document_sections=body.appendDocumentSections,
        summary_title=body.summaryTitle,
        document_title=body.documentTitle,
    )
    logger.info(
        "planning.render-docx response exportMode=%s replacementHits=%s byteSize=%s",
        out.get("exportMode"),
        out.get("replacementHits"),
        out.get("byteSize"),
    )
    return out
