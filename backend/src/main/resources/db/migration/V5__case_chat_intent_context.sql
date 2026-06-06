ALTER TABLE case_chat_message
    ADD COLUMN IF NOT EXISTS intent_code VARCHAR(32),
    ADD COLUMN IF NOT EXISTS context_snapshot JSONB;
