"""
Maps ``OrchestrationContext`` to catalog pipeline agent ids (document / search / completeness).

Extend ``_SEARCH_ASSESSMENT_CODES`` when product assigns interaction IDs to the search agent.
"""

from __future__ import annotations

from typing import Final

from app.domain.smartwealth.models import OrchestrationContext
from app.orchestration.assessment.codes import AssessmentCode

_DOCUMENT_ASSESSMENT_CODES: Final[frozenset[str]] = frozenset(
    {
        AssessmentCode.DOCUMENT_REQUEST_DRAFT.value,
    }
)

# Add interaction IDs here when the matrix assigns dedicated knowledge-retrieval flows.
_SEARCH_ASSESSMENT_CODES: Final[frozenset[str]] = frozenset(
    {
        AssessmentCode.CLIENT_PROFILE_CONTEXT.value,
    }
)

_ALLOWED_OVERRIDES: Final[frozenset[str]] = frozenset(
    {"document_agent", "search_agent", "completeness_agent"}
)


def select_catalog_agent_id(context: OrchestrationContext) -> str:
    override = (context.variables or {}).get("catalog_agent")
    if isinstance(override, str) and override.strip() in _ALLOWED_OVERRIDES:
        return override.strip()

    code = (context.assessment_code or "").strip()
    if code in _DOCUMENT_ASSESSMENT_CODES:
        return "document_agent"
    if code in _SEARCH_ASSESSMENT_CODES:
        return "search_agent"
    return "completeness_agent"
