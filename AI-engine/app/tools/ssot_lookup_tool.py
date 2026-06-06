from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.domain.smartwealth.interfaces import ReadOnlyDataTool


@dataclass(slots=True)
class SSOTLookupResult:
    values: dict[str, Any]
    missing_fields: list[str]


class SSOTLookupTool(ReadOnlyDataTool):
    """
    Deterministic tool that reads only from the provided SSOT payload.
    """

    @property
    def tool_id(self) -> str:
        return "ssot_lookup_tool"

    def fetch(self, query: dict[str, Any]) -> dict[str, Any]:
        payload = query.get("payload")
        required_fields = query.get("required_fields")
        if not isinstance(payload, dict):
            raise ValueError("SSOT lookup query requires a 'payload' dict.")
        if not isinstance(required_fields, list):
            raise ValueError("SSOT lookup query requires a 'required_fields' list.")
        result = self.fetch_fields(payload=payload, required_fields=required_fields)
        return {"values": result.values, "missing_fields": result.missing_fields}

    def fetch_fields(self, payload: dict[str, Any], required_fields: list[str]) -> SSOTLookupResult:
        values: dict[str, Any] = {}
        missing: list[str] = []
        for key in required_fields:
            if key in payload and payload[key] is not None:
                values[key] = payload[key]
            else:
                missing.append(key)
        return SSOTLookupResult(values=values, missing_fields=missing)
