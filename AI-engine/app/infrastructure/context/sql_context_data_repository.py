from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.rows import dict_row

from app.domain.smartwealth.interfaces.ports import ContextDataRepository


def _uuid_param(value: str) -> UUID | str:
    try:
        return UUID(value)
    except ValueError:
        return value


class SqlContextDataRepository(ContextDataRepository):
    """
    Loads orchestration fields from a single PostgreSQL row (orchestration_request).
    MVP: request + runtime + SSOT snapshot id + environment/flags in one table.
    """

    def __init__(self, conn: Connection) -> None:
        self._conn = conn
        self._cache_rid: str | None = None
        self._cache_row: dict[str, Any] | None = None

    def _fetch_row(self, request_id: str) -> dict[str, Any] | None:
        if self._cache_rid == request_id and self._cache_row is not None:
            return self._cache_row
        rid = _uuid_param(request_id)
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT
                    session_id,
                    current_step,
                    attempt_count,
                    previous_result_ids,
                    escalation_required,
                    human_approval_status,
                    human_approver_id,
                    human_approval_at,
                    variables,
                    environment,
                    feature_flags,
                    ssot_snapshot_id
                FROM orchestration_request
                WHERE request_id = %s
                """,
                (rid,),
            )
            row = cur.fetchone()
            self._cache_rid = request_id
            self._cache_row = dict(row) if row else None
            return self._cache_row

    def get_session_id(self, request_id: str) -> str | None:
        row = self._fetch_row(request_id)
        if row is None:
            return None
        return row["session_id"]

    def get_environment(self, request_id: str) -> str | None:
        row = self._fetch_row(request_id)
        if row is None:
            return None
        return row["environment"]

    def get_feature_flags(self, request_id: str) -> dict[str, bool] | None:
        row = self._fetch_row(request_id)
        if row is None or row.get("feature_flags") is None:
            return None
        return self._coerce_feature_flags(row["feature_flags"])

    def get_variables(self, request_id: str) -> dict[str, str] | None:
        row = self._fetch_row(request_id)
        if row is None:
            return None
        return self._coerce_variables(row["variables"])

    def get_current_step(self, request_id: str) -> str | None:
        row = self._fetch_row(request_id)
        if row is None:
            return None
        return row["current_step"]

    def get_attempt_count(self, request_id: str) -> int | None:
        row = self._fetch_row(request_id)
        if row is None:
            return None
        return row["attempt_count"]

    def get_previous_result_ids(self, request_id: str) -> list[str] | None:
        row = self._fetch_row(request_id)
        if row is None:
            return None
        return self._coerce_previous_ids(row["previous_result_ids"])

    def is_escalation_required(self, request_id: str) -> bool | None:
        row = self._fetch_row(request_id)
        if row is None:
            return None
        return row["escalation_required"]

    def get_human_approval_status(self, request_id: str) -> str | None:
        row = self._fetch_row(request_id)
        if row is None:
            return None
        return row["human_approval_status"]

    def get_human_approver_id(self, request_id: str) -> str | None:
        row = self._fetch_row(request_id)
        if row is None:
            return None
        val = row["human_approver_id"]
        return None if val is None else str(val)

    def get_human_approval_at(self, request_id: str) -> datetime | None:
        row = self._fetch_row(request_id)
        if row is None:
            return None
        return row["human_approval_at"]

    def get_ssot_snapshot_id(self, request_id: str) -> str | None:
        row = self._fetch_row(request_id)
        if row is None or row.get("ssot_snapshot_id") is None:
            return None
        return str(row["ssot_snapshot_id"])

    @staticmethod
    def _coerce_feature_flags(raw: Any) -> dict[str, bool]:
        if not isinstance(raw, dict):
            return {}
        out: dict[str, bool] = {}
        for k, v in raw.items():
            out[str(k)] = bool(v)
        return out

    @staticmethod
    def _coerce_variables(raw: Any) -> dict[str, str]:
        if raw is None:
            return {}
        if not isinstance(raw, dict):
            return {}
        return {str(k): str(v) for k, v in raw.items()}

    @staticmethod
    def _coerce_previous_ids(raw: Any) -> list[str]:
        if raw is None:
            return []
        if isinstance(raw, list):
            return [str(x) for x in raw]
        return []
