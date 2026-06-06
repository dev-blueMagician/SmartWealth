-- Workflow → AI pipeline tables: events from SSOT, trigger rules, persisted assessment outputs.
-- Apply after scripts/sql/orchestration_minimal.sql

CREATE TABLE IF NOT EXISTS workflow_ai_trigger (
    trigger_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    to_state        VARCHAR(100) NOT NULL,
    assessment_code VARCHAR(32) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (to_state, assessment_code)
);

CREATE TABLE IF NOT EXISTS workflow_event (
    event_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     UUID NOT NULL,
    entity_type     VARCHAR(100) NOT NULL DEFAULT 'WORKFLOW',
    from_state      VARCHAR(100) NOT NULL,
    to_state        VARCHAR(100) NOT NULL,
    triggered_by    VARCHAR(32) NOT NULL,
    occurred_at     TIMESTAMPTZ NOT NULL,
    payload         JSONB,
    processed_at    TIMESTAMPTZ,
    processing_error TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_event_workflow_id ON workflow_event(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_event_pending ON workflow_event(occurred_at)
    WHERE processed_at IS NULL;

CREATE TABLE IF NOT EXISTS ai_result (
    result_id               UUID PRIMARY KEY,
    workflow_event_id       UUID REFERENCES workflow_event(event_id) ON DELETE SET NULL,
    request_id              UUID NOT NULL REFERENCES orchestration_request(request_id) ON DELETE CASCADE,
    step_name               VARCHAR(200) NOT NULL,
    provider                VARCHAR(100) NOT NULL,
    model                   VARCHAR(200) NOT NULL,
    output_text             TEXT NOT NULL,
    confidence_score        NUMERIC(5,4) NOT NULL,
    confidence_threshold    NUMERIC(5,4) NOT NULL,
    decision                VARCHAR(32) NOT NULL,
    decision_reason         TEXT NOT NULL,
    latency_ms              INT NOT NULL,
    input_tokens            INT NOT NULL,
    output_tokens           INT NOT NULL,
    produced_at             TIMESTAMPTZ NOT NULL,
    trace_id                VARCHAR(100) NOT NULL,
    safety_flagged          BOOLEAN NOT NULL,
    safety_category         VARCHAR(64) NOT NULL,
    human_approval_required BOOLEAN NOT NULL,
    human_approval_status   VARCHAR(32) NOT NULL,
    approved_by_user_id     UUID,
    approved_at             TIMESTAMPTZ,
    ssot_record_id          UUID NOT NULL,
    ssot_record_type        VARCHAR(50) NOT NULL,
    ssot_record_version     VARCHAR(50) NOT NULL,
    ssot_snapshot_id        UUID NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_result_request_id ON ai_result(request_id);
CREATE INDEX IF NOT EXISTS idx_ai_result_workflow_event_id ON ai_result(workflow_event_id);

CREATE TABLE IF NOT EXISTS ai_finding (
    finding_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id     UUID NOT NULL REFERENCES ai_result(result_id) ON DELETE CASCADE,
    finding_kind  VARCHAR(64) NOT NULL,
    field_path    VARCHAR(200),
    detail        TEXT,
    sort_order    INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ai_finding_result_id ON ai_finding(result_id);
