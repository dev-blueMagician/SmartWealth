-- Onboarding-oriented client profile: identity/demographics, household, document tracking.
-- Apply to the same database used by backend + AI-engine (shared PostgreSQL).

-- Case journey phase (aligns with WealthCase.phase in JPA; default for existing rows)
ALTER TABLE "case"
    ADD COLUMN IF NOT EXISTS phase VARCHAR(50) NOT NULL DEFAULT 'ONBOARDING';

-- Client demographics & contact (extend existing client table)
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

-- One row per client (household / related parties for onboarding POC)
CREATE TABLE IF NOT EXISTS client_household (
    client_id UUID PRIMARY KEY REFERENCES client (id) ON DELETE CASCADE,
    spouse_present BOOLEAN NOT NULL DEFAULT FALSE,
    dependents_count INT NOT NULL DEFAULT 0 CHECK (dependents_count >= 0),
    beneficiary_profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
    guardian_notes TEXT,
    trustee_notes TEXT,
    trust_structure_indicated BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Document checklist per client (status only; binary storage out of scope)
CREATE TABLE IF NOT EXISTS client_document (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES client (id) ON DELETE CASCADE,
    doc_kind VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'MISSING',
    file_ref VARCHAR(512),
    notes TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_client_document_client_kind UNIQUE (client_id, doc_kind)
);

CREATE INDEX IF NOT EXISTS idx_client_document_client_id ON client_document (client_id);
