CREATE TABLE IF NOT EXISTS field_dictionary (
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

CREATE INDEX IF NOT EXISTS idx_field_dictionary_domain
  ON field_dictionary (data_domain, data_item);

CREATE INDEX IF NOT EXISTS idx_field_dictionary_mandatory
  ON field_dictionary (mandatory_level);
