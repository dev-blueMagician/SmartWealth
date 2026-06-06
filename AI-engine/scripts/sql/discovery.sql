-- 1. Định nghĩa câu hỏi
CREATE TABLE smartwealth.question_definition (
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

-- 2. Tùy chọn câu hỏi
CREATE TABLE smartwealth.question_option (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     VARCHAR(32),
  option_value    VARCHAR(100),
  option_label    VARCHAR(200),
  CONSTRAINT fk_q_option FOREIGN KEY (question_id)
    REFERENCES smartwealth.question_definition(question_id)
);

-- 3. Lưu câu trả lời
CREATE TABLE smartwealth.question_answer (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id        UUID NOT NULL,
  question_id    VARCHAR(32) NOT NULL,
  block_index    INT DEFAULT 0,
  answer_value   JSONB,
  created_at     TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_q_answer_case
    FOREIGN KEY (case_id) REFERENCES smartwealth.case(id),
  CONSTRAINT fk_q_answer_def
    FOREIGN KEY (question_id) REFERENCES smartwealth.question_definition(question_id)
);

-- 4. Mapping QID với domain field
CREATE TABLE IF NOT EXISTS smartwealth.field_dictionary (
  system_field_name   VARCHAR(200) PRIMARY KEY,
  row_no              INT,
  data_domain         VARCHAR(200),
  data_item           VARCHAR(200),
  detail_field_group  VARCHAR(200),
  detail_field_no     INT,
  detail_field_name   VARCHAR(200),
  field_description   TEXT,
  data_type           VARCHAR(100),
  mandatory_level     VARCHAR(50),
  applies_to          VARCHAR(100),
  suggested_source    TEXT,
  validation_rule     TEXT,
  used_for            TEXT,
  sensitivity         VARCHAR(100),
  update_frequency    VARCHAR(100),
  missing_data_action TEXT,
  example_value       TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS smartwealth.case_discovery_field (
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
  CONSTRAINT fk_cdf_case FOREIGN KEY (case_id) REFERENCES smartwealth."case"(id) ON DELETE CASCADE,
  CONSTRAINT fk_cdf_dictionary FOREIGN KEY (system_field) REFERENCES smartwealth.field_dictionary(system_field_name),
  CONSTRAINT uq_cdf_case_field UNIQUE (case_id, system_field)
);

CREATE TABLE smartwealth.question_field_mapping (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     VARCHAR(32) NOT NULL,
  system_field    VARCHAR(200) NOT NULL,
  entity_type     VARCHAR(50),
  transform_type  VARCHAR(50),
  created_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_q_map_question
    FOREIGN KEY (question_id) REFERENCES smartwealth.question_definition(question_id)
);