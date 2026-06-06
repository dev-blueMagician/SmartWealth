from __future__ import annotations

from datetime import datetime
from uuid import UUID

from psycopg import Connection
from psycopg.rows import dict_row

from app.domain.smartwealth.models import OrchestrationRequest


def load_orchestration_request(conn: Connection, request_id: str) -> OrchestrationRequest | None:
    """Load a row from orchestration_request into the domain model."""
    try:
        rid = UUID(request_id)
    except ValueError:
        return None

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                request_id,
                workflow_id,
                user_id,
                correlation_id,
                input_text,
                input_language,
                source_channel,
                priority,
                requested_at,
                confidence_threshold,
                human_approval_required,
                ssot_record_id,
                ssot_record_type,
                ssot_record_version,
                ssot_correlation_id,
                COALESCE(assessment_code, 'onboarding_completeness') AS assessment_code
            FROM orchestration_request
            WHERE request_id = %s
            """,
            (rid,),
        )
        row = cur.fetchone()
        if row is None:
            return None

    return OrchestrationRequest(
        request_id=str(row["request_id"]),
        workflow_id=str(row["workflow_id"]),
        user_id=str(row["user_id"]),
        correlation_id=str(row["correlation_id"]),
        input_text=str(row["input_text"]),
        input_language=str(row["input_language"]),
        source_channel=str(row["source_channel"]),
        priority=int(row["priority"]),
        requested_at=_as_utc_datetime(row["requested_at"]),
        confidence_threshold=float(row["confidence_threshold"]),
        human_approval_required=bool(row["human_approval_required"]),
        ssot_record_id=str(row["ssot_record_id"]),
        ssot_record_type=str(row["ssot_record_type"]),
        ssot_record_version=str(row["ssot_record_version"]),
        ssot_correlation_id=str(row["ssot_correlation_id"]),
        assessment_code=str(row["assessment_code"]),
    )


def _as_utc_datetime(value: object) -> datetime:
    if isinstance(value, datetime):
        return value
    raise TypeError(f"requested_at must be datetime, got {type(value)}")
