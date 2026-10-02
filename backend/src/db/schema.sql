CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_email TEXT,
  plan TEXT NOT NULL DEFAULT 'payg',
  wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 100,
  wa_phone_number_id TEXT,
  wa_business_id TEXT,
  wa_access_token TEXT,
  wa_verify_token TEXT,
  wa_connected BOOLEAN NOT NULL DEFAULT FALSE,
  meta_page_id TEXT,
  meta_page_token TEXT,
  ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ai_system_prompt TEXT DEFAULT 'You are a helpful, concise WhatsApp assistant for an Indian business. Reply in the customer''s language (English/Hindi/Hinglish). Keep replies under 60 words.',
  exotel_number TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'owner',
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, email)
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT DEFAULT '',
  email TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT DEFAULT 'manual',
  opt_in BOOLEAN NOT NULL DEFAULT TRUE,
  blocked BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN (tags);

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'MARKETING',
  language TEXT NOT NULL DEFAULT 'en',
  header_type TEXT,
  header_text TEXT,
  header_media_url TEXT,
  body TEXT NOT NULL,
  footer TEXT,
  buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
  variables TEXT[] NOT NULL DEFAULT '{}',
  meta_template_id TEXT,
  meta_status TEXT DEFAULT 'DRAFT',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_templates_org ON templates (org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open',
  ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_message TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, contact_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_org ON conversations (org_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  wa_message_id TEXT,
  type TEXT NOT NULL DEFAULT 'text',
  body TEXT,
  media_url TEXT,
  media_mime TEXT,
  template_name TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  cost NUMERIC(10,4) NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_org ON messages (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_wa ON messages (wa_message_id);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  template_name TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  delivered INTEGER NOT NULL DEFAULT 0,
  read_count INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_org ON campaigns (org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  wa_message_id TEXT,
  sent_at TIMESTAMPTZ,
  UNIQUE (campaign_id, contact_id)
);
CREATE INDEX IF NOT EXISTS idx_recipients_campaign ON campaign_recipients (campaign_id, status);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'meta_ads',
  external_id TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  city TEXT,
  form_name TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'new',
  score INTEGER NOT NULL DEFAULT 0,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leads_org ON leads (org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_url TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_org ON knowledge_base (org_id);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  short_url TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments (org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC(12,4) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'message',
  description TEXT,
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallet_org ON wallet_transactions (org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ivr_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  exotel_call_id TEXT,
  direction TEXT NOT NULL DEFAULT 'inbound',
  from_number TEXT,
  to_number TEXT,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  recording_url TEXT,
  transcript TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'default',
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_updated ON organizations;
CREATE TRIGGER trg_org_updated BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tpl_updated ON templates;
CREATE TRIGGER trg_tpl_updated BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION match_knowledge(p_org_id UUID, p_embedding vector(1536), p_limit INT DEFAULT 5)
RETURNS TABLE (id UUID, title TEXT, content TEXT, similarity FLOAT) AS $$
  SELECT id, title, content, 1 - (embedding <=> p_embedding) AS similarity
  FROM knowledge_base
  WHERE org_id = p_org_id AND embedding IS NOT NULL
  ORDER BY embedding <=> p_embedding
  LIMIT p_limit;
$$ LANGUAGE sql STABLE;
