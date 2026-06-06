from __future__ import annotations

from typing import Any


def _field_value(row: Any) -> str:
    if not isinstance(row, dict):
        return str(row or "").strip()
    text = str(row.get("valueText") or "").strip()
    if text:
        return text
    raw = row.get("valueJsonb")
    if raw is None:
        return ""
    return str(raw).strip()


def build_discovery_field_index(discovery: dict[str, Any] | None) -> dict[str, str]:
    """Map systemField code → display value for binding and LLM prompts."""
    if not isinstance(discovery, dict):
        return {}
    fields = discovery.get("fields")
    index: dict[str, str] = {}
    if isinstance(fields, dict):
        for code, row in fields.items():
            key = str(code or "").strip()
            if not key:
                continue
            value = _field_value(row)
            if value:
                index[key] = value
    elif isinstance(fields, list):
        for row in fields:
            if not isinstance(row, dict):
                continue
            key = str(row.get("systemField") or "").strip()
            if not key:
                continue
            value = _field_value(row)
            if value:
                index[key] = value
    return index


def build_discovery_prompt_index(
    discovery: dict[str, Any] | None,
    *,
    max_entries: int = 600,
) -> list[dict[str, str]]:
    """Compact rows for LLM: systemField, domain, item, value (truncated)."""
    if not isinstance(discovery, dict):
        return []
    fields = discovery.get("fields")
    rows: list[dict[str, str]] = []
    if isinstance(fields, dict):
        iterable = fields.items()
    elif isinstance(fields, list):
        iterable = ((row.get("systemField"), row) for row in fields if isinstance(row, dict))
    else:
        return []

    for code, row in iterable:
        if not isinstance(row, dict):
            continue
        key = str(code or row.get("systemField") or "").strip()
        if not key:
            continue
        value = _field_value(row)
        if not value:
            continue
        rows.append(
            {
                "systemField": key,
                "dataDomain": str(row.get("dataDomain") or "").strip(),
                "dataItem": str(row.get("dataItem") or row.get("detailFieldName") or "").strip(),
                "value": value[:500],
            }
        )
        if len(rows) >= max_entries:
            break
    return rows
