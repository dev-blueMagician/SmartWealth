-- Add review lifecycle to case_document: PENDING → VERIFIED / REJECTED.
ALTER TABLE case_document
    ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'PENDING';

ALTER TABLE case_document
    ADD COLUMN IF NOT EXISTS reviewed_by UUID;

ALTER TABLE case_document
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_case_document_case_status ON case_document (case_id, status);
