-- Case-scoped chat threads and messages (backend SSOT). AI-engine is called internally per turn.

CREATE TABLE case_chat_thread (
    id UUID PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES "case" (id) ON DELETE CASCADE,
    channel VARCHAR(32) NOT NULL DEFAULT 'CASE_CHAT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_case_chat_thread_case_channel UNIQUE (case_id, channel)
);

CREATE INDEX idx_case_chat_thread_case_id ON case_chat_thread (case_id);

CREATE TABLE case_chat_message (
    id UUID PRIMARY KEY,
    thread_id UUID NOT NULL REFERENCES case_chat_thread (id) ON DELETE CASCADE,
    sender_kind VARCHAR(16) NOT NULL,
    actor_role VARCHAR(32) NOT NULL,
    visibility VARCHAR(16) NOT NULL DEFAULT 'ALL',
    phase_code VARCHAR(50),
    assessment_code VARCHAR(64),
    body TEXT NOT NULL,
    ai_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_chat_message_thread_created ON case_chat_message (thread_id, created_at);
