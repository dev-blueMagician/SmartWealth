from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict

from app.application.services.planning_discovery_index import (
    build_discovery_field_index,
    build_discovery_prompt_index,
)
from app.application.services.planning_docx_extractor import analyze_docx_template
from app.application.services.planning_export_placeholders import build_export_placeholders
from app.application.services.planning_section_briefs import build_section_compose_briefs
from app.application.services.planning_section_enricher import enrich_section_content_from_sources
from app.application.services.planning_template_structure import (
    document_template_from_analysis,
    ensure_section_content_coverage,
    merge_document_templates,
)
from app.application.services.planning_llm_json import parse_llm_json
from app.infrastructure.config.settings import Settings
from app.infrastructure.llm.factory import (
    assessment_llm_ready,
    chat_completion_adapter_from_settings,
    narrative_label_for_provider,
)

logger = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).resolve().parents[2] / "prompts"


class PlanningComposeGraphState(TypedDict, total=False):
    discovery: dict[str, Any]
    assumptions: dict[str, Any]
    template: dict[str, Any]
    context: dict[str, Any]
    mapping_json: dict[str, Any]
    template_structure: dict[str, Any]
    template_base64: str

    mandatory_total: int
    mandatory_filled: int
    mandatory_missing: int
    coverage: float
    rule_quality: str

    template_analysis: dict[str, Any]
    document_template: dict[str, Any]
    plan_llm: dict[str, Any]
    compose_llm: dict[str, Any]

    narratives: dict[str, Any]
    export_placeholders: dict[str, str]
    section_content: dict[str, str]

    llm_used: bool
    llm_provider: str | None
    tasks_run: list[str]


class PlanningComposeOrchestrator:
    """LangGraph pipeline: analyze → plan document → compose content → bind preview."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._graph = self._build_graph()

    def run(self, body: dict[str, Any]) -> dict[str, Any]:
        initial: PlanningComposeGraphState = {
            "discovery": body.get("discovery") if isinstance(body.get("discovery"), dict) else {},
            "assumptions": body.get("assumptions") if isinstance(body.get("assumptions"), dict) else {},
            "template": body.get("template") if isinstance(body.get("template"), dict) else {},
            "context": body.get("context") if isinstance(body.get("context"), dict) else {},
            "mapping_json": body.get("mappingJson") if isinstance(body.get("mappingJson"), dict) else {},
            "template_structure": (
                body.get("templateStructure") if isinstance(body.get("templateStructure"), dict) else {}
            ),
            "template_base64": str(body.get("templateBase64") or ""),
            "tasks_run": [],
        }
        final = self._graph.invoke(initial)
        return self._build_payload(final)

    def analyze_template_bytes(self, template_bytes: bytes, *, mapping_json: dict[str, Any] | None = None) -> dict[str, Any]:
        state: PlanningComposeGraphState = {
            "mapping_json": mapping_json or {},
            "template_base64": "",
            "tasks_run": [],
        }
        extract = analyze_docx_template(template_bytes)
        state["template_analysis"] = extract
        state["tasks_run"] = ["extract_template"]
        if assessment_llm_ready(self._settings):
            enriched = self._llm_analyze(extract, mapping_json or {})
            if enriched:
                state["template_analysis"] = _merge_analysis(extract, enriched)
                state["tasks_run"] = ["extract_template", "llm_analyze"]
        detected = state.get("template_analysis", {}).get("detectedPlaceholders", [])
        return {
            "templateAnalysis": state["template_analysis"],
            "placeholdersDetected": detected if isinstance(detected, list) else [],
            "tasksRun": state.get("tasks_run", []),
        }

    def _build_graph(self):  # noqa: ANN202
        graph = StateGraph(PlanningComposeGraphState)
        graph.add_node("ingest", self._node_ingest)
        graph.add_node("analyze_template", self._node_analyze_template)
        graph.add_node("plan_document", self._node_plan_document)
        graph.add_node("compose_content", self._node_compose_content)
        graph.add_node("bind_preview", self._node_bind_preview)
        graph.add_node("finalize", self._node_finalize)
        graph.add_edge(START, "ingest")
        graph.add_edge("ingest", "analyze_template")
        graph.add_edge("analyze_template", "plan_document")
        graph.add_edge("plan_document", "compose_content")
        graph.add_edge("compose_content", "bind_preview")
        graph.add_edge("bind_preview", "finalize")
        graph.add_edge("finalize", END)
        return graph.compile()

    def _node_ingest(self, state: PlanningComposeGraphState) -> PlanningComposeGraphState:
        discovery = state.get("discovery") or {}
        mandatory_total = int(discovery.get("mandatoryFieldsTotal", 0) or 0)
        mandatory_filled = int(discovery.get("mandatoryFieldsFilled", 0) or 0)
        missing = int(
            discovery.get("mandatoryFieldsMissing", max(mandatory_total - mandatory_filled, 0)) or 0
        )
        coverage = 1.0 if mandatory_total <= 0 else round(mandatory_filled / mandatory_total, 4)
        tasks = list(state.get("tasks_run") or [])
        tasks.append("ingest")
        return {
            **state,
            "mandatory_total": mandatory_total,
            "mandatory_filled": mandatory_filled,
            "mandatory_missing": missing,
            "coverage": coverage,
            "rule_quality": "READY_FOR_REVIEW" if missing == 0 else "DRAFT",
            "tasks_run": tasks,
        }

    def _node_analyze_template(self, state: PlanningComposeGraphState) -> PlanningComposeGraphState:
        tasks = list(state.get("tasks_run") or [])
        cached = state.get("template_structure") or {}
        b64 = (state.get("template_base64") or "").strip()
        analysis: dict[str, Any]
        if cached and _analysis_has_logical_sections(cached) and not b64:
            analysis = dict(cached)
            tasks.append("analyze_cached")
        elif b64:
            import base64

            raw = base64.b64decode(b64)
            analysis = analyze_docx_template(raw)
            if cached:
                analysis = _merge_analysis(dict(cached), analysis)
            tasks.append("analyze_extract")
        elif cached:
            analysis = dict(cached)
            tasks.append("analyze_cached")
        else:
            analysis = _analysis_from_mapping(state.get("mapping_json") or {})
            tasks.append("analyze_mapping_only")

        if assessment_llm_ready(self._settings) and analysis.get("sections"):
            enriched = self._llm_analyze(analysis, state.get("mapping_json") or {})
            if enriched:
                analysis = _merge_analysis(analysis, enriched)
                tasks.append("llm_analyze")

        return {**state, "template_analysis": analysis, "tasks_run": tasks}

    def _node_plan_document(self, state: PlanningComposeGraphState) -> PlanningComposeGraphState:
        tasks = list(state.get("tasks_run") or [])
        plan_llm: dict[str, Any] = {}
        locale = (state.get("template") or {}).get("locale") or (state.get("context") or {}).get("templateLocale") or "vi-VN"
        structural = document_template_from_analysis(state.get("template_analysis") or {}, locale=locale)
        document_template = structural if structural.get("sections") else _default_document_template(state)
        provider = state.get("llm_provider")

        if assessment_llm_ready(self._settings):
            parsed = self._llm_chat(
                prompt_path=_PROMPTS_DIR / "planning_plan_document.md",
                user_sections=[
                    "## Template metadata",
                    json.dumps(state.get("template") or {}, ensure_ascii=False, indent=2),
                    "## Template analysis",
                    json.dumps(_discovery_analysis_for_plan(state.get("template_analysis") or {}), ensure_ascii=False, indent=2),
                    "## Assumptions",
                    json.dumps(state.get("assumptions") or {}, ensure_ascii=False, indent=2),
                    "## Discovery dataset (summary)",
                    json.dumps(_discovery_summary(state.get("discovery") or {}), ensure_ascii=False, indent=2),
                    "## Discovery field index (filled values only)",
                    json.dumps(build_discovery_prompt_index(state.get("discovery") or {}), ensure_ascii=False, indent=2),
                    "## Runtime context",
                    json.dumps(state.get("context") or {}, ensure_ascii=False, indent=2),
                    f"## Rule quality gate hint: {state.get('rule_quality')}",
                ],
            )
            if parsed:
                plan_llm = parsed
                doc = parsed.get("documentTemplate")
                if isinstance(doc, dict) and doc.get("sections"):
                    document_template = merge_document_templates(document_template, doc)
                tasks.append("plan_document")
                provider = narrative_label_for_provider(self._settings.llm_provider)

        return {
            **state,
            "plan_llm": plan_llm,
            "document_template": document_template,
            "tasks_run": tasks,
            "llm_used": state.get("llm_used", False) or bool(plan_llm),
            "llm_provider": provider,
        }

    def _node_compose_content(self, state: PlanningComposeGraphState) -> PlanningComposeGraphState:
        tasks = list(state.get("tasks_run") or [])
        compose_llm: dict[str, Any] = {}
        missing = int(state.get("mandatory_missing") or 0)
        rule_quality = str(state.get("rule_quality") or "DRAFT")

        discovery = state.get("discovery") or {}
        if assessment_llm_ready(self._settings):
            compose_llm = self._run_compose_llm(state, rule_quality=rule_quality)
            if compose_llm:
                tasks.append("compose_content")

        executive_summary = compose_llm.get("executiveSummary") or (
            "Planning draft generated with complete mandatory discovery coverage."
            if missing == 0
            else "Planning draft generated with missing mandatory discovery fields; keep draft status."
        )
        data_quality = compose_llm.get("dataQualityNotes") or (
            "Mandatory discovery complete."
            if missing == 0
            else f"{missing} mandatory discovery field(s) still missing."
        )
        quality_gate = str(compose_llm.get("qualityGate") or rule_quality).strip() or rule_quality

        narratives = {
            "executiveSummary": executive_summary,
            "situationAnalysis": compose_llm.get("situationAnalysis") or "",
            "recommendations": compose_llm.get("recommendations") or "",
            "dataQualityNotes": data_quality,
            "qualityGate": quality_gate,
        }
        section_content = compose_llm.get("sectionContent")
        if not isinstance(section_content, dict):
            section_content = {}
        client_profile = _client_profile_from_state(state)
        unmapped = _unmapped_answers_from_discovery(discovery)
        section_content = enrich_section_content_from_sources(
            state.get("document_template") or {},
            section_content,
            discovery,
            client_profile=client_profile,
            unmapped_answers=unmapped,
            context=state.get("context") if isinstance(state.get("context"), dict) else {},
            template=state.get("template") if isinstance(state.get("template"), dict) else {},
        )
        section_content = _apply_mapping_bindings_to_sections(
            section_content,
            state.get("mapping_json") or {},
            build_discovery_field_index(discovery),
        )
        section_content = ensure_section_content_coverage(
            state.get("document_template") or {},
            section_content,
            data_quality_notes=str(data_quality or ""),
        )

        llm_used = bool(state.get("llm_used")) or bool(compose_llm) or bool(state.get("plan_llm"))
        provider = state.get("llm_provider")
        if compose_llm:
            provider = narrative_label_for_provider(self._settings.llm_provider)

        return {
            **state,
            "compose_llm": compose_llm,
            "narratives": narratives,
            "section_content": section_content,
            "tasks_run": tasks,
            "llm_used": llm_used,
            "llm_provider": provider,
        }

    def _node_bind_preview(self, state: PlanningComposeGraphState) -> PlanningComposeGraphState:
        tasks = list(state.get("tasks_run") or [])
        narratives = state.get("narratives") or {}
        compose_llm = state.get("compose_llm") or {}
        llm_export = compose_llm.get("exportPlaceholders")
        export_placeholders = build_export_placeholders(
            narratives=narratives,
            context=state.get("context") or {},
            template=state.get("template") or {},
            mapping_json=state.get("mapping_json") or {},
            llm_export=llm_export if isinstance(llm_export, dict) else None,
            discovery=state.get("discovery") or {},
        )
        export_placeholders = _apply_document_template_bindings(
            export_placeholders,
            state.get("document_template") or {},
            state.get("section_content") or {},
        )
        tasks.append("bind_preview")
        return {**state, "export_placeholders": export_placeholders, "tasks_run": tasks}

    def _node_finalize(self, state: PlanningComposeGraphState) -> PlanningComposeGraphState:
        tasks = list(state.get("tasks_run") or [])
        tasks.append("finalize")
        return {**state, "tasks_run": tasks}

    def _build_payload(self, state: PlanningComposeGraphState) -> dict[str, Any]:
        return {
            "agent": "planning_agent_v2",
            "agentVersion": 2,
            "tasksRun": state.get("tasks_run") or [],
            "llmUsed": bool(state.get("llm_used")),
            "llmProvider": state.get("llm_provider"),
            "template": state.get("template") or {},
            "assumptions": state.get("assumptions") or {},
            "discovery": state.get("discovery") or {},
            "templateAnalysis": state.get("template_analysis") or {},
            "documentTemplate": state.get("document_template") or {},
            "sectionContent": state.get("section_content") or {},
            "keyMetrics": {
                "mandatoryCoverage": state.get("coverage", 0.0),
                "mandatoryMissing": state.get("mandatory_missing", 0),
            },
            "narratives": state.get("narratives") or {},
            "exportPlaceholders": state.get("export_placeholders") or {},
        }

    def _llm_analyze(self, extract: dict[str, Any], mapping_json: dict[str, Any]) -> dict[str, Any]:
        return self._llm_chat(
            prompt_path=_PROMPTS_DIR / "planning_analyze.md",
            user_sections=[
                "## Extracted template structure",
                json.dumps(extract, ensure_ascii=False, indent=2),
                "## Manual mapping (optional overrides)",
                json.dumps(mapping_json, ensure_ascii=False, indent=2),
            ],
        )

    def _run_compose_llm(self, state: PlanningComposeGraphState, *, rule_quality: str) -> dict[str, Any]:
        discovery = state.get("discovery") or {}
        document_template = state.get("document_template") or {}
        template_analysis = state.get("template_analysis") or {}
        sections = [
            s
            for s in (document_template.get("sections") or [])
            if isinstance(s, dict) and s.get("include") is not False
        ]
        common = self._compose_user_sections(state, discovery=discovery, rule_quality=rule_quality)
        batch_size = 6

        if len(sections) <= batch_size:
            parsed = self._llm_chat(
                prompt_path=_PROMPTS_DIR / "planning_compose.md",
                user_sections=common
                + [
                    "## Section compose briefs (write every sectionId)",
                    json.dumps(
                        build_section_compose_briefs(document_template, template_analysis),
                        ensure_ascii=False,
                        indent=2,
                    ),
                ],
            )
            return parsed or {}

        merged_content: dict[str, str] = {}
        compose_llm: dict[str, Any] = {}
        for batch_index in range(0, len(sections), batch_size):
            batch_sections = sections[batch_index : batch_index + batch_size]
            batch_template = {**document_template, "sections": batch_sections}
            briefs = build_section_compose_briefs(batch_template, template_analysis)
            if batch_index == 0:
                parsed = self._llm_chat(
                    prompt_path=_PROMPTS_DIR / "planning_compose.md",
                    user_sections=common
                    + [
                        "## Section compose briefs (batch 1 — include narratives + all sections in this batch)",
                        json.dumps(briefs, ensure_ascii=False, indent=2),
                    ],
                )
                if parsed:
                    compose_llm = dict(parsed)
                    batch_content = parsed.get("sectionContent")
                    if isinstance(batch_content, dict):
                        merged_content.update({str(k): str(v) for k, v in batch_content.items() if v})
            else:
                parsed = self._llm_chat(
                    prompt_path=_PROMPTS_DIR / "planning_compose_sections.md",
                    user_sections=common
                    + [
                        f"## Section compose briefs (batch {batch_index // batch_size + 1})",
                        json.dumps(briefs, ensure_ascii=False, indent=2),
                    ],
                )
                if parsed:
                    batch_content = parsed.get("sectionContent")
                    if isinstance(batch_content, dict):
                        merged_content.update({str(k): str(v) for k, v in batch_content.items() if v})
        compose_llm["sectionContent"] = merged_content
        logger.info(
            "planning_graph.compose_batched sections=%d batches=%d sectionContentKeys=%d",
            len(sections),
            (len(sections) + batch_size - 1) // batch_size,
            len(merged_content),
        )
        return compose_llm

    def _compose_user_sections(
        self,
        state: PlanningComposeGraphState,
        *,
        discovery: dict[str, Any],
        rule_quality: str,
    ) -> list[str]:
        context = dict(state.get("context") or {})
        client_profile = _client_profile_from_state(state)
        if client_profile and "clientProfile" not in context:
            context["clientProfile"] = client_profile
        return [
            "## Document template (plan)",
            json.dumps(state.get("document_template") or {}, ensure_ascii=False, indent=2),
            "## Template analysis",
            json.dumps(_discovery_analysis_for_plan(state.get("template_analysis") or {}), ensure_ascii=False, indent=2),
            "## Client profile",
            json.dumps(client_profile, ensure_ascii=False, indent=2),
            "## Unmapped discovery answers",
            json.dumps(_unmapped_answers_from_discovery(discovery), ensure_ascii=False, indent=2),
            "## Assumptions",
            json.dumps(state.get("assumptions") or {}, ensure_ascii=False, indent=2),
            "## Discovery field index (use these values; do not invent numbers)",
            json.dumps(build_discovery_prompt_index(discovery), ensure_ascii=False, indent=2),
            "## Manual mapping hints",
            json.dumps(state.get("mapping_json") or {}, ensure_ascii=False, indent=2),
            "## Runtime context",
            json.dumps(context, ensure_ascii=False, indent=2),
            f"## Rule quality gate hint: {rule_quality}",
        ]

    def _llm_chat(self, *, prompt_path: Path, user_sections: list[str]) -> dict[str, Any]:
        system = prompt_path.read_text(encoding="utf-8")
        user = "\n\n".join(user_sections)
        llm = chat_completion_adapter_from_settings(self._settings)
        chat = llm.chat(system=system, user=user)
        parsed = parse_llm_json(chat.text)
        if not parsed:
            logger.warning(
                "planning_graph.llm parse_failed prompt=%s chars=%d",
                prompt_path.name,
                len(chat.text or ""),
            )
        return parsed


def _analysis_from_mapping(mapping_json: dict[str, Any]) -> dict[str, Any]:
    placeholders = mapping_json.get("placeholders") if isinstance(mapping_json, dict) else None
    detected: list[str] = []
    if isinstance(placeholders, dict):
        for key in placeholders.keys():
            tag = str(key).strip()
            if not tag:
                continue
            if not tag.startswith("{{"):
                tag = "{{" + tag + "}}"
            if tag not in detected:
                detected.append(tag)
    return {
        "version": 1,
        "blockCount": 0,
        "sections": [],
        "detectedPlaceholders": detected,
        "source": "mapping_only",
    }


def _analysis_has_logical_sections(analysis: dict[str, Any]) -> bool:
    logical = analysis.get("logicalSections")
    return isinstance(logical, list) and len(logical) >= 3


def _merge_analysis(base: dict[str, Any], enriched: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    if isinstance(enriched.get("logicalSections"), list) and enriched["logicalSections"]:
        merged["logicalSections"] = enriched["logicalSections"]
        merged["logicalSectionCount"] = enriched.get("logicalSectionCount", len(enriched["logicalSections"]))
    if isinstance(enriched.get("detectedPlaceholders"), list) and enriched["detectedPlaceholders"]:
        merged["detectedPlaceholders"] = enriched["detectedPlaceholders"]
    if enriched.get("blockCount"):
        merged["blockCount"] = enriched["blockCount"]
    if enriched.get("sectionSummary"):
        merged["sectionSummary"] = enriched["sectionSummary"]
    if isinstance(enriched.get("enrichedSections"), list):
        merged["enrichedSections"] = enriched["enrichedSections"]
    if isinstance(enriched.get("detectedPlaceholders"), list):
        merged["detectedPlaceholders"] = enriched["detectedPlaceholders"]
    if isinstance(enriched.get("bindingHints"), dict):
        merged["bindingHints"] = enriched["bindingHints"]
    return merged


def _default_document_template(state: PlanningComposeGraphState) -> dict[str, Any]:
    analysis = state.get("template_analysis") or {}
    detected = analysis.get("detectedPlaceholders")
    tags = detected if isinstance(detected, list) else []
    locale = (state.get("template") or {}).get("locale") or (state.get("context") or {}).get("templateLocale") or "vi-VN"
    sections: list[dict[str, Any]] = [
        {
            "id": "executive",
            "title": "Tóm lược điều hành",
            "placeholders": ["{{EXECUTIVE_SUMMARY}}", "{{TOM_LUOC}}", "{{TOM_TAT}}"],
            "draftHint": "Executive summary from discovery",
            "dataPaths": ["aiNarratives.executiveSummary"],
            "include": True,
        },
        {
            "id": "situation",
            "title": "Phân tích hiện trạng",
            "placeholders": ["{{SITUATION_ANALYSIS}}"],
            "draftHint": "Situation analysis",
            "dataPaths": ["aiNarratives.situationAnalysis"],
            "include": True,
        },
        {
            "id": "recommendations",
            "title": "Khuyến nghị",
            "placeholders": ["{{RECOMMENDATIONS}}"],
            "draftHint": "Recommendations",
            "dataPaths": ["aiNarratives.recommendations"],
            "include": True,
        },
    ]
    if tags:
        sections.append(
            {
                "id": "template_tags",
                "title": "Template merge fields",
                "placeholders": tags[:40],
                "draftHint": "Fill from discovery and narratives",
                "dataPaths": [],
                "include": True,
            }
        )
    return {"version": 1, "locale": locale, "sections": sections}


def _discovery_summary(discovery: dict[str, Any]) -> dict[str, Any]:
    fields = discovery.get("fields")
    if isinstance(fields, dict):
        field_count = len(fields)
        filled_count = sum(1 for row in fields.values() if _discovery_row_has_value(row))
    elif isinstance(fields, list):
        field_count = len(fields)
        filled_count = sum(1 for row in fields if _discovery_row_has_value(row))
    else:
        field_count = 0
        filled_count = 0
    return {
        "mandatoryFieldsTotal": discovery.get("mandatoryFieldsTotal"),
        "mandatoryFieldsFilled": discovery.get("mandatoryFieldsFilled"),
        "mandatoryFieldsMissing": discovery.get("mandatoryFieldsMissing"),
        "fieldCount": field_count,
        "filledFieldCount": filled_count,
        "unmappedCount": len(discovery.get("unmappedAnswers", []))
        if isinstance(discovery.get("unmappedAnswers"), list)
        else 0,
    }


def _discovery_row_has_value(row: Any) -> bool:
    if not isinstance(row, dict):
        return bool(str(row or "").strip())
    if str(row.get("valueText") or "").strip():
        return True
    return row.get("valueJsonb") is not None


def _discovery_analysis_for_plan(analysis: dict[str, Any]) -> dict[str, Any]:
    """Trim block-level extract for LLM; keep logical section outline."""
    if not isinstance(analysis, dict):
        return {}
    logical = analysis.get("logicalSections")
    out: dict[str, Any] = {
        "version": analysis.get("version"),
        "logicalSectionCount": analysis.get("logicalSectionCount"),
        "detectedPlaceholders": (analysis.get("detectedPlaceholders") or [])[:80],
        "sectionSummary": analysis.get("sectionSummary"),
        "bindingHints": analysis.get("bindingHints"),
    }
    if isinstance(logical, list):
        out["logicalSections"] = [
            {
                "id": s.get("id"),
                "number": s.get("number"),
                "title": s.get("title"),
                "bracketSlotCount": len(s.get("bracketSlots") or []),
                "placeholderCount": len(s.get("placeholders") or []),
                "bracketSlots": (s.get("bracketSlots") or [])[:12],
            }
            for s in logical
            if isinstance(s, dict)
        ]
    return out


def _client_profile_from_state(state: PlanningComposeGraphState) -> dict[str, Any]:
    context = state.get("context") or {}
    if isinstance(context, dict):
        profile = context.get("clientProfile")
        if isinstance(profile, dict):
            return profile
    discovery = state.get("discovery") or {}
    if isinstance(discovery, dict):
        profile = discovery.get("clientProfile")
        if isinstance(profile, dict):
            return profile
    return {}


def _unmapped_answers_from_discovery(discovery: dict[str, Any]) -> list[dict[str, Any]]:
    raw = discovery.get("unmappedAnswers")
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for row in raw[:80]:
        if isinstance(row, dict):
            out.append(row)
    return out


def _apply_mapping_bindings_to_sections(
    section_content: dict[str, str],
    mapping_json: dict[str, Any],
    field_index: dict[str, str],
) -> dict[str, str]:
    """Apply mappingJson sectionBindings: section id → list of systemField codes."""
    bindings = mapping_json.get("sectionBindings") if isinstance(mapping_json, dict) else None
    if not isinstance(bindings, dict) or not field_index:
        return section_content
    out = dict(section_content)
    for section_id, paths in bindings.items():
        if not isinstance(paths, list):
            continue
        lines: list[str] = []
        for path in paths:
            code = str(path or "").strip()
            if not code:
                continue
            value = field_index.get(code)
            if value:
                lines.append(f"- {code}: {value}")
        if lines and not str(out.get(str(section_id)) or "").strip():
            out[str(section_id)] = "\n".join(lines)
    return out


def _apply_document_template_bindings(
    export_placeholders: dict[str, str],
    document_template: dict[str, Any],
    section_content: dict[str, str],
) -> dict[str, str]:
    out = dict(export_placeholders)
    sections = document_template.get("sections")
    if not isinstance(sections, list):
        return out
    for section in sections:
        if not isinstance(section, dict):
            continue
        if section.get("include") is False:
            continue
        section_id = str(section.get("id") or "")
        body = section_content.get(section_id) if section_id else None
        placeholders = section.get("placeholders")
        if not isinstance(placeholders, list) or not placeholders:
            continue
        if body and str(body).strip():
            primary = str(placeholders[0]).strip()
            if primary:
                tag = primary if primary.startswith("{{") else "{{" + primary + "}}"
                out.setdefault(tag, str(body).strip())
    return out
