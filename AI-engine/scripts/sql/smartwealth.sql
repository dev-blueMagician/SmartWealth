-- DROP SCHEMA smartwealth;

CREATE SCHEMA smartwealth AUTHORIZATION "ducnv3.gfs";
-- smartwealth.audit_event definition

CREATE TABLE audit_event ( id uuid DEFAULT gen_random_uuid() NOT NULL, entity varchar(100) NOT NULL, "action" varchar(100) NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT audit_event_pkey PRIMARY KEY (id));

-- smartwealth.client definition

CREATE TABLE client ( id uuid NOT NULL, created_at timestamp(6) NOT NULL, "name" varchar(255) NULL, residency varchar(50) NULL, risk_profile varchar(50) NULL, status varchar(50) NOT NULL, CONSTRAINT client_pkey PRIMARY KEY (id));


-- smartwealth.orchestration_request definition

CREATE TABLE orchestration_request ( request_id uuid NOT NULL, workflow_id uuid NOT NULL, user_id uuid NOT NULL, correlation_id varchar(100) NOT NULL, input_text text NOT NULL, input_language varchar(16) NOT NULL, source_channel varchar(50) NOT NULL, priority int4 DEFAULT 1 NOT NULL, requested_at timestamptz NOT NULL, confidence_threshold numeric(4, 3) NOT NULL, human_approval_required bool DEFAULT false NOT NULL, ssot_record_id uuid NOT NULL, ssot_record_type varchar(50) NOT NULL, ssot_record_version varchar(50) NOT NULL, ssot_correlation_id varchar(100) NOT NULL, ssot_snapshot_id uuid NOT NULL, environment varchar(30) DEFAULT 'dev'::character varying NOT NULL, feature_flags jsonb DEFAULT '{}'::jsonb NOT NULL, session_id varchar(100) NOT NULL, current_step varchar(100) NOT NULL, attempt_count int4 DEFAULT 1 NOT NULL, previous_result_ids jsonb DEFAULT '[]'::jsonb NOT NULL, escalation_required bool DEFAULT false NOT NULL, human_approval_status varchar(30) NOT NULL, human_approver_id uuid NULL, human_approval_at timestamptz NULL, variables jsonb DEFAULT '{}'::jsonb NOT NULL, context_updated_at timestamptz DEFAULT now() NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, assessment_code varchar(64) DEFAULT 'onboarding_completeness'::character varying NOT NULL, CONSTRAINT orchestration_request_attempt_count_check CHECK ((attempt_count >= 0)), CONSTRAINT orchestration_request_confidence_threshold_check CHECK (((confidence_threshold >= (0)::numeric) AND (confidence_threshold <= (1)::numeric))), CONSTRAINT orchestration_request_pkey PRIMARY KEY (request_id));


-- smartwealth.workflow_ai_trigger definition
CREATE TABLE workflow_ai_trigger ( trigger_id uuid DEFAULT gen_random_uuid() NOT NULL, to_state varchar(100) NOT NULL, assessment_code varchar(32) NOT NULL, enabled bool DEFAULT true NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT workflow_ai_trigger_pkey PRIMARY KEY (trigger_id), CONSTRAINT workflow_ai_trigger_to_state_assessment_code_key UNIQUE (to_state, assessment_code));


-- Journey phase (parent) + AI interaction catalog (runtime SSOT; seed via scripts/seed_ai_interaction_catalog.py from catalog_seed.py).

CREATE TABLE case_phase (
    phase_code varchar(50) NOT NULL,
    display_name varchar(200) NOT NULL,
    sort_order int4 DEFAULT 0 NOT NULL,
    enabled bool DEFAULT true NOT NULL,
    catalog_version varchar(16) DEFAULT '1'::character varying NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT case_phase_pkey PRIMARY KEY (phase_code)
);

CREATE TABLE ai_interaction (
    interaction_id varchar(64) NOT NULL,
    phase_code varchar(50) NOT NULL,
    loop_input jsonb DEFAULT '{}'::jsonb NOT NULL,
    system_prompt text NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ai_interaction_pkey PRIMARY KEY (interaction_id),
    CONSTRAINT ai_interaction_phase_code_fkey FOREIGN KEY (phase_code) REFERENCES case_phase (phase_code) ON DELETE RESTRICT
);

CREATE INDEX idx_ai_interaction_phase_code ON ai_interaction USING btree (phase_code);


-- Active LLM provider profile for AI-engine (optional API keys; restrict DB access in production).

CREATE TABLE ai_llm_profile (
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

CREATE INDEX idx_ai_llm_profile_active ON ai_llm_profile USING btree (is_active);


-- smartwealth.workflow_event definition


-- smartwealth.ai_result definition
CREATE TABLE ai_result ( result_id uuid NOT NULL, workflow_event_id uuid NULL, request_id uuid NOT NULL, step_name varchar(200) NOT NULL, provider varchar(100) NOT NULL, model varchar(200) NOT NULL, output_text text NOT NULL, confidence_score numeric(5, 4) NOT NULL, confidence_threshold numeric(5, 4) NOT NULL, decision varchar(32) NOT NULL, decision_reason text NOT NULL, latency_ms int4 NOT NULL, input_tokens int4 NOT NULL, output_tokens int4 NOT NULL, produced_at timestamptz NOT NULL, trace_id varchar(100) NOT NULL, safety_flagged bool NOT NULL, safety_category varchar(64) NOT NULL, human_approval_required bool NOT NULL, human_approval_status varchar(32) NOT NULL, approved_by_user_id uuid NULL, approved_at timestamptz NULL, ssot_record_id uuid NOT NULL, ssot_record_type varchar(50) NOT NULL, ssot_record_version varchar(50) NOT NULL, ssot_snapshot_id uuid NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT ai_result_pkey PRIMARY KEY (result_id), CONSTRAINT ai_result_request_id_fkey FOREIGN KEY (request_id) REFERENCES orchestration_request(request_id) ON DELETE CASCADE, CONSTRAINT ai_result_workflow_event_id_fkey FOREIGN KEY (workflow_event_id) REFERENCES workflow_event(event_id) ON DELETE SET NULL);

-- smartwealth.asset definition
CREATE TABLE asset ( id uuid DEFAULT gen_random_uuid() NOT NULL, client_id uuid NOT NULL, asset_type varchar(100) NOT NULL, value numeric(18, 2) NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT asset_pkey PRIMARY KEY (id), CONSTRAINT fkeo1htwntsr6arlxo8s7vh4otl FOREIGN KEY (client_id) REFERENCES client(id));



-- smartwealth."case" definition

CREATE TABLE "case" ( id uuid DEFAULT gen_random_uuid() NOT NULL, client_id uuid NOT NULL, "type" varchar(100) NOT NULL, phase varchar(50) NOT NULL, status varchar(50) NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT case_pkey PRIMARY KEY (id), CONSTRAINT fkcf2sh599ydnk3v9fn5qsyprsl FOREIGN KEY (client_id) REFERENCES client(id));

-- smartwealth.workflow_state definition
CREATE TABLE workflow_state ( workflow_id varchar(64) NOT NULL, case_id uuid NULL, status varchar(50) NOT NULL, input_payload jsonb NOT NULL DEFAULT '{}'::jsonb, ai_draft jsonb NULL, human_decision jsonb NULL, version int4 NOT NULL, updated_at timestamptz NOT NULL, CONSTRAINT workflow_state_pkey PRIMARY KEY (workflow_id), CONSTRAINT workflow_state_case_id_fkey FOREIGN KEY (case_id) REFERENCES "case"(id) ON DELETE SET NULL);


-- smartwealth.financial_plan definition
CREATE TABLE financial_plan ( id uuid DEFAULT gen_random_uuid() NOT NULL, client_id uuid NOT NULL, status varchar(50) NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, is_approved bool NOT NULL, "content" jsonb NULL, version_no int4 NOT NULL, CONSTRAINT financial_plan_pkey PRIMARY KEY (id), CONSTRAINT fkliuhrd9rqj4064xovtd3i339i FOREIGN KEY (client_id) REFERENCES client(id));


-- smartwealth.goal definition

CREATE TABLE goal ( id uuid DEFAULT gen_random_uuid() NOT NULL, client_id uuid NOT NULL, goal_type varchar(100) NOT NULL, target_amount numeric(18, 2) NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT goal_pkey PRIMARY KEY (id), CONSTRAINT fky2moo29xd267drjkhpjlake FOREIGN KEY (client_id) REFERENCES client(id));


-- smartwealth.plan_version definition

CREATE TABLE plan_version ( id uuid DEFAULT gen_random_uuid() NOT NULL, plan_id uuid NOT NULL, version_no int4 NOT NULL, is_approved bool DEFAULT false NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT plan_version_pkey PRIMARY KEY (id), CONSTRAINT plan_version_plan_id_version_no_key UNIQUE (plan_id, version_no), CONSTRAINT plan_version_version_no_check CHECK ((version_no >= 1)), CONSTRAINT plan_version_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES financial_plan(id) ON DELETE CASCADE);

-- smartwealth.portfolio definition
CREATE TABLE portfolio ( id uuid DEFAULT gen_random_uuid() NOT NULL, client_id uuid NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT portfolio_pkey PRIMARY KEY (id), CONSTRAINT fkpxcrdn47gewbwxl04370f5ohc FOREIGN KEY (client_id) REFERENCES client(id));

-- smartwealth.portfolio_allocation definition

CREATE TABLE portfolio_allocation ( id uuid NOT NULL, asset_class varchar(50) NOT NULL, percentage numeric(5, 2) NOT NULL, portfolio_id uuid NOT NULL, CONSTRAINT portfolio_allocation_pkey PRIMARY KEY (id), CONSTRAINT fkj9lb15mora6arqde41e0t3e5 FOREIGN KEY (portfolio_id) REFERENCES portfolio(id));

-- smartwealth.recommendation definition

CREATE TABLE recommendation ( id uuid DEFAULT gen_random_uuid() NOT NULL, plan_version_id uuid NOT NULL, rec_type varchar(100) NOT NULL, summary text NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT recommendation_pkey PRIMARY KEY (id), CONSTRAINT fkg81mae6s64bil916um7oweipn FOREIGN KEY (plan_version_id) REFERENCES financial_plan(id));

-- smartwealth.task definition

CREATE TABLE task ( id uuid DEFAULT gen_random_uuid() NOT NULL, case_id uuid NOT NULL, task_type varchar(100) NOT NULL, status varchar(50) NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamp(6) NOT NULL, CONSTRAINT task_pkey PRIMARY KEY (id), CONSTRAINT task_case_id_fkey FOREIGN KEY (case_id) REFERENCES "case"(id) ON DELETE CASCADE);


-- smartwealth.ai_finding definition

CREATE TABLE ai_finding ( finding_id uuid DEFAULT gen_random_uuid() NOT NULL, result_id uuid NOT NULL, finding_kind varchar(64) NOT NULL, field_path varchar(200) NULL, detail text NULL, sort_order int4 DEFAULT 0 NOT NULL, CONSTRAINT ai_finding_pkey PRIMARY KEY (finding_id), CONSTRAINT ai_finding_result_id_fkey FOREIGN KEY (result_id) REFERENCES ai_result(result_id) ON DELETE CASCADE);


-- smartwealth.decision definition

CREATE TABLE decision ( id uuid DEFAULT gen_random_uuid() NOT NULL, recommendation_id uuid NOT NULL, decision_status varchar(50) NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, decided_at timestamp(6) NOT NULL, CONSTRAINT decision_pkey PRIMARY KEY (id), CONSTRAINT decision_recommendation_id_fkey FOREIGN KEY (recommendation_id) REFERENCES recommendation(id) ON DELETE CASCADE);

-- smartwealth.execution_instruction definition

CREATE TABLE execution_instruction ( id uuid NOT NULL, created_at timestamp(6) NOT NULL, payload jsonb NULL, status varchar(50) NOT NULL, updated_at timestamp(6) NOT NULL, recommendation_id uuid NOT NULL, CONSTRAINT execution_instruction_pkey PRIMARY KEY (id), CONSTRAINT fkdgv01m6vy1jmdpgtckyool2t3 FOREIGN KEY (recommendation_id) REFERENCES recommendation(id));

-- Portal identity (JWT staff users). Hibernate may also create/update these when ddl-auto=update.

CREATE TABLE IF NOT EXISTS app_role ( id uuid NOT NULL, code varchar(32) NOT NULL, CONSTRAINT app_role_pkey PRIMARY KEY (id), CONSTRAINT app_role_code_key UNIQUE (code));

CREATE TABLE IF NOT EXISTS app_user ( id uuid NOT NULL, username varchar(128) NOT NULL, password_hash varchar(255) NOT NULL, email varchar(255) NULL, enabled boolean NOT NULL DEFAULT true, client_id uuid NULL, CONSTRAINT app_user_pkey PRIMARY KEY (id), CONSTRAINT app_user_username_key UNIQUE (username), CONSTRAINT app_user_client_id_fkey FOREIGN KEY (client_id) REFERENCES client(id));

CREATE TABLE IF NOT EXISTS app_user_role ( user_id uuid NOT NULL, role_id uuid NOT NULL, CONSTRAINT app_user_role_pkey PRIMARY KEY (user_id, role_id), CONSTRAINT app_user_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES app_role(id), CONSTRAINT app_user_role_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_user(id));