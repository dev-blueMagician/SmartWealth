-- Seed workflow_ai_trigger: READY_FOR_VALIDATION → onboarding_completeness (AssessmentCode.ONBOARDING_COMPLETENESS)
-- Apply after scripts/sql/workflow_ai_pipeline.sql

INSERT INTO workflow_ai_trigger (to_state, assessment_code, enabled)
VALUES ('READY_FOR_VALIDATION', 'onboarding_completeness', TRUE)
ON CONFLICT (to_state, assessment_code) DO UPDATE SET enabled = EXCLUDED.enabled;
