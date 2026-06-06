CREATE TABLE IF NOT EXISTS case_discovery_field (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL,
  system_field    VARCHAR(200) NOT NULL,
  value_jsonb     JSONB,
  value_text      TEXT,
  source          VARCHAR(50) NOT NULL DEFAULT 'questionnaire',
  status          VARCHAR(30) NOT NULL DEFAULT 'missing',
  question_id     VARCHAR(32),
  block_index     INT NOT NULL DEFAULT 0,
  mapping_id      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_cdf_case
    FOREIGN KEY (case_id) REFERENCES "case"(id) ON DELETE CASCADE,
  CONSTRAINT fk_cdf_dictionary
    FOREIGN KEY (system_field) REFERENCES field_dictionary(system_field_name),
  CONSTRAINT fk_cdf_question
    FOREIGN KEY (question_id) REFERENCES question_definition(question_id),
  CONSTRAINT fk_cdf_mapping
    FOREIGN KEY (mapping_id) REFERENCES question_field_mapping(id),
  CONSTRAINT uq_cdf_case_field UNIQUE (case_id, system_field)
);

CREATE INDEX IF NOT EXISTS idx_cdf_case_status
  ON case_discovery_field (case_id, status);

CREATE INDEX IF NOT EXISTS idx_cdf_case_question
  ON case_discovery_field (case_id, question_id);
