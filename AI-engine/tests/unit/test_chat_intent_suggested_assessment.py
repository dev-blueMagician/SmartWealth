from __future__ import annotations

import pytest
from unittest.mock import MagicMock

from app.application.services.chat_intent_service import detect_chat_intent


def test_update_intent_on_onboarding_suggests_onboarding_completeness() -> None:
    out = detect_chat_intent(
        message="Tôi muốn cập nhật số điện thoại là 0909123456",
        phase_code="ONBOARDING",
        case_id="00000000-0000-0000-0000-000000000001",
    )
    assert out["intent"] == "UPDATE_INFORMATION"
    assert out["suggested_assessment_code"] == "onboarding_completeness"
    assert out["detector"] == "heuristic_v1"


def test_read_intent_on_onboarding() -> None:
    out = detect_chat_intent(
        message="Case còn thiếu tài liệu gì?",
        phase_code="ONBOARDING",
        case_id="00000000-0000-0000-0000-000000000001",
    )
    assert out["intent"] == "READ_INFORMATION"
    assert out["detector"] == "heuristic_v1"


def test_parse_intent_llm_json() -> None:
    from app.application.services.chat_intent_service import _parse_intent_llm_response

    phases = ("ONBOARDING", "DISCOVERY", "PLANNING", "COLLABORATION", "EXECUTION", "MONITORING")
    raw = '{"intent":"GENERAL","confidence":0.4,"rationale":"Small talk.","suggested_assessment_code":null}'
    p = _parse_intent_llm_response(raw, valid_phase_codes=phases)
    assert p is not None
    assert p["intent"] == "GENERAL"
    assert p["confidence"] == 0.4


def test_heuristic_confident_skips_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    """When heuristic matches strongly, LLM should not be called at all."""
    import app.application.services.chat_intent_service as mod
    from app.infrastructure.config.settings import Settings
    from app.infrastructure.llm.types import LlmChatResult

    monkeypatch.setattr(mod, "assessment_llm_ready", lambda _s: True)
    fake_llm = MagicMock()
    monkeypatch.setattr(mod, "chat_completion_adapter_from_settings", lambda _s: fake_llm)

    out = mod.detect_chat_intent(
        message="Tôi muốn cập nhật số điện thoại là 0909123456",
        phase_code="ONBOARDING",
        case_id="00000000-0000-0000-0000-000000000001",
        settings=Settings(assessment_llm_enabled=True, deepseek_api_key="sk-test"),
    )
    assert out["detector"] == "heuristic_v1"
    assert out["intent"] == "UPDATE_INFORMATION"
    assert out["suggested_assessment_code"] == "onboarding_completeness"
    fake_llm.chat.assert_not_called()


def test_ambiguous_message_escalates_to_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    """When heuristic is weak (no keyword match), LLM is called for classification."""
    import app.application.services.chat_intent_service as mod
    from app.infrastructure.config.settings import Settings
    from app.infrastructure.llm.types import LlmChatResult

    monkeypatch.setattr(mod, "assessment_llm_ready", lambda _s: True)
    fake_llm = MagicMock()
    fake_llm.chat.return_value = LlmChatResult(
        text='{"intent":"UPDATE_INFORMATION","confidence":0.88,"rationale":"User supplies data.",'
        '"suggested_assessment_code":null,"target_phase_code":null}',
        model="deepseek-chat",
        input_tokens=10,
        output_tokens=5,
        raw={},
    )
    monkeypatch.setattr(mod, "chat_completion_adapter_from_settings", lambda _s: fake_llm)

    out = mod.detect_chat_intent(
        message="email mới là a@b.com",
        phase_code="ONBOARDING",
        case_id="00000000-0000-0000-0000-000000000001",
        settings=Settings(assessment_llm_enabled=True, deepseek_api_key="sk-test"),
    )
    assert out["detector"] == "hybrid_heuristic_llm"
    assert out["intent"] == "UPDATE_INFORMATION"
    assert out["suggested_assessment_code"] == "onboarding_completeness"
    assert out.get("model") == "deepseek-chat"
    fake_llm.chat.assert_called_once()


def test_llm_bogus_assessment_code_coerced_to_phase_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """LLM must not be able to suggest arbitrary strings that would 400 on /internal/chat/turn."""
    import app.application.services.chat_intent_service as mod
    from app.infrastructure.config.settings import Settings
    from app.infrastructure.llm.types import LlmChatResult

    monkeypatch.setattr(mod, "assessment_llm_ready", lambda _s: True)
    fake_llm = MagicMock()
    fake_llm.chat.return_value = LlmChatResult(
        text='{"intent":"READ_INFORMATION","confidence":0.9,"rationale":"Asks what is missing.",'
        '"suggested_assessment_code":"MISSING_INFORMATION_SUMMARY","target_phase_code":null}',
        model="deepseek-chat",
        input_tokens=10,
        output_tokens=5,
        raw={},
    )
    monkeypatch.setattr(mod, "chat_completion_adapter_from_settings", lambda _s: fake_llm)

    from app.domain.smartwealth.interaction_catalog import get_interaction_spec

    out = mod.detect_chat_intent(
        message="tình hình hồ sơ ra sao rồi nhỉ",
        phase_code="ONBOARDING",
        case_id="00000000-0000-4000-8000-000000000002",
        settings=Settings(assessment_llm_enabled=True, deepseek_api_key="sk-test"),
    )
    assert out["detector"] == "hybrid_heuristic_llm"
    assert out["intent"] == "READ_INFORMATION"
    assert get_interaction_spec(out["suggested_assessment_code"]) is not None
    assert out["suggested_assessment_code"] != "MISSING_INFORMATION_SUMMARY"


def test_change_phase_heuristic_next() -> None:
    out = detect_chat_intent(
        message="OK chuyển phase tiếp theo giúp tôi",
        phase_code="ONBOARDING",
        case_id="00000000-0000-0000-0000-000000000001",
    )
    assert out["intent"] == "CHANGE_PHASE"
    assert out.get("target_phase_code") is None
    assert out.get("suggested_assessment_code") is None


def test_change_phase_heuristic_explicit_discovery() -> None:
    out = detect_chat_intent(
        message="Chuyển sang DISCOVERY giúp tôi",
        phase_code="ONBOARDING",
        case_id="00000000-0000-0000-0000-000000000001",
    )
    assert out["intent"] == "CHANGE_PHASE"
    assert out.get("target_phase_code") == "DISCOVERY"
    assert out.get("suggested_assessment_code") is None
