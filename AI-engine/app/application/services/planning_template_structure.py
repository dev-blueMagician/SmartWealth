from __future__ import annotations

from typing import Any

PLAN_INFORMATION_SECTION_ID = "plan_information"


def _section_sort_key(section: dict[str, Any]) -> tuple[int, str]:
    if section.get("id") == PLAN_INFORMATION_SECTION_ID or section.get("preamble"):
        return (0, "")
    number = str(section.get("number") or "").strip()
    if number.isdigit():
        return (int(number), str(section.get("title") or ""))
    return (999, str(section.get("title") or ""))


def sort_document_sections(sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(sections, key=_section_sort_key)


def ensure_plan_information_section(sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Ensure cover / Plan Information section exists at the start of the template."""
    if any(str(s.get("id") or "") == PLAN_INFORMATION_SECTION_ID for s in sections if isinstance(s, dict)):
        return sort_document_sections(sections)
    plan_info = {
        "id": PLAN_INFORMATION_SECTION_ID,
        "title": "Plan Information",
        "number": "",
        "preamble": True,
        "sortOrder": 0,
        "include": True,
        "draftHint": (
            "Client-facing cover: subtitle, Plan Information rows (client, RM, dates, objective, "
            "currency, status), and important disclaimer before section 1."
        ),
        "placeholders": [
            "[Client name / household name]",
            "[RM / advisor name]",
            "[DD/MM/YYYY]",
            "[Start date]",
            "[target date]",
            "[Save for home / Pay back home loan / Refinance / Hybrid plan]",
            "[VND / USD / other]",
            "[Draft / Reviewed / Final]",
        ],
        "dataPaths": [],
    }
    return [plan_info, *sections]


def document_template_from_analysis(
    analysis: dict[str, Any] | None,
    *,
    locale: str = "vi-VN",
) -> dict[str, Any]:
    """Build a compose/export documentTemplate from deterministic template analysis."""
    if not isinstance(analysis, dict):
        return {"version": 1, "locale": locale, "sections": []}

    logical = analysis.get("logicalSections")
    if not isinstance(logical, list) or not logical:
        return {"version": 1, "locale": locale, "sections": []}

    sections: list[dict[str, Any]] = []
    for raw in logical:
        if not isinstance(raw, dict):
            continue
        section_id = str(raw.get("id") or "").strip()
        title = str(raw.get("title") or section_id).strip()
        if not section_id or not title:
            continue
        placeholders: list[str] = []
        for tag in raw.get("placeholders") or []:
            token = str(tag).strip()
            if token and token not in placeholders:
                placeholders.append(token)
        for slot in raw.get("bracketSlots") or []:
            token = str(slot).strip()
            if not token:
                continue
            bracket = token if token.startswith("[") and token.endswith("]") else f"[{token}]"
            if bracket not in placeholders:
                placeholders.append(bracket)

        sections.append(
            {
                "id": section_id,
                "title": title,
                "number": str(raw.get("number") or "").strip(),
                "preamble": bool(raw.get("preamble")),
                "sortOrder": raw.get("sortOrder"),
                "placeholders": placeholders,
                "draftHint": str(raw.get("purpose") or raw.get("draftHint") or f"Complete: {title}"),
                "dataPaths": list(raw.get("suggestedDataPaths") or raw.get("dataPaths") or []),
                "include": raw.get("include") is not False,
            }
        )

    sections = ensure_plan_information_section(sections)
    return {"version": 1, "locale": locale, "sections": sections}


def merge_document_templates(
    base: dict[str, Any] | None,
    overlay: dict[str, Any] | None,
) -> dict[str, Any]:
    """Merge LLM-planned sections onto structural template; preserve base section order."""
    if not isinstance(base, dict) or not base.get("sections"):
        return overlay if isinstance(overlay, dict) else {"version": 1, "locale": "vi-VN", "sections": []}
    if not isinstance(overlay, dict) or not overlay.get("sections"):
        return base

    base_sections = [s for s in base.get("sections", []) if isinstance(s, dict)]
    overlay_by_id = {
        str(s.get("id") or ""): s for s in overlay.get("sections", []) if isinstance(s, dict) and s.get("id")
    }
    merged_sections: list[dict[str, Any]] = []
    seen: set[str] = set()

    for section in base_sections:
        sid = str(section.get("id") or "")
        if not sid:
            continue
        seen.add(sid)
        if sid in overlay_by_id:
            merged = dict(section)
            over = overlay_by_id[sid]
            for key in ("title", "draftHint", "dataPaths", "include"):
                if over.get(key) is not None:
                    merged[key] = over[key]
            over_ph = over.get("placeholders")
            if isinstance(over_ph, list) and over_ph:
                base_ph = list(merged.get("placeholders") or [])
                for tag in over_ph:
                    token = str(tag).strip()
                    if token and token not in base_ph:
                        base_ph.append(token)
                merged["placeholders"] = base_ph
            merged_sections.append(merged)
        else:
            merged_sections.append(section)

    for sid, section in overlay_by_id.items():
        if sid not in seen:
            merged_sections.append(section)

    locale = overlay.get("locale") or base.get("locale") or "vi-VN"
    merged_sections = ensure_plan_information_section(merged_sections)
    return {"version": 1, "locale": locale, "sections": merged_sections}


def ensure_section_content_coverage(
    document_template: dict[str, Any] | None,
    section_content: dict[str, str] | None,
    *,
    data_quality_notes: str = "",
) -> dict[str, str]:
    """Ensure every included section has draft text so export is structurally complete."""
    out: dict[str, str] = dict(section_content) if isinstance(section_content, dict) else {}
    sections = document_template.get("sections") if isinstance(document_template, dict) else None
    if not isinstance(sections, list):
        return out

    gap_note = (data_quality_notes or "").strip()
    for section in sections:
        if not isinstance(section, dict) or section.get("include") is False:
            continue
        section_id = str(section.get("id") or "").strip()
        if not section_id:
            continue
        if str(out.get(section_id) or "").strip():
            continue
        title = str(section.get("title") or section_id).strip()
        hint = str(section.get("draftHint") or "").strip()
        stub = f"{title}\n\n[Bản nháp — cần RM bổ sung từ discovery và tài liệu khách hàng.]"
        if hint:
            stub += f"\n\nGợi ý nội dung: {hint}"
        if gap_note:
            stub += f"\n\nGhi chú dữ liệu: {gap_note}"
        out[section_id] = stub
    return out
