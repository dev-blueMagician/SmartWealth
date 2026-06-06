-- recommendation must have a single FK column (plan_version_id) matching JPA.
-- Hibernate ddl-auto can leave both plan_id and plan_version_id NOT NULL; inserts then fail.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'recommendation'
      AND column_name = 'plan_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'recommendation'
      AND column_name = 'plan_version_id'
  ) THEN
    UPDATE recommendation SET plan_version_id = COALESCE(plan_version_id, plan_id);
    ALTER TABLE recommendation DROP COLUMN plan_id;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'recommendation'
      AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE recommendation RENAME COLUMN plan_id TO plan_version_id;
  END IF;
END $$;
