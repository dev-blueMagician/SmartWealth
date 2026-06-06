-- Hibernate ddl-auto once added duplicate columns from raw CSV headers (empty). Keep Flyway schema only.
ALTER TABLE field_dictionary
  DROP COLUMN IF EXISTS "Row No.",
  DROP COLUMN IF EXISTS "Data Domain",
  DROP COLUMN IF EXISTS "Data Item",
  DROP COLUMN IF EXISTS "Detail Field Group",
  DROP COLUMN IF EXISTS "Detail Field No.",
  DROP COLUMN IF EXISTS "Detail Field Name",
  DROP COLUMN IF EXISTS "System Field Name",
  DROP COLUMN IF EXISTS "Field Description",
  DROP COLUMN IF EXISTS "Data Type",
  DROP COLUMN IF EXISTS "Mandatory Level",
  DROP COLUMN IF EXISTS "Applies To",
  DROP COLUMN IF EXISTS "Suggested Source",
  DROP COLUMN IF EXISTS "Validation Rule",
  DROP COLUMN IF EXISTS "Used For",
  DROP COLUMN IF EXISTS "Update Frequency",
  DROP COLUMN IF EXISTS "Missing Data Action",
  DROP COLUMN IF EXISTS "Example Value";
