-- Case-scoped documents: storage row (document) + link to case (case_document).
-- Replaces client_document (per-client checklist) to avoid mixing files across cases.

DROP TABLE IF EXISTS client_document CASCADE;

CREATE TABLE document (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_key VARCHAR(512),
    original_filename VARCHAR(512),
    content_type VARCHAR(128),
    byte_size BIGINT,
    uploaded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_created_at ON document (created_at);

CREATE TABLE case_document (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES "case" (id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES document (id) ON DELETE CASCADE,
    doc_kind VARCHAR(64) NOT NULL,
    phase_code VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_case_document_case_document UNIQUE (case_id, document_id)
);

CREATE INDEX idx_case_document_case_id ON case_document (case_id);
CREATE INDEX idx_case_document_case_doc_kind ON case_document (case_id, doc_kind);
