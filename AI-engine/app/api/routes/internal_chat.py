from __future__ import annotations

import json
import logging
from collections.abc import Iterator
from typing import Any

_log = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException
from starlette.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.api.routes.internal_workflow import verify_internal_workflow_call
from app.application.services.chat_assessment_service import run_chat_catalog_assessment
from app.application.services.chat_narrate_service import iter_chat_narrate_text_deltas, run_chat_narrate
from app.infrastructure.llm.factory import assessment_llm_identity
from app.application.services.chat_intent_service import (
    conversation_history_json_safe,
    detect_chat_intent,
    scrub_conversation_turns,
)
from app.domain.smartwealth.models import AIResult
from app.infrastructure.config.settings import Settings
from app.infrastructure.container import container

router = APIRouter(prefix="/internal/chat", tags=["internal-chat"])


def get_settings() -> Settings:
    return container.settings


class ConversationTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: str = Field(min_length=1, description="user | assistant | system")
    content: str = Field(default="", max_length=32000)


class DetectIntentBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    case_id: str = Field(min_length=1)
    phase_code: str = Field(min_length=1, description="Current case phase, e.g. ONBOARDING.")
    user_message: str = Field(default="", description="Latest user utterance to classify.")
    conversation_history: list[ConversationTurn] | None = Field(
        default=None,
        max_length=40,
        description="Prior turns (chronological) for context; last entries are kept.",
    )


class ChatNarrateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_message: str = Field(min_length=1, description="Current user question / instruction.")
    pass1_findings: dict[str, Any] | None = Field(
        default=None,
        description="Structured pass-1 output (e.g. ``findings`` from /internal/chat/turn).",
    )
    pass1_output_text: str | None = Field(
        default=None,
        description="Raw ``output_text`` from pass-1 when ``findings`` is not parsed.",
    )
    phase_code: str | None = Field(default=None, description="Optional case phase for context.")
    assessment_code: str | None = Field(default=None, description="Optional assessment id for context.")
    conversation_history: list[ConversationTurn] | None = Field(
        default=None,
        max_length=40,
        description="Prior chat turns (chronological).",
    )
    system_prompt: str | None = Field(
        default=None,
        max_length=20_000,
        description="Override default RM narrator system prompt.",
    )
    input_language: str = Field(default="en", min_length=2, max_length=16)

    @field_validator("conversation_history")
    @classmethod
    def cap_narrate_history(cls, v: list[ConversationTurn] | None) -> list[ConversationTurn] | None:
        if v is None:
            return None
        return v[-30:]


class ChatTurnBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    case_id: str = Field(min_length=1, description="Wealth case UUID as string.")
    phase_code: str = Field(min_length=1, description="Journey phase, e.g. ONBOARDING.")
    assessment_code: str = Field(
        min_length=1,
        description="Catalog interaction id / assessment code to run.",
    )
    user_message: str = Field(default="", description="Latest user text for this turn.")
    sender_role: str = Field(default="RM", description="Actor role code from the backend (RM, WM, …).")
    workflow_id: str | None = Field(default=None, description="Optional workflow UUID; defaults to case_id.")
    user_id: str | None = Field(default=None, description="Optional stable user id for audit.")
    input_language: str = Field(default="en", min_length=2, max_length=16)
    extra_variables: dict[str, Any] | None = Field(
        default=None,
        description="Optional extra entries merged into orchestration variables (stringified).",
    )
    conversation_history: list[ConversationTurn] | None = Field(
        default=None,
        max_length=40,
        description="Prior chat turns (chronological). Serialized into variables for agents.",
    )
    chat_intent: str | None = Field(
        default=None,
        description="Optional intent from POST /internal/chat/detect-intent (READ_INFORMATION | …).",
    )
    orchestration_request_id: str | None = Field(
        default=None,
        description=(
            "UUID of ``orchestration_request`` for this turn. Prefer a new random UUID from the caller "
            "on each chat message so variables / assessment are seeded fresh. When omitted, a stable id "
            "is derived from ``case_id`` (legacy: one row per case, updated in place)."
        ),
    )
    refresh_db_context: bool = Field(
        default=True,
        description=(
            "When true, each turn loads ``ai_interaction.loop_input`` and optional ``case``/``client`` "
            "from PostgreSQL into variables (``catalog_loop_input_json``, ``wealth_case_context_json``)."
        ),
    )

    @field_validator("conversation_history")
    @classmethod
    def cap_history(cls, v: list[ConversationTurn] | None) -> list[ConversationTurn] | None:
        if v is None:
            return None
        return v[-30:]


def _merge_turn_extra(body: ChatTurnBody) -> dict[str, Any] | None:
    extra: dict[str, Any] = {}
    if body.extra_variables:
        extra.update(body.extra_variables)
    if body.conversation_history:
        scrubbed = scrub_conversation_turns([t.model_dump() for t in body.conversation_history])
        extra["chat_conversation_json"] = conversation_history_json_safe(scrubbed)
    if body.chat_intent:
        extra["chat_intent"] = body.chat_intent.strip()
    return extra if extra else None


def _chat_turn_pass1_dict(body: ChatTurnBody, result: AIResult, resolved_rid: Any) -> dict[str, Any]:
    """Same shape as the JSON returned by ``POST /internal/chat/turn`` (pass-1 only)."""
    payload = _ai_result_core(result)
    payload["phase_code"] = body.phase_code.strip()
    payload["assessment_code"] = body.assessment_code.strip()
    payload["orchestration_request_id"] = str(resolved_rid)
    try:
        payload["findings"] = json.loads(result.output_text)
    except json.JSONDecodeError:
        payload["findings"] = None
    return payload


def _ai_result_core(result: AIResult) -> dict[str, Any]:
    return {
        "result_id": result.result_id,
        "request_id": result.request_id,
        "step_name": result.step_name,
        "provider": result.provider,
        "model": result.model,
        "output_text": result.output_text,
        "confidence_score": result.confidence_score,
        "confidence_threshold": result.confidence_threshold,
        "decision": result.decision.value,
        "decision_reason": result.decision_reason,
        "latency_ms": result.latency_ms,
        "input_tokens": result.input_tokens,
        "output_tokens": result.output_tokens,
        "produced_at": result.produced_at.isoformat(),
        "trace_id": result.trace_id,
        "safety_flagged": result.safety_flagged,
        "safety_category": result.safety_category,
        "human_approval_required": result.human_approval_required,
        "human_approval_status": result.human_approval_status,
        "approved_by_user_id": result.approved_by_user_id,
        "approved_at": result.approved_at.isoformat() if result.approved_at else None,
        "ssot_record_id": result.ssot_record_id,
        "ssot_record_type": result.ssot_record_type,
        "ssot_record_version": result.ssot_record_version,
        "ssot_snapshot_id": result.ssot_snapshot_id,
    }


@router.post("/turn")
def post_chat_turn(
    body: ChatTurnBody,
    _auth: None = Depends(verify_internal_workflow_call),
) -> dict[str, Any]:
    """
    Internal-only: one catalog assessment pass for CHAT via ``orchestration_request``.

    Upserts (if missing) or updates ``variables`` / ``input_text`` / ``assessment_code``, then runs
    the same executor as ``POST /internal/assessment/execute``.

    When ``orchestration_request_id`` is omitted, ``request_id`` is deterministic from ``case_id`` (legacy).

    Prefer passing a new UUID on each user message so each turn gets a fresh ``orchestration_request`` row.

    When ``refresh_db_context`` is true (default), variables include ``catalog_loop_input_json`` from
    ``ai_interaction`` and ``wealth_case_context_json`` from ``case`` + ``client`` when present.
    """
    settings = get_settings()
    extra = _merge_turn_extra(body)
    try:
        result, resolved_rid = run_chat_catalog_assessment(
            settings=settings,
            case_id=body.case_id,
            phase_code=body.phase_code,
            assessment_code=body.assessment_code,
            sender_role=body.sender_role,
            user_message=body.user_message,
            input_language=body.input_language,
            workflow_id=body.workflow_id,
            user_id=body.user_id,
            extra_variables=extra,
            orchestration_request_id=body.orchestration_request_id,
            refresh_db_context=body.refresh_db_context,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (TypeError, KeyError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "PostgreSQL driver not installed. Run: pip install 'psycopg[binary]' "
                f"(import error: {exc})"
            ),
        ) from exc
    except OSError as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc

    return _chat_turn_pass1_dict(body, result, resolved_rid)


def _ndjson_line(obj: dict[str, Any]) -> bytes:
    return (json.dumps(obj, ensure_ascii=False) + "\n").encode("utf-8")


_STREAM_EMPTY_REPLY_VI = (
    "Tôi chưa tạo được nội dung trả lời cho tin nhắn này. "
    "Vui lòng thử gửi lại hoặc kiểm tra log AI-engine."
)
_STREAM_EMPTY_REPLY_EN = (
    "I could not generate a reply for this message. "
    "Please try again or check the AI-engine logs."
)


def _stream_reply_fallback(input_language: str | None) -> str:
    lang = (input_language or "en").strip().lower()
    if lang.startswith("vi"):
        return _STREAM_EMPTY_REPLY_VI
    return _STREAM_EMPTY_REPLY_EN


def _yield_char_assistant_deltas(text: str) -> Iterator[bytes]:
    for ch in text:
        yield _ndjson_line({"type": "assistant_delta", "text": ch})


def _resolve_chat_stream_reply(
    *,
    body: ChatTurnBody,
    result: AIResult,
    narr: dict[str, Any] | None,
) -> str:
    if narr and (narr.get("chat_reply") or "").strip():
        return str(narr["chat_reply"]).strip()
    raw = (result.output_text or "").strip()
    if raw and not raw.startswith("{"):
        return raw
    if raw and narr is None:
        _log.warning(
            "chat turn stream suppressing JSON output_text as chat reply case_id=%s",
            body.case_id,
        )
    return _stream_reply_fallback(body.input_language)


def _iter_chat_turn_stream(body: ChatTurnBody) -> Iterator[bytes]:
    """
    NDJSON stream: phase lines → optional assistant_delta chunks (sharded final reply)
    → catalog_turn_complete (pass-1 + narrate metadata for backend persistence).

    Pass-1 and narrate still run synchronously; ``assistant_delta`` simulates token UX until
    the LLM adapter exposes true streaming.
    """
    settings = get_settings()
    extra = _merge_turn_extra(body)
    _log.info(
        "chat turn stream start case_id=%s assessment=%s phase=%s",
        body.case_id,
        body.assessment_code,
        body.phase_code,
    )
    yield _ndjson_line({"type": "phase", "code": "ROUTING"})
    yield _ndjson_line({"type": "phase", "code": "SEARCH"})
    yield _ndjson_line({"type": "phase", "code": "REASON"})
    try:
        result, resolved_rid = run_chat_catalog_assessment(
            settings=settings,
            case_id=body.case_id,
            phase_code=body.phase_code,
            assessment_code=body.assessment_code,
            sender_role=body.sender_role,
            user_message=body.user_message,
            input_language=body.input_language,
            workflow_id=body.workflow_id,
            user_id=body.user_id,
            extra_variables=extra,
            orchestration_request_id=body.orchestration_request_id,
            refresh_db_context=body.refresh_db_context,
        )
    except LookupError as exc:
        _log.warning("chat turn stream assessment failed case_id=%s: %s", body.case_id, exc)
        yield _ndjson_line({"type": "error", "message": str(exc)})
        return
    except ValueError as exc:
        _log.warning("chat turn stream assessment failed case_id=%s: %s", body.case_id, exc)
        yield _ndjson_line({"type": "error", "message": str(exc)})
        return
    except (TypeError, KeyError) as exc:
        yield _ndjson_line({"type": "error", "message": str(exc)})
        return
    except ImportError as exc:
        yield _ndjson_line(
            {
                "type": "error",
                "message": (
                    "PostgreSQL driver not installed. Run: pip install 'psycopg[binary]' "
                    f"(import error: {exc})"
                ),
            }
        )
        return
    except OSError as exc:
        yield _ndjson_line({"type": "error", "message": f"Database unavailable: {exc}"})
        return

    _log.info(
        "chat turn stream assessment done case_id=%s output_text_len=%s",
        body.case_id,
        len(result.output_text or ""),
    )
    yield _ndjson_line({"type": "phase", "code": "VERIFY"})
    pass1 = _chat_turn_pass1_dict(body, result, resolved_rid)
    yield _ndjson_line({"type": "phase", "code": "THINKING"})
    hist = None
    if body.conversation_history:
        hist = scrub_conversation_turns([t.model_dump() for t in body.conversation_history])

    narr: dict[str, Any] | None = None
    reply = ""
    char_delta_count = 0
    try:
        reply_parts: list[str] = []
        for fragment in iter_chat_narrate_text_deltas(
            settings=settings,
            user_message=(body.user_message or "").strip(),
            pass1_findings=pass1.get("findings") if isinstance(pass1.get("findings"), dict) else None,
            pass1_output_text=result.output_text,
            conversation_history=hist,
            phase_code=body.phase_code.strip(),
            assessment_code=body.assessment_code.strip(),
            system_prompt=None,
            input_language=body.input_language,
        ):
            reply_parts.append(fragment)
            for ch in fragment:
                char_delta_count += 1
                yield _ndjson_line({"type": "assistant_delta", "text": ch})
        reply = "".join(reply_parts).strip()
        if reply:
            prov, model_label = assessment_llm_identity(settings)
            narr = {
                "chat_reply": reply,
                "provider": prov,
                "model": model_label,
                "streamed": True,
            }
    except ValueError as exc:
        _log.warning("chat turn stream narrate skipped case_id=%s: %s", body.case_id, exc)
        narr = None

    if not reply.strip():
        reply = _resolve_chat_stream_reply(body=body, result=result, narr=narr)
        for delta in _yield_char_assistant_deltas(reply):
            char_delta_count += 1
            yield delta

    _log.info(
        "chat turn stream reply case_id=%s reply_len=%s narr_ok=%s char_deltas=%s",
        body.case_id,
        len(reply),
        narr is not None,
        char_delta_count,
    )

    if narr:
        pass1["chat_narrate"] = narr
    yield _ndjson_line(
        {
            "type": "catalog_turn_complete",
            "assistant_text": reply,
            "ai_payload": pass1,
        }
    )


@router.post("/turn/stream")
def post_chat_turn_stream(
    body: ChatTurnBody,
    _auth: None = Depends(verify_internal_workflow_call),
) -> StreamingResponse:
    """
    NDJSON stream: ``phase`` lines, per-character ``assistant_delta`` from narrate LLM SSE,
    then ``catalog_turn_complete``. Non-streaming: ``POST /internal/chat/turn``.
    """
    return StreamingResponse(
        _iter_chat_turn_stream(body),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/detect-intent")
def post_detect_intent(
    body: DetectIntentBody,
    _auth: None = Depends(verify_internal_workflow_call),
) -> dict[str, Any]:
    """
    Classify RM/user utterance for routing (read vs update vs general) and suggest a catalog assessment.

    Uses the configured assessment LLM when available; otherwise heuristics.
    """
    settings = get_settings()
    hist = scrub_conversation_turns(
        [t.model_dump() for t in body.conversation_history] if body.conversation_history else None
    )
    return detect_chat_intent(
        message=body.user_message,
        phase_code=body.phase_code,
        case_id=body.case_id,
        conversation_history=hist,
        settings=settings,
    )


def _iter_narrate_stream(body: ChatNarrateBody) -> Iterator[bytes]:
    """NDJSON: THINKING phase → per-character assistant_delta → narrate_complete."""
    settings = get_settings()
    yield _ndjson_line({"type": "phase", "code": "THINKING"})
    hist = None
    if body.conversation_history:
        hist = scrub_conversation_turns([t.model_dump() for t in body.conversation_history])
    narr: dict[str, Any] | None = None
    reply = ""
    char_delta_count = 0
    try:
        reply_parts: list[str] = []
        for fragment in iter_chat_narrate_text_deltas(
            settings=settings,
            user_message=(body.user_message or "").strip(),
            pass1_findings=body.pass1_findings,
            pass1_output_text=body.pass1_output_text,
            conversation_history=hist,
            phase_code=(body.phase_code or "").strip() or None,
            assessment_code=(body.assessment_code or "").strip() or None,
            system_prompt=body.system_prompt,
            input_language=body.input_language,
        ):
            reply_parts.append(fragment)
            for ch in fragment:
                char_delta_count += 1
                yield _ndjson_line({"type": "assistant_delta", "text": ch})
        reply = "".join(reply_parts).strip()
        if reply:
            prov, model_label = assessment_llm_identity(settings)
            narr = {
                "chat_reply": reply,
                "provider": prov,
                "model": model_label,
                "streamed": True,
            }
    except ValueError as exc:
        _log.warning("narrate stream skipped: %s", exc)
        narr = None

    if not reply.strip():
        reply = _stream_reply_fallback(body.input_language)
        for delta in _yield_char_assistant_deltas(reply):
            char_delta_count += 1
            yield delta

    _log.info(
        "narrate stream done reply_len=%s narr_ok=%s char_deltas=%s",
        len(reply),
        narr is not None,
        char_delta_count,
    )
    complete: dict[str, Any] = {"type": "narrate_complete", "assistant_text": reply}
    if narr:
        complete["chat_narrate"] = narr
    yield _ndjson_line(complete)


@router.post("/narrate/stream")
def post_chat_narrate_stream(
    body: ChatNarrateBody,
    _auth: None = Depends(verify_internal_workflow_call),
) -> StreamingResponse:
    """
    NDJSON stream for pass-2 narrate only (phase change, document review, etc.).
    Non-streaming: ``POST /internal/chat/narrate``.
    """
    return StreamingResponse(
        _iter_narrate_stream(body),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/narrate")
def post_chat_narrate(
    body: ChatNarrateBody,
    _auth: None = Depends(verify_internal_workflow_call),
) -> dict[str, Any]:
    """
    Pass-2 LLM: turn pass-1 assessment JSON + user question (+ optional history) into a natural ``chat_reply``.

    Uses the same LLM credential gate as catalog assessment (``ASSESSMENT_LLM_ENABLED`` + provider keys).
    """
    settings = get_settings()
    hist = None
    if body.conversation_history:
        hist = scrub_conversation_turns([t.model_dump() for t in body.conversation_history])
    try:
        return run_chat_narrate(
            settings=settings,
            user_message=body.user_message,
            pass1_findings=body.pass1_findings,
            pass1_output_text=body.pass1_output_text,
            conversation_history=hist,
            phase_code=body.phase_code,
            assessment_code=body.assessment_code,
            system_prompt=body.system_prompt,
            input_language=body.input_language,
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
