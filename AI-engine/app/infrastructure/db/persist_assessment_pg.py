from __future__ import annotations

import json
from uuid import UUID

from psycopg import Connection

from app.domain.smartwealth.models import AIResult

_I32_MAX = 2_147_483_647
_I32_MIN = -2_147_483_648
# PostgreSQL NUMERIC(5,4): 5 digits total, 4 after the decimal (max |x| <= 9.9999).
_NUMERIC_5_4_MAX = 9.9999
_NUMERIC_5_4_MIN = -9.9999


def _uuid_or_none(value: str) -> UUID | None:
    if not value or not value.strip():
        return None
    try:
        return UUID(value.strip())
    except ValueError:
        return None


def _trunc_str(value: str | None, max_len: int) -> str:
    if value is None:
        return ""
    s = str(value)
    return s if len(s) <= max_len else s[:max_len]


def _clamp_numeric_5_4(value: float) -> float:
    try:
        x = float(value)
    except (TypeError, ValueError):
        return 0.0
    if x > _NUMERIC_5_4_MAX:
        return _NUMERIC_5_4_MAX
    if x < _NUMERIC_5_4_MIN:
        return _NUMERIC_5_4_MIN
    return x


def _clamp_i32(value: int) -> int:
    try:
        x = int(value)
    except (TypeError, ValueError):
        return 0
    return max(_I32_MIN, min(_I32_MAX, x))


def persist_assessment_result_and_findings(
    conn: Connection,
    *,
    workflow_event_id: UUID | None,
    result: AIResult,
) -> UUID:
    """Persist any assessment AIResult (registered runners) into ai_result / ai_finding."""
    rid = UUID(result.result_id)
    wf_eid = workflow_event_id
    req_id = UUID(result.request_id)
    appr_uid = _uuid_or_none(result.approved_by_user_id)

    step_name = _trunc_str(result.step_name, 200)
    provider = _trunc_str(result.provider, 100)
    model = _trunc_str(result.model, 200)
    trace_id = _trunc_str(result.trace_id, 100)
    safety_category = _trunc_str(result.safety_category, 64)
    human_approval_status = _trunc_str(result.human_approval_status, 32)
    decision = _trunc_str(result.decision.value, 32)
    ssot_record_type = _trunc_str(result.ssot_record_type, 50)
    ssot_record_version = _trunc_str(result.ssot_record_version, 50)
    conf_score = _clamp_numeric_5_4(result.confidence_score)
    conf_threshold = _clamp_numeric_5_4(result.confidence_threshold)
    latency_ms = _clamp_i32(result.latency_ms)
    input_tokens = _clamp_i32(result.input_tokens)
    output_tokens = _clamp_i32(result.output_tokens)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ai_result (
                result_id, workflow_event_id, request_id,
                step_name, provider, model, output_text,
                confidence_score, confidence_threshold,
                decision, decision_reason,
                latency_ms, input_tokens, output_tokens,
                produced_at, trace_id,
                safety_flagged, safety_category,
                human_approval_required, human_approval_status,
                approved_by_user_id, approved_at,
                ssot_record_id, ssot_record_type, ssot_record_version,
                ssot_snapshot_id
            ) VALUES (
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, %s,
                %s, %s,
                %s, %s, %s,
                %s
            )
            ON CONFLICT (result_id) DO UPDATE SET
                workflow_event_id = EXCLUDED.workflow_event_id,
                request_id = EXCLUDED.request_id,
                step_name = EXCLUDED.step_name,
                provider = EXCLUDED.provider,
                model = EXCLUDED.model,
                output_text = EXCLUDED.output_text,
                confidence_score = EXCLUDED.confidence_score,
                confidence_threshold = EXCLUDED.confidence_threshold,
                decision = EXCLUDED.decision,
                decision_reason = EXCLUDED.decision_reason,
                latency_ms = EXCLUDED.latency_ms,
                input_tokens = EXCLUDED.input_tokens,
                output_tokens = EXCLUDED.output_tokens,
                produced_at = EXCLUDED.produced_at,
                trace_id = EXCLUDED.trace_id,
                safety_flagged = EXCLUDED.safety_flagged,
                safety_category = EXCLUDED.safety_category,
                human_approval_required = EXCLUDED.human_approval_required,
                human_approval_status = EXCLUDED.human_approval_status,
                approved_by_user_id = EXCLUDED.approved_by_user_id,
                approved_at = EXCLUDED.approved_at,
                ssot_record_id = EXCLUDED.ssot_record_id,
                ssot_record_type = EXCLUDED.ssot_record_type,
                ssot_record_version = EXCLUDED.ssot_record_version,
                ssot_snapshot_id = EXCLUDED.ssot_snapshot_id
            """,
            (
                rid,
                wf_eid,
                req_id,
                step_name,
                provider,
                model,
                result.output_text,
                conf_score,
                conf_threshold,
                decision,
                result.decision_reason,
                latency_ms,
                input_tokens,
                output_tokens,
                result.produced_at,
                trace_id,
                result.safety_flagged,
                safety_category,
                result.human_approval_required,
                human_approval_status,
                appr_uid,
                result.approved_at,
                UUID(result.ssot_record_id),
                ssot_record_type,
                ssot_record_version,
                UUID(result.ssot_snapshot_id),
            ),
        )

        cur.execute("DELETE FROM ai_finding WHERE result_id = %s", (rid,))

        sort_order = 0
        try:
            payload = json.loads(result.output_text)
        except json.JSONDecodeError:
            payload = {}

        if isinstance(payload, dict):
            missing = payload.get("missing_items") or []
            if isinstance(missing, list):
                for item in missing:
                    sort_order += 1
                    field_path = str(item) if item is not None else ""
                    cur.execute(
                        """
                        INSERT INTO ai_finding (result_id, finding_kind, field_path, detail, sort_order)
                        VALUES (%s, 'missing_item', %s, NULL, %s)
                        """,
                        (rid, field_path[:200], sort_order),
                    )

            sort_order += 1
            summary_bits = {
                "assessment_id": payload.get("assessment_id"),
                "assessment_name": payload.get("assessment_name"),
                "is_complete": payload.get("is_complete"),
                "ruleset_version": payload.get("ruleset_version"),
            }
            cur.execute(
                """
                INSERT INTO ai_finding (result_id, finding_kind, field_path, detail, sort_order)
                VALUES (%s, 'summary', NULL, %s, %s)
                """,
                (rid, json.dumps(summary_bits, separators=(",", ":"), sort_keys=True), sort_order),
            )
        else:
            sort_order += 1
            cur.execute(
                """
                INSERT INTO ai_finding (result_id, finding_kind, field_path, detail, sort_order)
                VALUES (%s, 'summary', NULL, %s, %s)
                """,
                (rid, result.output_text[:10000], sort_order),
            )

    return rid
