ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'active';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_notes TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS monthly_msg_limit INTEGER DEFAULT 10000;

CREATE TABLE IF NOT EXISTS client_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  marketing_count INTEGER DEFAULT 0,
  utility_count INTEGER DEFAULT 0,
  auth_count INTEGER DEFAULT 0,
  service_count INTEGER DEFAULT 0,
  ai_reply_count INTEGER DEFAULT 0,
  meta_cost NUMERIC(12,4) DEFAULT 0,
  client_charge NUMERIC(12,4) DEFAULT 0,
  our_profit NUMERIC(12,4) DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, month)
);

CREATE TABLE IF NOT EXISTS admin_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_org_id UUID,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requirement TEXT NOT NULL,
  category TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  generated_name TEXT,
  generated_body TEXT,
  generated_header TEXT,
  generated_footer TEXT,
  generated_buttons JSONB DEFAULT '[]'::jsonb,
  variables JSONB DEFAULT '[]'::jsonb,
  saved_as_template_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_test_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  status TEXT NOT NULL,
  message_id TEXT,
  error TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);
