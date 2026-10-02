-- ============================================================
-- ChatNexa Mega Features Migration
-- ============================================================

-- ============================================================
-- 1. RAG file uploads
-- ============================================================
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'text';
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_filename TEXT;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;

-- ============================================================
-- 2. Keyword Auto-Reply
-- ============================================================
CREATE TABLE IF NOT EXISTS keyword_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'contains', -- contains|exact|starts_with
  reply_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  hits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kwr_org ON keyword_replies (org_id, is_active);

-- ============================================================
-- 3. Sentiment alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS sentiment_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  severity TEXT NOT NULL, -- low|medium|high
  reason TEXT,
  message_id UUID,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sent_org ON sentiment_alerts (org_id, resolved, created_at DESC);

-- ============================================================
-- 4. A/B Tests
-- ============================================================
CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_a TEXT NOT NULL,
  template_b TEXT NOT NULL,
  split_pct INTEGER DEFAULT 50,
  status TEXT DEFAULT 'draft', -- draft|running|completed
  audience JSONB DEFAULT '{}'::jsonb,
  variant_a JSONB DEFAULT '{"sent":0,"delivered":0,"read":0,"replied":0}'::jsonb,
  variant_b JSONB DEFAULT '{"sent":0,"delivered":0,"read":0,"replied":0}'::jsonb,
  winner TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ab_org ON ab_tests (org_id, created_at DESC);

-- ============================================================
-- 5. Saved reply templates
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  shortcut TEXT,
  body TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  uses INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sr_org ON saved_replies (org_id, category);

-- ============================================================
-- 6. Agent performance tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  messages_sent INTEGER DEFAULT 0,
  conversations_handled INTEGER DEFAULT 0,
  avg_response_seconds INTEGER DEFAULT 0,
  deals_closed INTEGER DEFAULT 0,
  deals_value NUMERIC(12,2) DEFAULT 0,
  csat_score INTEGER,
  UNIQUE (org_id, user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_am_org ON agent_metrics (org_id, date DESC);

-- ============================================================
-- 7. Smart send time
-- ============================================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_send_hour INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata';

-- ============================================================
-- 8. Contact merge tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_merges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL,
  primary_contact_id UUID NOT NULL,
  merged_contact_ids UUID[] NOT NULL,
  merged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. Status broadcasts
-- ============================================================
CREATE TABLE IF NOT EXISTS status_broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  audience_tags TEXT[] DEFAULT '{}',
  recipient_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. Customer journey events
-- ============================================================
CREATE TABLE IF NOT EXISTS journey_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- message|order|payment|call|lead|note|tag
  title TEXT NOT NULL,
  description TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_je_contact ON journey_events (contact_id, created_at DESC);

-- ============================================================
-- 11. GST Invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS gst_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  payment_id UUID,
  amount NUMERIC(12,2) NOT NULL,
  tax_pct NUMERIC(4,2) DEFAULT 18,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL,
  gstin TEXT,
  place_of_supply TEXT,
  status TEXT DEFAULT 'draft', -- draft|sent|paid
  invoice_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gi_org ON gst_invoices (org_id, created_at DESC);

-- ============================================================
-- 12. Voice notes
-- ============================================================
CREATE TABLE IF NOT EXISTS voice_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL,
  contact_id UUID,
  text_content TEXT NOT NULL,
  audio_url TEXT,
  voice TEXT DEFAULT 'alloy',
  duration_seconds INTEGER,
  sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 13. WhatsApp Forms (simple)
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  submit_message TEXT DEFAULT 'Thanks for your details! We will be in touch.',
  auto_create_lead BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  submissions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wf_org ON wa_forms (org_id, is_active);

CREATE TABLE IF NOT EXISTS wa_form_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID NOT NULL REFERENCES wa_forms(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  contact_id UUID,
  phone TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 14. IVR outbound calls
-- ============================================================
CREATE TABLE IF NOT EXISTS outbound_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL,
  contact_id UUID,
  phone TEXT NOT NULL,
  purpose TEXT,
  status TEXT DEFAULT 'queued', -- queued|calling|completed|failed|no_answer
  exotel_call_id TEXT,
  duration_sec INTEGER,
  outcome TEXT,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oc_org ON outbound_calls (org_id, status, created_at DESC);

-- ============================================================
-- 15. Hindi UI preferences
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_language TEXT DEFAULT 'en';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS gstin TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_tax_pct NUMERIC(4,2) DEFAULT 18;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'INV';

-- ============================================================
-- 16. Broadcast preview log
-- ============================================================
CREATE TABLE IF NOT EXISTS broadcast_previews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL,
  template_id UUID,
  contact_id UUID,
  rendered_body TEXT,
  rendered_header TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
