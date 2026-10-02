-- ============================================================
-- ChatNexa Client Love Migration
-- ============================================================

-- Extend contacts with birthday + anniversary + notes
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS anniversary DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_review_requested_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS total_spent NUMERIC(12,2) DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Referrals
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  referrer_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  referred_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|signed_up|converted|paid
  reward_amount NUMERIC(10,2) DEFAULT 0,
  reward_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_referrals_org ON referrals (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals (referral_code);

-- Auto-greetings (birthday/festival/anniversary) log
CREATE TABLE IF NOT EXISTS greeting_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  greeting_type TEXT NOT NULL, -- birthday|anniversary|festival
  festival_name TEXT,
  message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  wa_message_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_greeting_org ON greeting_log (org_id, sent_at DESC);

-- Notification settings
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notify_email BOOLEAN DEFAULT TRUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notify_birthdays BOOLEAN DEFAULT TRUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notify_low_balance BOOLEAN DEFAULT TRUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notify_new_leads BOOLEAN DEFAULT TRUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS google_review_url TEXT;

-- Default follow-up for birthday
INSERT INTO followup_sequences (org_id, name, trigger_stage, steps, is_active)
SELECT id, 'Birthday Wish', 'warm',
  '[{"delay_hours": 1, "prompt": "Send a warm birthday wish with a small discount offer."}]'::jsonb, TRUE
FROM organizations
WHERE NOT EXISTS (SELECT 1 FROM followup_sequences WHERE org_id = organizations.id AND name = 'Birthday Wish');
