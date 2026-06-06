-- Logical migrations aligned with backend Flyway V6 + V7 (idempotent helpers).
-- Run manually against the shared PostgreSQL used by backend + AI-engine if not using Flyway.

ALTER TABLE "case"
    ADD COLUMN IF NOT EXISTS phase VARCHAR(50) NOT NULL DEFAULT 'ONBOARDING';

ALTER TABLE client
    ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE client
    ADD COLUMN IF NOT EXISTS marital_status VARCHAR(32);
ALTER TABLE client
    ADD COLUMN IF NOT EXISTS nationality VARCHAR(64);
ALTER TABLE client
    ADD COLUMN IF NOT EXISTS primary_phone VARCHAR(64);
ALTER TABLE client
    ADD COLUMN IF NOT EXISTS primary_email VARCHAR(255);
ALTER TABLE client
    ADD COLUMN IF NOT EXISTS contact_address TEXT;

CREATE TABLE IF NOT EXISTS client_household (
    client_id UUID PRIMARY KEY REFERENCES client (id) ON DELETE CASCADE,
    spouse_present BOOLEAN NOT NULL DEFAULT FALSE,
    dependents_count INT NOT NULL DEFAULT 0 CHECK (dependents_count >= 0),
    beneficiary_profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
    guardian_notes TEXT,
    trustee_notes TEXT,
    trust_structure_indicated BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- V7: case-scoped documents (replaces client_document).
DROP TABLE IF EXISTS client_document CASCADE;

CREATE TABLE IF NOT EXISTS document (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_key VARCHAR(512),
    original_filename VARCHAR(512),
    content_type VARCHAR(128),
    byte_size BIGINT,
    uploaded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_created_at ON document (created_at);

CREATE TABLE IF NOT EXISTS case_document (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES "case" (id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES document (id) ON DELETE CASCADE,
    doc_kind VARCHAR(64) NOT NULL,
    phase_code VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_case_document_case_document UNIQUE (case_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_case_document_case_id ON case_document (case_id);
CREATE INDEX IF NOT EXISTS idx_case_document_case_doc_kind ON case_document (case_id, doc_kind);

-- V8: review lifecycle on case_document.
ALTER TABLE case_document
    ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'PENDING';
ALTER TABLE case_document
    ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE case_document
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_case_document_case_status ON case_document (case_id, status);
