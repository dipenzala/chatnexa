-- ============================================================
-- ChatNexa AI Growth + SEO + Personalization
-- ============================================================

-- Upsell suggestions log
CREATE TABLE IF NOT EXISTS upsell_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  product_name TEXT,
  message TEXT NOT NULL,
  confidence INTEGER DEFAULT 50,
  accepted BOOLEAN DEFAULT FALSE,
  sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_upsell_org ON upsell_suggestions (org_id, created_at DESC);

-- Churn predictions
CREATE TABLE IF NOT EXISTS churn_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  risk_score INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  last_order_at TIMESTAMPTZ,
  days_since_last_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, contact_id)
);
CREATE INDEX IF NOT EXISTS idx_churn_org ON churn_predictions (org_id, risk_score DESC);

-- Revenue forecasts
CREATE TABLE IF NOT EXISTS revenue_forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  predicted_revenue NUMERIC(12,2) NOT NULL,
  confidence INTEGER DEFAULT 70,
  pipeline_value NUMERIC(12,2) DEFAULT 0,
  deal_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_forecast_org ON revenue_forecasts (org_id, period_start DESC);

-- SEO content
CREATE TABLE IF NOT EXISTS seo_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL, -- bio|product|hashtag|adcopy|blog|description
  prompt TEXT,
  output TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seo_org ON seo_content (org_id, created_at DESC);
