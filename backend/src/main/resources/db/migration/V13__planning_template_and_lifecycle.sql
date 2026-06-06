CREATE TABLE IF NOT EXISTS plan_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    version_no INT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    locale VARCHAR(16) NOT NULL DEFAULT 'vi-VN',
    product_type VARCHAR(80),
    document_id UUID NOT NULL REFERENCES document(id) ON DELETE RESTRICT,
    mapping_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_plan_template_code_version UNIQUE (code, version_no)
);

CREATE INDEX IF NOT EXISTS idx_plan_template_status
    ON plan_template (status);

ALTER TABLE financial_plan
    ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES plan_template(id),
    ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS plan_artifact (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES financial_plan(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES document(id) ON DELETE CASCADE,
    artifact_kind VARCHAR(40) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_artifact_plan
    ON plan_artifact (plan_id, created_at DESC);
