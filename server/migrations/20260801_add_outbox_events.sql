CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL
    CHECK (event_type IN ('chunks_embedded', 'document_deleted')),
  document_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(status);
CREATE INDEX IF NOT EXISTS idx_outbox_created_at ON outbox_events(created_at);
