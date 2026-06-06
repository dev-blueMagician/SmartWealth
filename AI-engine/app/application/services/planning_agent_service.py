from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from app.infrastructure.config.settings import Settings
from app.orchestration.planning.planning_compose_graph import PlanningComposeOrchestrator

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class PlanningAgentOutput:
    payload: dict[str, Any]


class PlanningAgentService:
    """
    Planning agent v2: LangGraph pipeline (analyze → plan document → compose → bind).
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._orchestrator = PlanningComposeOrchestrator(settings)

    def compose_payload(self, body: dict[str, Any]) -> PlanningAgentOutput:
        context = body.get("context", {}) if isinstance(body.get("context"), dict) else {}
        template = body.get("template", {}) if isinstance(body.get("template"), dict) else {}
        logger.info(
            "planning_agent.compose start caseId=%s templateCode=%s hasStructure=%s",
            context.get("caseId"),
            template.get("code") or context.get("templateCode"),
            bool(body.get("templateStructure")),
        )
        payload = self._orchestrator.run(body)
        logger.info(
            "planning_agent.compose done caseId=%s agent=%s tasks=%s llmUsed=%s exportPlaceholders=%d",
            context.get("caseId"),
            payload.get("agent"),
            payload.get("tasksRun"),
            payload.get("llmUsed"),
            len(payload.get("exportPlaceholders") or {}),
        )
        return PlanningAgentOutput(payload=payload)

    def analyze_template(
        self,
        template_bytes: bytes,
        *,
        mapping_json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        logger.info("planning_agent.analyze_template bytes=%d", len(template_bytes))
        return self._orchestrator.analyze_template_bytes(template_bytes, mapping_json=mapping_json)
