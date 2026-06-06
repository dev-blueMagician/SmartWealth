from __future__ import annotations

import re
from typing import Any


def _norm_title(title: str) -> str:
    return re.sub(r"\s+", " ", (title or "").lower()).strip()


def build_section_compose_briefs(
    document_template: dict[str, Any] | None,
    template_analysis: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    """
    Per-section checklist for compose LLM: title, bracket slots, and topics to cover.
    Merges documentTemplate sections with logicalSections from template analysis.
    """
    if not isinstance(document_template, dict):
        return []

    logical_by_id: dict[str, dict[str, Any]] = {}
    logical_by_title: dict[str, dict[str, Any]] = {}
    if isinstance(template_analysis, dict):
        for raw in template_analysis.get("logicalSections") or []:
            if not isinstance(raw, dict):
                continue
            sid = str(raw.get("id") or "").strip()
            title = _norm_title(str(raw.get("title") or ""))
            if sid:
                logical_by_id[sid] = raw
            if title:
                logical_by_title[title] = raw

    briefs: list[dict[str, Any]] = []
    for section in document_template.get("sections") or []:
        if not isinstance(section, dict) or section.get("include") is False:
            continue
        section_id = str(section.get("id") or "").strip()
        title = str(section.get("title") or section_id).strip()
        if not section_id:
            continue

        logical = logical_by_id.get(section_id) or logical_by_title.get(_norm_title(title))
        bracket_slots: list[str] = []
        merge_tags: list[str] = []

        for token in section.get("placeholders") or []:
            t = str(token).strip()
            if not t:
                continue
            if t.startswith("[") and t.endswith("]"):
                if t not in bracket_slots:
                    bracket_slots.append(t)
            else:
                if t not in merge_tags:
                    merge_tags.append(t)

        if logical:
            for slot in logical.get("bracketSlots") or []:
                s = str(slot).strip()
                if not s:
                    continue
                bracket = s if s.startswith("[") else f"[{s}]"
                if bracket not in bracket_slots:
                    bracket_slots.append(bracket)
            for tag in logical.get("placeholders") or []:
                t = str(tag).strip()
                if t.startswith("[") and t.endswith("]") and t not in bracket_slots:
                    bracket_slots.append(t)

        preview_lines: list[str] = []
        if logical and isinstance(logical.get("previewLines"), list):
            preview_lines = [str(line) for line in logical["previewLines"][:15] if str(line).strip()]

        min_detail = (
            "Write RM-facing draft: cover every bracket slot as a labeled line or bullet; "
            "use discovery/profile/unmapped answers; mark [Cần xác nhận] when data missing."
        )
        if section_id == "plan_information":
            min_detail = (
                "Write the cover block: include template subtitle (client-facing plan…), then Plan Information "
                "rows (Client/Household, RM, Plan date, Planning period, Objective, Currency, Status), then "
                "Important note disclaimer. One labeled line per bracket slot."
            )

        briefs.append(
            {
                "sectionId": section_id,
                "title": title,
                "draftHint": str(section.get("draftHint") or (logical.get("purpose") if logical else "")).strip(),
                "bracketSlots": bracket_slots[:40],
                "mergeTags": merge_tags[:20],
                "templatePreviewLines": preview_lines,
                "minDetail": min_detail,
            }
        )
    return briefs
