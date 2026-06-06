-- Rename legacy ai_llm_profile boolean column to completeness_loop_graph_enabled.
-- Safe to run once on DBs that still have the old column name.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'ai_llm_profile'
          AND column_name = 'ai01_loop_graph_enabled'
    ) THEN
        ALTER TABLE ai_llm_profile RENAME COLUMN ai01_loop_graph_enabled TO completeness_loop_graph_enabled;
    END IF;
END $$;
