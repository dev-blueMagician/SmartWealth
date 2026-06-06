-- MVP orchestration: một bảng = request + runtime context + SSOT snapshot pointer.
-- Không tenant table; environment/feature_flags optional per-row (single-tenant dev).
-- Apply before scripts/sql/workflow_ai_pipeline.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS orchestration_request (
    request_id              UUID PRIMARY KEY,
    workflow_id             UUID NOT NULL,
    user_id                   UUID NOT NULL,
    correlation_id          VARCHAR(100) NOT NULL,
    input_text              TEXT NOT NULL,
    input_language          VARCHAR(16) NOT NULL,
    source_channel          VARCHAR(50) NOT NULL,
    priority                INT NOT NULL DEFAULT 1,
    requested_at            TIMESTAMPTZ NOT NULL,
    confidence_threshold    NUMERIC(4,3) NOT NULL CHECK (
        confidence_threshold >= 0 AND confidence_threshold <= 1
    ),
    human_approval_required BOOLEAN NOT NULL DEFAULT FALSE,
    ssot_record_id          UUID NOT NULL,
    ssot_record_type        VARCHAR(50) NOT NULL,
    ssot_record_version     VARCHAR(50) NOT NULL,
    ssot_correlation_id     VARCHAR(100) NOT NULL,
    assessment_code         VARCHAR(64) NOT NULL DEFAULT 'onboarding_completeness',
    ssot_snapshot_id        UUID NOT NULL,
    environment             VARCHAR(30) NOT NULL DEFAULT 'dev',
    feature_flags           JSONB NOT NULL DEFAULT '{}'::jsonb,
    session_id              VARCHAR(100) NOT NULL,
    current_step            VARCHAR(100) NOT NULL,
    attempt_count           INT NOT NULL DEFAULT 1 CHECK (attempt_count >= 0),
    previous_result_ids     JSONB NOT NULL DEFAULT '[]'::jsonb,
    escalation_required     BOOLEAN NOT NULL DEFAULT FALSE,
    human_approval_status   VARCHAR(30) NOT NULL,
    human_approver_id       UUID,
    human_approval_at       TIMESTAMPTZ,
    variables               JSONB NOT NULL DEFAULT '{}'::jsonb,
    context_updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orq_workflow_id ON orchestration_request(workflow_id);
