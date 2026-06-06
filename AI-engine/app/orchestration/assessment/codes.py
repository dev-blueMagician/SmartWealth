from __future__ import annotations

from enum import Enum


class AssessmentCode(str, Enum):
    """
    Canonical assessment_code / interaction_id values (no legacy AI-xx prefix).
    Align with workflow_ai_trigger.assessment_code, orchestration_request.assessment_code,
    and ai_interaction.interaction_id. Register runners in assessment.registry as implementations ship.
    """

    ONBOARDING_COMPLETENESS = "onboarding_completeness"
    CLIENT_EXPLAIN_ONBOARDING = "client_explain_onboarding"
    DOCUMENT_REQUEST_DRAFT = "document_request_draft"
    SPECIAL_SITUATION_DETECT = "special_situation_detect"
    CLIENT_PROFILE_CONTEXT = "client_profile_context"
    CLIENT_SUMMARY_STRUCTURE = "client_summary_structure"
    PLANNING_READINESS_GAP = "planning_readiness_gap"
    ASSESSMENT_07 = "assessment_07"
    ASSESSMENT_08 = "assessment_08"
    ASSESSMENT_09 = "assessment_09"
    ASSESSMENT_10 = "assessment_10"
    ASSESSMENT_11 = "assessment_11"
    ASSESSMENT_12 = "assessment_12"
    ASSESSMENT_13 = "assessment_13"
    ASSESSMENT_14 = "assessment_14"
    ASSESSMENT_15 = "assessment_15"
    ASSESSMENT_16 = "assessment_16"
    ASSESSMENT_17 = "assessment_17"
    ASSESSMENT_18 = "assessment_18"
    ASSESSMENT_19 = "assessment_19"
    ASSESSMENT_20 = "assessment_20"
    ASSESSMENT_21 = "assessment_21"
    ASSESSMENT_22 = "assessment_22"
    ASSESSMENT_23 = "assessment_23"
    ASSESSMENT_24 = "assessment_24"
    ASSESSMENT_25 = "assessment_25"
    ASSESSMENT_26 = "assessment_26"
    ASSESSMENT_27 = "assessment_27"
    ASSESSMENT_28 = "assessment_28"
    ASSESSMENT_29 = "assessment_29"
    ASSESSMENT_30 = "assessment_30"
    ASSESSMENT_31 = "assessment_31"
    ASSESSMENT_32 = "assessment_32"
    ASSESSMENT_33 = "assessment_33"
    ASSESSMENT_34 = "assessment_34"
