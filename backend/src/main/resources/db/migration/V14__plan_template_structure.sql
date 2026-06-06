ALTER TABLE plan_template
    ADD COLUMN IF NOT EXISTS structure_json JSONB,
    ADD COLUMN IF NOT EXISTS placeholders_detected JSONB,
    ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;
