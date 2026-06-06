from __future__ import annotations

import re
from typing import Any

from app.application.services.planning_discovery_index import build_discovery_field_index


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _slot_keywords(slot: str) -> list[str]:
    inner = slot.strip("[]")
    parts = re.split(r"[/|,;]+", inner)
    words: list[str] = []
    for part in parts:
        for token in re.findall(r"[a-z0-9]+", part.lower()):
            if len(token) > 2 and token not in words:
                words.append(token)
    return words


def _field_search_blob(code: str, row: dict[str, Any]) -> str:
    bits = [
        code,
        str(row.get("dataDomain") or ""),
        str(row.get("dataItem") or ""),
        str(row.get("detailFieldName") or ""),
    ]
    return _norm(" ".join(bits))


def _match_fields_for_slot(slot: str, field_rows: list[tuple[str, dict[str, Any]]], *, limit: int = 5) -> list[tuple[str, str]]:
    keywords = _slot_keywords(slot)
    if not keywords:
        return []
    scored: list[tuple[float, str, str]] = []
    for code, row in field_rows:
        blob = _field_search_blob(code, row)
        if not blob:
            continue
        hits = sum(1 for kw in keywords if kw in blob)
        if hits == 0:
            continue
        value = str(row.get("_value") or "").strip()
        if not value:
            continue
        score = hits / len(keywords)
        scored.append((score, code, value))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [(code, value) for _, code, value in scored[:limit]]


def _profile_lines_for_slot(slot: str, profile: dict[str, Any]) -> list[str]:
    if not profile:
        return []
    norm_slot = _norm(slot)
    lines: list[str] = []
    if any(w in norm_slot for w in ("client", "household", "name")):
        name = str(profile.get("name") or "").strip()
        if name:
            lines.append(f"Tên khách hàng / hộ: {name}")
    if "rm" in norm_slot or "advisor" in norm_slot:
        pass
    if any(w in norm_slot for w in ("date", "ngày")) and "plan date" in norm_slot:
        pass
    if any(w in norm_slot for w in ("risk", "rủi ro")):
        risk = str(profile.get("riskProfile") or "").strip()
        if risk:
            lines.append(f"Khẩu vị rủi ro: {risk}")
    if any(w in norm_slot for w in ("residency", "cư trú", "tax")):
        res = str(profile.get("residency") or "").strip()
        if res:
            lines.append(f"Cư trú: {res}")
    return lines


def _build_plan_information_cover(
    *,
    client_profile: dict[str, Any],
    context: dict[str, Any],
    template: dict[str, Any],
    section: dict[str, Any],
) -> str:
    """Structured cover + Plan Information block matching RM Word templates."""
    lines: list[str] = [
        "Client-facing plan template | Prepared for RM review and client discussion",
    ]
    template_name = str(template.get("name") or template.get("code") or "").strip()
    if template_name:
        lines.append(f"Template: {template_name}")
    for preview in section.get("previewLines") or []:
        text = str(preview).strip()
        if text and "client-facing" not in text.lower() and text not in lines:
            lines.append(text)
    lines.extend(["", "Plan Information"])
    slots = section.get("placeholders") or [
        "[Client name / household name]",
        "[RM / advisor name]",
        "[DD/MM/YYYY]",
        "[Start date]",
        "[target date]",
        "[Save for home / Pay back home loan / Refinance / Hybrid plan]",
        "[VND / USD / other]",
        "[Draft / Reviewed / Final]",
    ]
    for slot in slots:
        token = str(slot).strip()
        if not token.startswith("["):
            continue
        lines.append(f"- {token}")
    lines.extend(
        [
            "",
            "Important note: This plan is prepared for discussion and planning purposes. "
            "Figures depend on information available at the plan date.",
        ]
    )
    generated = str(context.get("generatedAt") or "").strip()
    if generated:
        lines.insert(4, f"Plan date (generated): {generated[:10]}")
    name = str(client_profile.get("name") or "").strip()
    if name:
        lines.insert(5, f"Client / Household: {name}")
    return "\n".join(lines)


def enrich_section_content_from_sources(
    document_template: dict[str, Any] | None,
    section_content: dict[str, str] | None,
    discovery: dict[str, Any] | None,
    *,
    client_profile: dict[str, Any] | None = None,
    unmapped_answers: list[dict[str, Any]] | None = None,
    context: dict[str, Any] | None = None,
    template: dict[str, Any] | None = None,
    min_chars_before_enrich: int = 200,
) -> dict[str, str]:
    """
    Append discovery/profile-backed lines to thin sectionContent entries.
    Does not invent numbers — only appends matched field values.
    """
    out: dict[str, str] = dict(section_content) if isinstance(section_content, dict) else {}
    if not isinstance(document_template, dict):
        return out

    field_index = build_discovery_field_index(discovery)
    field_rows: list[tuple[str, dict[str, Any]]] = []
    fields = (discovery or {}).get("fields")
    if isinstance(fields, dict):
        for code, row in fields.items():
            if isinstance(row, dict):
                field_rows.append((str(code), {**row, "_value": field_index.get(str(code), "")}))

    for section in document_template.get("sections") or []:
        if not isinstance(section, dict) or section.get("include") is False:
            continue
        section_id = str(section.get("id") or "").strip()
        if not section_id:
            continue
        existing = str(out.get(section_id) or "").strip()
        enrich_threshold = 80 if section_id == "plan_information" else min_chars_before_enrich
        if len(existing) >= enrich_threshold:
            continue

        title = str(section.get("title") or section_id).strip()
        if section_id == "plan_information":
            cover = _build_plan_information_cover(
                client_profile=client_profile or {},
                context=context or {},
                template=template or {},
                section=section,
            )
            lines = [cover, "", "**Chi tiết từ dữ liệu:**"]
            slots = [
                str(t).strip()
                for t in (section.get("placeholders") or [])
                if str(t).strip().startswith("[")
            ]
            for slot in slots[:25]:
                slot_lines: list[str] = []
                slot_lines.extend(_profile_lines_for_slot(slot, client_profile or {}))
                for code, value in _match_fields_for_slot(slot, field_rows):
                    slot_lines.append(f"{code}: {value}")
                if slot_lines:
                    lines.append(f"- {slot}: " + "; ".join(slot_lines))
                else:
                    lines.append(f"- {slot}: [Cần xác nhận]")
            out[section_id] = "\n".join(lines).strip()
            continue

        lines = [f"## {title}"] if not existing else [existing, ""]
        slots: list[str] = []
        for token in section.get("placeholders") or []:
            t = str(token).strip()
            if t.startswith("[") and t.endswith("]"):
                slots.append(t)

        filled_any = False
        for slot in slots[:25]:
            slot_lines: list[str] = []
            slot_lines.extend(_profile_lines_for_slot(slot, client_profile or {}))
            for code, value in _match_fields_for_slot(slot, field_rows):
                slot_lines.append(f"{code}: {value}")
            if slot_lines:
                lines.append(f"- **{slot}**")
                lines.extend(f"  - {ln}" for ln in slot_lines)
                filled_any = True
            else:
                lines.append(f"- **{slot}**: [Cần xác nhận — chưa có trong discovery/profile]")

        if not slots and field_rows and not filled_any:
            for code, value in list(field_index.items())[:8]:
                lines.append(f"- {code}: {value}")

        if unmapped_answers and len(existing) < 80:
            extra = _unmapped_snippets(unmapped_answers, title, limit=3)
            if extra:
                lines.append("\n**Thông tin từ câu trả lời chưa map field:**")
                lines.extend(extra)

        out[section_id] = "\n".join(lines).strip()

    return out


def _unmapped_snippets(answers: list[dict[str, Any]], section_title: str, *, limit: int) -> list[str]:
    title_words = set(_slot_keywords(f"[{section_title}]"))
    snippets: list[str] = []
    for row in answers:
        if not isinstance(row, dict):
            continue
        qid = str(row.get("questionId") or "question")
        val = row.get("answerValue")
        text = str(val).strip() if val is not None else ""
        if not text or len(text) > 400:
            continue
        if title_words and not any(w in _norm(text) for w in title_words):
            continue
        snippets.append(f"- {qid}: {text[:400]}")
        if len(snippets) >= limit:
            break
    return snippets
