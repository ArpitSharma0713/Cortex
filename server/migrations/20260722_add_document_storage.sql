ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_key VARCHAR(500);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sha256_hash VARCHAR(64);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_workspace_hash
  ON documents(workspace_id, sha256_hash)
  WHERE deleted_at IS NULL;
