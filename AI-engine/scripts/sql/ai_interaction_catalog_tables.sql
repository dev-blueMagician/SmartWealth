-- Add catalog tables to an existing database (idempotent).
-- Full schema reference: scripts/sql/smartwealth.sql

CREATE TABLE IF NOT EXISTS case_phase (
    phase_code varchar(50) NOT NULL,
    display_name varchar(200) NOT NULL,
    sort_order int4 DEFAULT 0 NOT NULL,
    enabled bool DEFAULT true NOT NULL,
    catalog_version varchar(16) DEFAULT '1'::character varying NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT case_phase_pkey PRIMARY KEY (phase_code)
);

CREATE TABLE IF NOT EXISTS ai_interaction (
    interaction_id varchar(64) NOT NULL,
    phase_code varchar(50) NOT NULL,
    loop_input jsonb DEFAULT '{}'::jsonb NOT NULL,
    system_prompt text NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ai_interaction_pkey PRIMARY KEY (interaction_id),
    CONSTRAINT ai_interaction_phase_code_fkey FOREIGN KEY (phase_code) REFERENCES case_phase (phase_code) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_ai_interaction_phase_code ON ai_interaction USING btree (phase_code);

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
