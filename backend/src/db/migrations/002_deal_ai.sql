-- ============================================================
-- ChatNexa Deal AI migration
-- ============================================================

-- Deal scoring on conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deal_score INTEGER DEFAULT 0;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deal_stage TEXT DEFAULT 'cold';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deal_signals JSONB DEFAULT '{}'::jsonb;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deal_reason TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deal_updated_at TIMESTAMPTZ;

-- Pipeline (Kanban)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'new';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pipeline_value NUMERIC(12,2);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS expected_close_date DATE;

-- Message-level sentiment
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sentiment TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS intent TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS emotion_score INTEGER;

-- Follow-up sequences
CREATE TABLE IF NOT EXISTS followup_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_stage TEXT NOT NULL DEFAULT 'warm',
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seq_org ON followup_sequences (org_id, is_active);

CREATE TABLE IF NOT EXISTS followup_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES followup_sequences(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_message_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fq_due ON followup_queue (status, scheduled_at) WHERE status = 'pending';

-- NBA suggestions log
CREATE TABLE IF NOT EXISTS nba_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  confidence INTEGER DEFAULT 50,
  reasoning TEXT,
  accepted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nba_conv ON nba_suggestions (conversation_id, created_at DESC);

-- Objection log
CREATE TABLE IF NOT EXISTS objection_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  objection_type TEXT NOT NULL,
  response_used TEXT,
  outcome TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default follow-up sequences for every existing org
INSERT INTO followup_sequences (org_id, name, trigger_stage, steps, is_active)
SELECT id, 'Warm Lead Nudge', 'warm',
  '[
    {"delay_hours": 2,  "prompt": "Gentle reminder about the last enquiry. Reference their specific question."},
    {"delay_hours": 24, "prompt": "Re-confirm offer validity and ask if they have any doubts."},
    {"delay_hours": 72, "prompt": "Share a case study or testimonial relevant to their need."}
  ]'::jsonb, TRUE
FROM organizations
WHERE NOT EXISTS (SELECT 1 FROM followup_sequences WHERE org_id = organizations.id);
