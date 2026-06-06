from __future__ import annotations

import json
import logging
from uuid import UUID, uuid4, uuid5

from app.domain.smartwealth.models import AIResult
from app.infrastructure.config.settings import Settings
from app.infrastructure.context.phase_assessment_context_enrichment import (
    enrich_assessment_variables_from_db,
    merge_string_dicts,
)

_log = logging.getLogger(__name__)

# Legacy fallback when caller omits ``orchestration_request_id``: one row per case, updated each turn.
_CHAT_ORCH_REQUEST_NS = UUID("0194c0de-0000-7000-8000-0000000ca7e1")
_CHAT_USER_NS = UUID("0194c0de-0000-7000-8000-0000000ca7e2")


def merge_chat_variables(
    *,
    case_id: str,
    phase_code: str,
    sender_role: str,
    user_message: str,
    extra: dict[str, object] | None,
) -> dict[str, str]:
    """Flatten chat metadata into ``variables`` (``ContextDataRepository`` is ``str``-valued)."""
    out: dict[str, str] = {
        "case_id": case_id.strip(),
        "phase_code": phase_code.strip(),
        "sender_role": (sender_role or "UNKNOWN").strip(),
        "chat_user_message": user_message,
    }
    if extra:
        for k, v in extra.items():
            if v is None:
                continue
            key = str(k)
            if isinstance(v, str):
                out[key] = v
            elif isinstance(v, (dict, list)):
                out[key] = json.dumps(v, ensure_ascii=False)
            else:
                out[key] = str(v)
    return out


def resolve_chat_orchestration_request_id(
    *,
    orchestration_request_id: str | None,
    case_id: str,
) -> UUID:
    if orchestration_request_id and orchestration_request_id.strip():
        return UUID(orchestration_request_id.strip())
    # Backward-compatible default; production chat should pass an explicit id per turn (see backend CaseChatService).
    return uuid5(_CHAT_ORCH_REQUEST_NS, f"wealth-chat-orchestration:{case_id.strip()}")


def _workflow_uuid(workflow_id: str | None, case_id: str) -> UUID:
    raw = (workflow_id or case_id).strip()
    return UUID(raw)


def _user_uuid(user_id: str | None) -> UUID:
    if user_id and user_id.strip():
        try:
            return UUID(user_id.strip())
        except ValueError:
            return uuid5(_CHAT_USER_NS, user_id.strip())
    return uuid5(_CHAT_USER_NS, "anonymous")


def _case_uuid(case_id: str) -> UUID:
    return UUID(case_id.strip())


def _upsert_chat_orchestration_request_row(
    conn,
    *,
    request_id: UUID,
    workflow_id: UUID,
    user_uuid: UUID,
    case_uuid: UUID,
    assessment_code: str,
    input_language: str,
    user_message: str,
) -> None:
    from psycopg.types.json import Json

    corr = f"chat:{request_id}"[:100]
    ssot_corr = str(request_id)[:100]
    snap = uuid4()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO orchestration_request (
                request_id, workflow_id, user_id, correlation_id,
                input_text, input_language, source_channel, priority, requested_at,
                confidence_threshold, human_approval_required,
                ssot_record_id, ssot_record_type, ssot_record_version, ssot_correlation_id,
                assessment_code,
                ssot_snapshot_id, environment, feature_flags,
                session_id, current_step, attempt_count,
                previous_result_ids, escalation_required, human_approval_status,
                human_approver_id, human_approval_at, variables
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s, NOW(),
                %s, %s,
                %s, %s, %s, %s,
                %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                NULL, NULL, %s
            )
            ON CONFLICT (request_id) DO NOTHING
            """,
            (
                request_id,
                workflow_id,
                user_uuid,
                corr,
                (user_message or "").strip() or " ",
                (input_language or "en").strip()[:16],
                "CHAT",
                1,
                0.5,
                False,
                case_uuid,
                "WEALTH_CASE",
                "1",
                ssot_corr,
                assessment_code.strip(),
                snap,
                "chat",
                Json({}),
                f"chat:{request_id}"[:100],
                "CHAT",
                0,
                Json([]),
                False,
                "NONE",
                Json({}),
            ),
        )


def run_chat_catalog_assessment(
    *,
    settings: Settings,
    case_id: str,
    phase_code: str,
    assessment_code: str,
    sender_role: str,
    user_message: str,
    input_language: str = "en",
    workflow_id: str | None = None,
    user_id: str | None = None,
    extra_variables: dict[str, object] | None = None,
    orchestration_request_id: str | None = None,
    refresh_db_context: bool = True,
) -> tuple[AIResult, UUID]:
    """
    Ensure ``orchestration_request`` exists for ``request_id`` (insert new row or touch existing),
    merge chat + DB variables, then run the catalog orchestrator via ``SqlContextDataRepository``
    (same as ``POST /internal/assessment/execute``).

    Callers should pass a **new** ``orchestration_request_id`` each chat turn so ``variables`` are
    not merged onto stale state from a shared per-case row.

    Returns ``(AIResult, resolved_request_id)``.
    """
    import psycopg
    from psycopg.rows import dict_row
    from psycopg.types.json import Json

    from app.infrastructure.db.assessment_pg import execute_assessment_with_conn

    rid = resolve_chat_orchestration_request_id(
        orchestration_request_id=orchestration_request_id,
        case_id=case_id,
    )
    wf = _workflow_uuid(workflow_id, case_id)
    uid = _user_uuid(user_id)
    case_uuid = _case_uuid(case_id)

    overlay = merge_chat_variables(
        case_id=case_id,
        phase_code=phase_code,
        sender_role=sender_role,
        user_message=user_message,
        extra=extra_variables,
    )
    url = settings.resolved_database_url
    with psycopg.connect(url) as conn:
        _upsert_chat_orchestration_request_row(
            conn,
            request_id=rid,
            workflow_id=wf,
            user_uuid=uid,
            case_uuid=case_uuid,
            assessment_code=assessment_code,
            input_language=input_language,
            user_message=user_message,
        )

        if refresh_db_context:
            try:
                db_overlay = enrich_assessment_variables_from_db(
                    conn,
                    case_id=case_id,
                    phase_code=phase_code,
                    assessment_code=assessment_code,
                )
                overlay = merge_string_dicts(overlay, db_overlay)
            except Exception as exc:
                _log.debug("Chat DB context refresh skipped: %s", exc)

        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "SELECT variables FROM orchestration_request WHERE request_id = %s",
                (rid,),
            )
            row = cur.fetchone()
            if row is None:
                raise LookupError(f"orchestration_request not found for request_id={rid}")
            raw_vars = row.get("variables")
            base: dict[str, str] = {}
            if isinstance(raw_vars, dict):
                base = {str(k): str(v) for k, v in raw_vars.items()}
            merged = merge_string_dicts(base, overlay)

            cur.execute(
                """
                UPDATE orchestration_request
                SET input_text = %s,
                    input_language = %s,
                    assessment_code = %s,
                    variables = %s::jsonb,
                    context_updated_at = NOW()
                WHERE request_id = %s
                """,
                (
                    user_message,
                    (input_language or "en").strip()[:16],
                    assessment_code.strip(),
                    Json(merged),
                    rid,
                ),
            )

        result = execute_assessment_with_conn(
            conn,
            str(rid),
            settings,
            triggered_assessment_code=assessment_code.strip(),
        )
    return result, rid
