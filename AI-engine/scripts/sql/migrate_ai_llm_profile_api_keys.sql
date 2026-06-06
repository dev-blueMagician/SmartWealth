-- Optional API keys for LLM profiles (admin UI). Apply on existing DBs.

ALTER TABLE ai_llm_profile ADD COLUMN IF NOT EXISTS deepseek_api_key text NULL;
ALTER TABLE ai_llm_profile ADD COLUMN IF NOT EXISTS azure_openai_api_key text NULL;
