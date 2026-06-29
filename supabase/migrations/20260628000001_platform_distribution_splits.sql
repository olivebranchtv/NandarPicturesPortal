-- Add per-platform distribution split support
-- Strategy: NULL platform = global default, non-NULL platform = override

-- 1. Drop the single-column unique constraint (was enforced as a unique index)
ALTER TABLE title_distribution_settings
  DROP CONSTRAINT IF EXISTS title_distribution_settings_title_id_key;

-- 2. Add platform column (NULL = global default)
ALTER TABLE title_distribution_settings
  ADD COLUMN IF NOT EXISTS platform text;

-- 3. Partial unique index for global default rows (platform IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS title_dist_settings_global_unique
  ON title_distribution_settings (title_id)
  WHERE platform IS NULL;

-- 4. Partial unique index for per-platform override rows
CREATE UNIQUE INDEX IF NOT EXISTS title_dist_settings_platform_unique
  ON title_distribution_settings (title_id, platform)
  WHERE platform IS NOT NULL;
