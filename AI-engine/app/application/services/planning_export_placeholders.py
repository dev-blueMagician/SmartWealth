from __future__ import annotations

from typing import Any

from app.application.services.planning_discovery_index import build_discovery_field_index


def _tag(key: str) -> str:
    k = (key or "").strip()
    if not k:
        return k
    if k.startswith("{{") and k.endswith("}}"):
        return k
    return "{{" + k + "}}"


def mapping_placeholder_keys(mapping_json: dict[str, Any] | None) -> list[str]:
    if not isinstance(mapping_json, dict):
        return []
    placeholders = mapping_json.get("placeholders")
    if not isinstance(placeholders, dict):
        return []
    return [str(k) for k in placeholders.keys() if k]


def _resolve_mapping_path(path: str, *, narratives: dict[str, str], field_index: dict[str, str]) -> str:
    cleaned = (path or "").strip()
    if not cleaned:
        return ""
    if cleaned in narratives and narratives[cleaned]:
        return narratives[cleaned]
    if cleaned.startswith("discovery.fields."):
        code = cleaned[len("discovery.fields.") :].strip()
        return field_index.get(code, "")
    if cleaned.startswith("discovery."):
        code = cleaned[len("discovery.") :].strip()
        return field_index.get(code, "")
    return field_index.get(cleaned, "")


def build_export_placeholders(
    *,
    narratives: dict[str, Any],
    context: dict[str, Any],
    template: dict[str, Any],
    mapping_json: dict[str, Any] | None,
    llm_export: dict[str, Any] | None,
    discovery: dict[str, Any] | None = None,
) -> dict[str, str]:
    """Merge LLM + rule-based placeholder values for Word export."""
    out: dict[str, str] = {}

    if isinstance(llm_export, dict):
        for k, v in llm_export.items():
            if v is not None and str(v).strip():
                out[_tag(str(k))] = str(v).strip()

    exec_sum = str(narratives.get("executiveSummary") or "").strip()
    situation = str(narratives.get("situationAnalysis") or "").strip()
    recommendations = str(narratives.get("recommendations") or "").strip()
    data_quality = str(narratives.get("dataQualityNotes") or "").strip()

    defaults = {
        "EXECUTIVE_SUMMARY": exec_sum,
        "SITUATION_ANALYSIS": situation,
        "RECOMMENDATIONS": recommendations,
        "DATA_QUALITY": data_quality,
        "TOM_LUOC": exec_sum,
        "TOM_TAT": exec_sum,
        "CLIENT_ID": str(context.get("clientId") or ""),
        "CASE_ID": str(context.get("caseId") or ""),
        "TEMPLATE_CODE": str(template.get("code") or context.get("templateCode") or ""),
        "TEMPLATE_NAME": str(template.get("name") or ""),
        "GENERATED_AT": str(context.get("generatedAt") or ""),
    }
    for key, value in defaults.items():
        if value:
            out.setdefault(_tag(key), value)

    narrative_paths = {
        "aiNarratives.executiveSummary": exec_sum,
        "aiNarratives.situationAnalysis": situation,
        "aiNarratives.recommendations": recommendations,
        "aiNarratives.dataQualityNotes": data_quality,
    }
    field_index = build_discovery_field_index(discovery)
    placeholders = mapping_json.get("placeholders") if isinstance(mapping_json, dict) else None
    if isinstance(placeholders, dict):
        for tag_key, path in placeholders.items():
            if not isinstance(path, str):
                continue
            value = _resolve_mapping_path(
                path.strip(),
                narratives=narrative_paths,
                field_index=field_index,
            )
            if value:
                key = str(tag_key).strip()
                out.setdefault(key if key.startswith("[") else _tag(key), value)

    profile = context.get("clientProfile") if isinstance(context.get("clientProfile"), dict) else {}
    client_name = str(profile.get("name") or "").strip()
    if client_name:
        out.setdefault("[Client name / household name]", client_name)
        out.setdefault("{{CLIENT_NAME}}", client_name)

    return out
