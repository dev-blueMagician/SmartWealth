-- Apply on existing DBs (idempotent-ish).

ALTER TABLE ai_interaction ADD COLUMN IF NOT EXISTS system_prompt text NULL;

CREATE TABLE IF NOT EXISTS ai_llm_profile (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code varchar(64) NOT NULL,
    display_name varchar(200) NOT NULL,
    llm_provider varchar(32) NOT NULL,
    deepseek_base_url varchar(512) NULL,
    deepseek_model varchar(128) NULL,
    deepseek_api_key text NULL,
    azure_openai_endpoint varchar(512) NULL,
    azure_openai_deployment varchar(128) NULL,
    azure_openai_api_version varchar(64) NULL,
    azure_openai_api_key text NULL,
    assessment_llm_enabled bool DEFAULT false NOT NULL,
    completeness_loop_graph_enabled bool DEFAULT false NOT NULL,
    is_active bool DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ai_llm_profile_pkey PRIMARY KEY (id),
    CONSTRAINT ai_llm_profile_code_key UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_ai_llm_profile_active ON ai_llm_profile USING btree (is_active);
