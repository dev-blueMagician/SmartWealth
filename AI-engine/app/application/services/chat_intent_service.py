from __future__ import annotations

import json
import logging
import re
from typing import Any, Literal

from app.domain.smartwealth.case_phase_manifest import (
    assessments_for_phase,
    list_phase_keys_in_order,
    load_case_phase_manifest,
)
from app.domain.smartwealth.interaction_catalog import get_interaction_spec
from app.infrastructure.config.settings import Settings
from app.infrastructure.llm.factory import assessment_llm_ready, chat_completion_adapter_from_settings
from app.prompts import load_prompt

_log = logging.getLogger(__name__)

IntentLiteral = Literal["READ_INFORMATION", "UPDATE_INFORMATION", "GENERAL", "CHANGE_PHASE", "VERIFY_DOCUMENT"]

_VALID_INTENTS: frozenset[str] = frozenset(
    {"READ_INFORMATION", "UPDATE_INFORMATION", "GENERAL", "CHANGE_PHASE", "VERIFY_DOCUMENT"}
)

_INTENT_LLM_SYSTEM = load_prompt("chat_intent_system")


def _normalize_phase(phase: str) -> str:
    p = (phase or "").strip().upper()
    return p if p else "ONBOARDING"


def _valid_case_phase_codes() -> tuple[str, ...]:
    manifest = load_case_phase_manifest()
    return list_phase_keys_in_order(manifest)


def _default_assessment_for_phase(phase_code: str) -> str:
    manifest = load_case_phase_manifest()
    codes = assessments_for_phase(manifest, phase_code)
    if codes:
        return codes[0]
    return "onboarding_completeness"


def _coerce_suggested_assessment_code(suggested: str | None, *, phase: str) -> str | None:
    """
    LLMs often emit descriptive pseudo-codes. Only values present in the interaction catalog may run
    ``/internal/chat/turn``; anything else falls back to the phase default.
    """
    if suggested is None:
        return None
    c = suggested.strip()
    if not c:
        return None
    if get_interaction_spec(c) is not None:
        return c
    _log.debug("Ignoring unknown suggested_assessment_code %r for phase %s", c, phase)
    return None


def _coerce_target_phase_code(raw: str | None, *, valid: tuple[str, ...]) -> str | None:
    if raw is None:
        return None
    t = raw.strip().upper()
    if not t:
        return None
    allowed = {p.upper() for p in valid}
    return t if t in allowed else None


def _looks_like_change_phase(message: str) -> bool:
    text = (message or "").strip()
    if not text:
        return False
    lower = text.lower()
    cues = (
        "chuyển phase",
        "chuyen phase",
        "next phase",
        "phase tiếp",
        "phase tiep",
        "sang phase",
        "advance phase",
        "move to phase",
        "đổi phase",
        "doi phase",
        "chuyển sang",
        "chuyen sang",
        "go to phase",
        "set phase",
        "chuyển case",
        "chuyen case",
    )
    if any(c in lower for c in cues):
        return True
    next_only = (
        "phase tiếp theo",
        "phase tiep theo",
        "bước tiếp",
        "buoc tiep",
        "next step",
        "tiếp theo giúp",
        "tiep theo giup",
    )
    if any(c in lower for c in next_only):
        return True
    valid = _valid_case_phase_codes()
    upper = text.upper()
    if any(p in upper for p in valid):
        strong = ("chuyển", "chuyen", "move", "advance", "set ", "sang ", "to ", "→")
        return any(s in lower for s in strong)
    return False


def _wants_next_phase_only(lower: str) -> bool:
    return any(
        p in lower
        for p in (
            "next phase",
            "phase tiếp theo",
            "phase tiep theo",
            "phase ke tiep",
            "bước tiếp",
            "buoc tiep",
            "tiếp theo giúp",
            "tiep theo giup",
            "sang phase tiep",
            "chuyển phase tiếp",
            "chuyen phase tiep",
        )
    )


def _heuristic_extract_target_phase(message: str) -> str | None:
    """
    Return an explicit UPPER phase code from the message, or None to mean \"next\" / resolver default.
    """
    lower = (message or "").strip().lower()
    if _wants_next_phase_only(lower) and not re.search(
        r"\b(ONBOARDING|DISCOVERY|PLANNING|COLLABORATION|EXECUTION|MONITORING)\b",
        message,
        flags=re.IGNORECASE,
    ):
        return None
    valid = _valid_case_phase_codes()
    sorted_phases = sorted(valid, key=len, reverse=True)
    upper_msg = (message or "").strip().upper()
    for p in sorted_phases:
        if p in upper_msg:
            return p.upper()
    return None


def _looks_like_verify_document(message: str) -> bool:
    lower = (message or "").strip().lower()
    if not lower:
        return False
    verify_cues = (
        "duyệt tài liệu",
        "duyet tai lieu",
        "chấp nhận tài liệu",
        "chap nhan tai lieu",
        "approve document",
        "verify document",
        "accept document",
        "reject document",
        "từ chối tài liệu",
        "tu choi tai lieu",
        "xác nhận tài liệu",
        "xac nhan tai lieu",
        "duyệt doc",
        "duyet doc",
        "verify doc",
        "approve doc",
        "reject doc",
    )
    return any(c in lower for c in verify_cues)


def _heuristic_intent(message: str) -> tuple[IntentLiteral, float, str, str | None]:
    text = (message or "").strip()
    if not text:
        return "GENERAL", 0.3, "Empty message; defaulting to GENERAL.", None

    if _looks_like_change_phase(text):
        tgt = _heuristic_extract_target_phase(text)
        return "CHANGE_PHASE", 0.82, "Matched explicit phase-change / next-phase cue (heuristic).", tgt

    if _looks_like_verify_document(text):
        return "VERIFY_DOCUMENT", 0.85, "Matched document verify/reject cue (heuristic).", None

    lower = text.lower()
    update_patterns = (
        "cập nhật",
        "cap nhat",
        "sửa ",
        "sua ",
        "thay đổi",
        "thay doi",
        "update",
        "ghi nhận",
        "ghi nhan",
        "lưu ",
        "luu ",
        "đổi ",
        "doi ",
        "chỉnh sửa",
        "chinh sua",
        "mark as",
        "set status",
        "complete task",
        "bổ sung",
        "bo sung",
        "cung cấp thêm",
        "cung cap them",
        "khai báo",
        "khai bao",
    )
    read_patterns = (
        "cho biết",
        "cho biet",
        "xem ",
        "lấy ",
        "lay ",
        "hiển thị",
        "hien thi",
        "what ",
        "how ",
        "show ",
        "get ",
        "status",
        "còn thiếu",
        "con thieu",
        "thiếu gì",
        "thieu gi",
        "đủ chưa",
        "du chua",
        "check ",
        "tóm tắt",
        "tom tat",
        "summary",
    )

    if any(p in lower for p in update_patterns):
        return "UPDATE_INFORMATION", 0.75, "Matched update / write-style cue (heuristic).", None
    if "?" in text or any(p in lower for p in read_patterns):
        return "READ_INFORMATION", 0.7, "Matched question or read-style cue (heuristic).", None
    if len(text) > 80:
        return "READ_INFORMATION", 0.55, "Long utterance without write cues; assumed exploratory read.", None
    return "GENERAL", 0.5, "No strong cue; GENERAL fallback.", None


def _strip_json_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
        t = re.sub(r"\s*```$", "", t)
    return t.strip()


def _parse_intent_llm_response(text: str, *, valid_phase_codes: tuple[str, ...]) -> dict[str, Any] | None:
    raw = _strip_json_fence(text)
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    intent = data.get("intent")
    if not isinstance(intent, str) or intent.strip() not in _VALID_INTENTS:
        return None
    conf = data.get("confidence", 0.7)
    try:
        c = float(conf)
    except (TypeError, ValueError):
        c = 0.7
    c = max(0.0, min(1.0, c))
    rationale = data.get("rationale")
    if not isinstance(rationale, str) or not rationale.strip():
        rationale = "LLM intent classification."
    sac = data.get("suggested_assessment_code")
    if sac is not None and not isinstance(sac, str):
        sac = None
    if isinstance(sac, str):
        sac = sac.strip() or None
    tpc = data.get("target_phase_code")
    if tpc is not None and not isinstance(tpc, str):
        tpc = None
    if isinstance(tpc, str):
        tpc = _coerce_target_phase_code(tpc.strip(), valid=valid_phase_codes)
    va = data.get("verify_action")
    if isinstance(va, str):
        va = va.strip().upper()
        if va not in ("VERIFIED", "REJECTED"):
            va = None
    else:
        va = None
    return {
        "intent": intent.strip(),
        "confidence": c,
        "rationale": rationale.strip(),
        "suggested_assessment_code": sac,
        "target_phase_code": tpc,
        "verify_action": va,
    }


_HEURISTIC_CONFIDENCE_THRESHOLD = 0.7


def _build_result(
    *,
    case_id: str,
    phase: str,
    intent: str,
    confidence: float,
    suggested: str | None,
    target_phase_code: str | None,
    verify_action: str | None,
    rationale: str,
    history_len: int,
    detector: str,
    model: str | None,
    phase_options: list[str],
    valid_case_phases: tuple[str, ...],
) -> dict[str, Any]:
    if intent in ("CHANGE_PHASE", "VERIFY_DOCUMENT"):
        suggested = None
    elif intent == "UPDATE_INFORMATION" and phase == "ONBOARDING":
        suggested = "onboarding_completeness"
    elif suggested is None:
        suggested = _default_assessment_for_phase(phase)
    return {
        "case_id": case_id.strip(),
        "phase_code": phase,
        "intent": intent,
        "confidence": round(confidence, 3),
        "suggested_assessment_code": suggested,
        "target_phase_code": target_phase_code,
        "verify_action": verify_action,
        "rationale": rationale,
        "conversation_turn_count": history_len,
        "detector": detector,
        "model": model,
        "phase_assessment_options": phase_options,
        "valid_case_phase_codes": list(valid_case_phases),
    }


def _try_llm_intent(
    *,
    message: str,
    phase: str,
    case_id: str,
    history_tail: list[dict[str, str]],
    phase_options: list[str],
    valid_case_phases: tuple[str, ...],
    settings: Settings,
) -> dict[str, Any] | None:
    """Call LLM intent classifier. Returns parsed dict or None on failure."""
    try:
        llm = chat_completion_adapter_from_settings(settings)
        user_payload = {
            "case_id": case_id.strip(),
            "phase_code": phase,
            "latest_message": (message or "").strip(),
            "recent_turns": history_tail,
            "valid_assessment_codes_for_phase": phase_options,
            "valid_case_phase_codes": list(valid_case_phases),
        }
        chat = llm.chat(
            system=_INTENT_LLM_SYSTEM,
            user=json.dumps(user_payload, ensure_ascii=False, indent=2),
        )
        parsed = _parse_intent_llm_response(chat.text or "", valid_phase_codes=valid_case_phases)
        if parsed is not None:
            parsed["_model"] = chat.model
            return parsed
        _log.debug("LLM returned unparseable intent response")
    except Exception as exc:
        _log.debug("LLM intent detection failed: %s", exc)
    return None


def detect_chat_intent(
    *,
    message: str,
    phase_code: str,
    case_id: str,
    conversation_history: list[dict[str, str]] | None = None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """
    Hybrid heuristic-first intent detection.

    1. Run fast keyword heuristics.
    2. If confidence >= threshold (keyword matched clearly), return immediately.
    3. Otherwise escalate to LLM for ambiguous messages.
    4. If LLM unavailable or fails, return the heuristic result.
    """
    phase = _normalize_phase(phase_code)
    history_len = len(conversation_history or [])
    history_tail = (conversation_history or [])[-12:]

    manifest = load_case_phase_manifest()
    phase_options = assessments_for_phase(manifest, phase)
    valid_case_phases = _valid_case_phase_codes()

    common = dict(
        case_id=case_id,
        phase=phase,
        history_len=history_len,
        phase_options=phase_options,
        valid_case_phases=valid_case_phases,
    )

    # --- step 1: heuristic ---
    h_intent, h_conf, h_rationale, h_target = _heuristic_intent(message)

    if h_conf >= _HEURISTIC_CONFIDENCE_THRESHOLD:
        _log.debug("Heuristic confident (%s %.2f), skipping LLM", h_intent, h_conf)
        suggested = _coerce_suggested_assessment_code(None, phase=phase)
        return _build_result(
            intent=h_intent,
            confidence=h_conf,
            suggested=suggested or _default_assessment_for_phase(phase),
            target_phase_code=h_target,
            verify_action=None,
            rationale=h_rationale,
            detector="heuristic_v1",
            model=None,
            **common,
        )

    # --- step 2: LLM escalation for ambiguous messages ---
    llm_available = settings is not None and assessment_llm_ready(settings)
    if llm_available:
        _log.debug(
            "Heuristic weak (%s %.2f), escalating to LLM",
            h_intent, h_conf,
        )
        parsed = _try_llm_intent(
            message=message,
            phase=phase,
            case_id=case_id,
            history_tail=history_tail,
            phase_options=phase_options,
            valid_case_phases=valid_case_phases,
            settings=settings,  # type: ignore[arg-type]
        )
        if parsed is not None:
            llm_model = parsed.pop("_model", None)
            target_phase_code = parsed.get("target_phase_code")
            if isinstance(target_phase_code, str):
                target_phase_code = target_phase_code.strip().upper() or None
            suggested = _coerce_suggested_assessment_code(
                parsed.get("suggested_assessment_code"),
                phase=phase,
            )
            return _build_result(
                intent=parsed["intent"],
                confidence=parsed["confidence"],
                suggested=suggested or _default_assessment_for_phase(phase),
                target_phase_code=target_phase_code,
                verify_action=parsed.get("verify_action"),
                rationale=parsed["rationale"],
                detector="hybrid_heuristic_llm",
                model=llm_model,
                **common,
            )

    # --- step 3: fallback to heuristic result ---
    detector = "heuristic_v1_llm_unavailable" if not llm_available else "heuristic_v1_llm_fallback"
    return _build_result(
        intent=h_intent,
        confidence=h_conf,
        suggested=_default_assessment_for_phase(phase),
        target_phase_code=h_target,
        verify_action=None,
        rationale=h_rationale,
        detector=detector,
        model=None,
        **common,
    )


def conversation_history_json_safe(turns: list[dict[str, Any]], *, max_turns: int = 30) -> str:
    """Serialize last N turns for orchestration variables."""
    tail = turns[-max_turns:] if len(turns) > max_turns else turns
    return json.dumps(tail, ensure_ascii=False)


def scrub_conversation_turns(raw: list[dict[str, Any]] | None, *, max_content: int = 8000) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    if not raw:
        return out
    role_map = {"user": "user", "assistant": "assistant", "system": "system", "rm": "user", "human": "user"}
    for item in raw:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or item.get("sender") or "user").lower().strip()
        role = role_map.get(role, "user" if role not in ("assistant", "system") else role)
        content = str(item.get("content") or item.get("body") or "").strip()
        if not content:
            continue
        if len(content) > max_content:
            content = content[: max_content - 1] + "…"
        out.append({"role": role, "content": content})
    return out[-30:]
