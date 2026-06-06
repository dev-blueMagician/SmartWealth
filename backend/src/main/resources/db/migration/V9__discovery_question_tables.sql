CREATE TABLE IF NOT EXISTS question_definition (
  question_id      VARCHAR(32) PRIMARY KEY,
  module           VARCHAR(100),
  section          VARCHAR(100),
  question_text    TEXT,
  answer_type      VARCHAR(50),
  is_repeatable    BOOLEAN DEFAULT false,
  required_flag    BOOLEAN,
  conditional_flag BOOLEAN,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS question_option (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     VARCHAR(32),
  option_value    VARCHAR(100),
  option_label    VARCHAR(200),
  CONSTRAINT fk_q_option FOREIGN KEY (question_id)
    REFERENCES question_definition(question_id)
);

CREATE TABLE IF NOT EXISTS question_answer (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id        UUID NOT NULL,
  question_id    VARCHAR(32) NOT NULL,
  block_index    INT DEFAULT 0,
  answer_value   JSONB,
  created_at     TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_q_answer_case
    FOREIGN KEY (case_id) REFERENCES "case"(id),
  CONSTRAINT fk_q_answer_def
    FOREIGN KEY (question_id) REFERENCES question_definition(question_id)
);

CREATE TABLE IF NOT EXISTS question_field_mapping (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     VARCHAR(32) NOT NULL,
  system_field    VARCHAR(200) NOT NULL,
  entity_type     VARCHAR(50),
  transform_type  VARCHAR(50),
  created_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_q_map_question
    FOREIGN KEY (question_id) REFERENCES question_definition(question_id)
);
