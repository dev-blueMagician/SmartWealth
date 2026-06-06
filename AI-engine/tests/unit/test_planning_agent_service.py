from __future__ import annotations

from app.application.services.planning_agent_service import PlanningAgentService
from app.infrastructure.config.settings import Settings


def test_compose_payload_rule_only_when_llm_disabled() -> None:
    settings = Settings(assessment_llm_enabled=False)
    svc = PlanningAgentService(settings)
    out = svc.compose_payload(
        {
            "discovery": {
                "mandatoryFieldsTotal": 10,
                "mandatoryFieldsFilled": 8,
                "mandatoryFieldsMissing": 2,
            },
            "template": {"code": "VN_STD", "locale": "vi-VN"},
            "assumptions": {"horizonYears": 20},
            "templateStructure": {
                "detectedPlaceholders": ["{{CLIENT_NAME}}"],
                "sections": [],
            },
        }
    )
    payload = out.payload
    assert payload["agent"] == "planning_agent_v2"
    assert payload["llmUsed"] is False
    assert payload["keyMetrics"]["mandatoryMissing"] == 2
    assert payload["narratives"]["qualityGate"] == "DRAFT"
    assert "documentTemplate" in payload
    assert "templateAnalysis" in payload
    assert "tasksRun" in payload
