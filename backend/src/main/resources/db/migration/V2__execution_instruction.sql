CREATE TABLE execution_instruction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES recommendation(id),
    status VARCHAR(50) NOT NULL,
    payload JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_execution_instruction_rec ON execution_instruction(recommendation_id);
