ALTER TABLE chunks
  ADD COLUMN IF NOT EXISTS flagged_patterns TEXT[];
