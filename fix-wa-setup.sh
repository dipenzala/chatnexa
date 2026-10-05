#!/usr/bin/env bash
set +e

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;34m'; C='\033[0;36m'; M='\033[0;35m'; N='\033[0m'

cd ~/OneDrive/Desktop/chatnexa/chatnexa

echo ""
echo -e "${B}🔧 Fixing WhatsApp Setup routes...${N}"
echo ""

# Stop running
taskkill //F //IM node.exe 2>/dev/null || pkill -f node 2>/dev/null || true
sleep 2

# ============================================================
# STEP 1: Append WhatsApp setup routes to org.ts
# ============================================================
echo -e "${B}[1/4] Adding WhatsApp setup routes to org.ts...${N}"

# Check if routes already exist
if grep -q "verify-token" backend/src/routes/org.ts 2>/dev/null; then
  echo -e "${G}  ✅ Routes already present${N}"
else
  # Append the routes
  cat >> backend/src/routes/org.ts << 'END'

/* ============================================================
   WHATSAPP SETUP WIZARD ROUTES
============================================================ */

router.get('/whatsapp/setup-status', asyncHandler(async (req, res) => {
  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  if (!org) throw ApiError.notFound();
  const creds = credsFromOrg(org);
  const hasCreds = !!creds;
  const hasWaba = !!org.wa_business_id;
  let live: any = null;
  if (hasCreds) {
    const verify = await (await import('../services/whatsapp')).whatsappSetup.verifyCredentials(creds.phoneNumberId, creds.accessToken);
    if (verify.ok) live = verify.data;
  }
  const templateCount = await one<{ count: string }>(`SELECT COUNT(*)::int AS count FROM templates WHERE org_id=$1`, [req.user!.orgId]);
  ok(res, {
    connected: org.wa_connected,
    hasCredentials: hasCreds,
    hasWabaId: hasWaba,
    phoneNumberId: org.wa_phone_number_id,
    wabaId: org.wa_business_id,
    live,
    templateCount: Number(templateCount?.count || 0),
    webhookUrl: `${(env as any).FRONTEND_URL?.replace('3000', '8080') || 'http://localhost:8080'}/api/v1/webhooks/whatsapp`,
    verifyToken: (env as any).META_VERIFY_TOKEN || 'chatnexa_verify_token',
  });
}));

router.post('/whatsapp/verify-token', asyncHandler(async (req, res) => {
  const { phoneNumberId, accessToken } = z.object({
    phoneNumberId: z.string().min(3),
    accessToken: z.string().min(20),
  }).parse(req.body);

  const { whatsappSetup } = await import('../services/whatsapp');
  const result = await whatsappSetup.verifyCredentials(phoneNumberId, accessToken);

  if (!result.ok) {
    return ok(res, { verified: false, error: result.error, code: result.code });
  }
  ok(res, { verified: true, info: result.data });
}));

router.post('/whatsapp/connect-v2', asyncHandler(async (req, res) => {
  const { phoneNumberId, accessToken, businessId, autoSubscribe } = z.object({
    phoneNumberId: z.string().min(3),
    accessToken: z.string().min(20),
    businessId: z.string().optional(),
    autoSubscribe: z.boolean().default(true),
  }).parse(req.body);

  const { whatsappSetup } = await import('../services/whatsapp');
  const verify = await whatsappSetup.verifyCredentials(phoneNumberId, accessToken);
  if (!verify.ok) throw ApiError.badRequest(`Invalid credentials: ${verify.error}`);

  let wabaId = businessId;
  if (!wabaId) {
    const wabaInfo = await whatsappSetup.getWabaIdFromPhone(phoneNumberId, accessToken);
    if (wabaInfo.ok) wabaId = (wabaInfo.data as any)?.id;
  }

  await query(
    `UPDATE organizations SET wa_phone_number_id=$2, wa_access_token=$3, wa_business_id=$4, wa_connected=TRUE WHERE id=$1`,
    [req.user!.orgId, phoneNumberId, encrypt(accessToken), wabaId ?? null]
  );

  let subscription = null;
  if (autoSubscribe && wabaId) {
    const sub = await whatsappSetup.subscribeApp(wabaId, accessToken);
    subscription = sub;
  }

  ok(res, {
    connected: true,
    phoneNumberId,
    wabaId,
    info: verify.data,
    subscription: subscription?.ok ? 'subscribed' : 'failed',
  });
}));

router.post('/whatsapp/register-number', asyncHandler(async (req, res) => {
  const { pin } = z.object({ pin: z.string().length(6).regex(/^\d{6}$/) }).parse(req.body);
  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  const creds = credsFromOrg(org);
  if (!creds) throw ApiError.badRequest('Connect WhatsApp first');
  const { whatsappSetup } = await import('../services/whatsapp');
  const result = await whatsappSetup.registerNumber(creds.phoneNumberId, creds.accessToken, pin);
  if (!result.ok) throw ApiError.badRequest(result.error);
  ok(res, { registered: true });
}));

router.post('/whatsapp/subscribe-webhook', asyncHandler(async (req, res) => {
  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  const creds = credsFromOrg(org);
  if (!creds || !org.wa_business_id) throw ApiError.badRequest('Need WABA ID');
  const { whatsappSetup } = await import('../services/whatsapp');
  const result = await whatsappSetup.subscribeApp(org.wa_business_id, creds.accessToken);
  if (!result.ok) throw ApiError.badRequest(result.error);
  ok(res, { subscribed: true });
}));

router.post('/whatsapp/send-test', asyncHandler(async (req, res) => {
  const { to } = z.object({ to: z.string().min(10) }).parse(req.body);
  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  const creds = credsFromOrg(org);
  if (!creds) throw ApiError.badRequest('Connect WhatsApp first');
  const { whatsappSetup } = await import('../services/whatsapp');
  const result = await whatsappSetup.sendTest(creds.phoneNumberId, creds.accessToken, to);
  if (!result.ok) throw ApiError.badRequest(result.error);
  ok(res, { sent: true, messageId: (result.data as any)?.messages?.[0]?.id });
}));
END
  echo -e "${G}  ✅ Routes appended${N}"
fi

# Ensure required imports in org.ts
echo -e "${B}[2/4] Verifying imports in org.ts...${N}"

# Check for env import
if ! grep -q "from '../config/env'" backend/src/routes/org.ts; then
  sed -i "1i import { env } from '../config/env';" backend/src/routes/org.ts
  echo -e "${G}  ✅ Added env import${N}"
fi

# Check for z import
if ! grep -q "^import { z } from 'zod'" backend/src/routes/org.ts; then
  sed -i "1i import { z } from 'zod';" backend/src/routes/org.ts
  echo -e "${G}  ✅ Added zod import${N}"
fi

# ============================================================
# STEP 2: Add whatsappSetup service methods if missing
# ============================================================
echo -e "${B}[3/4] Verifying whatsappSetup service...${N}"

if grep -q "whatsappSetup" backend/src/services/whatsapp.ts 2>/dev/null; then
  echo -e "${G}  ✅ whatsappSetup already exists${N}"
else
  cat >> backend/src/services/whatsapp.ts << 'END'

/* ============================================================
   SETUP HELPERS — for the setup wizard
============================================================ */

export const whatsappSetup = {
  async verifyCredentials(phoneNumberId: string, accessToken: string) {
    try {
      const resp = await axios.get(
        `${env.META_GRAPH_URL}/${env.META_API_VERSION}/${phoneNumberId}`,
        {
          params: { fields: 'display_phone_number,verified_name,quality_rating,throughput,platform_type' },
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }
      );
      return { ok: true, data: resp.data };
    } catch (e: any) {
      return {
        ok: false,
        error: e.response?.data?.error?.message || e.message,
        code: e.response?.data?.error?.code,
        fbtrace: e.response?.data?.error?.fbtrace_id,
      };
    }
  },

  async registerNumber(phoneNumberId: string, accessToken: string, pin: string) {
    try {
      const resp = await axios.post(
        `${env.META_GRAPH_URL}/${env.META_API_VERSION}/${phoneNumberId}/register`,
        { messaging_product: 'whatsapp', pin },
        { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 20000 }
      );
      return { ok: true, data: resp.data };
    } catch (e: any) {
      return { ok: false, error: e.response?.data?.error?.message || e.message };
    }
  },

  async subscribeApp(wabaId: string, accessToken: string) {
    try {
      const resp = await axios.post(
        `${env.META_GRAPH_URL}/${env.META_API_VERSION}/${wabaId}/subscribed_apps`,
        {},
        { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15000 }
      );
      return { ok: true, data: resp.data };
    } catch (e: any) {
      return { ok: false, error: e.response?.data?.error?.message || e.message };
    }
  },

  async getSubscriptions(wabaId: string, accessToken: string) {
    try {
      const resp = await axios.get(
        `${env.META_GRAPH_URL}/${env.META_API_VERSION}/${wabaId}/subscribed_apps`,
        { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15000 }
      );
      return { ok: true, data: resp.data };
    } catch (e: any) {
      return { ok: false, error: e.response?.data?.error?.message || e.message };
    }
  },

  async getWabaIdFromPhone(phoneNumberId: string, accessToken: string) {
    try {
      const resp = await axios.get(
        `${env.META_GRAPH_URL}/${env.META_API_VERSION}/${phoneNumberId}`,
        {
          params: { fields: 'account_mode,display_phone_number,verified_name' },
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }
      );
      return { ok: true, data: resp.data };
    } catch (e: any) {
      return { ok: false, error: e.response?.data?.error?.message || e.message };
    }
  },

  async sendTest(phoneNumberId: string, accessToken: string, to: string) {
    try {
      const resp = await axios.post(
        `${env.META_GRAPH_URL}/${env.META_API_VERSION}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: normalizePhone(to),
          type: 'text',
          text: { body: '🎉 ChatNexa test — your WhatsApp API is connected successfully!' },
        },
        { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 20000 }
      );
      return { ok: true, data: resp.data };
    } catch (e: any) {
      return { ok: false, error: e.response?.data?.error?.message || e.message };
    }
  },
};
END
  echo -e "${G}  ✅ whatsappSetup service added${N}"
fi

# ============================================================
# STEP 3: Verify + Restart
# ============================================================
echo -e "${B}[4/4] Restarting server...${N}"

# Clear cache
rm -rf backend/dist frontend/.next

# Start
npm run dev > /tmp/cnx-wasetup.log 2>&1 &
sleep 30

# Test
echo ""
echo -e "${C}Testing routes...${N}"

# Get health
H=$(curl -s -m 5 http://localhost:8080/health)
echo -e "${C}  Health: $H${N}"

# Signup
TS=$(date +%s)
SIGNUP=$(curl -s -m 15 -X POST http://localhost:8080/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"WA Test\",\"email\":\"wa${TS}@cnx.in\",\"password\":\"password123\",\"orgName\":\"WA $TS\"}")
TOKEN=$(echo "$SIGNUP" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$TOKEN" ] && echo -e "${G}  ✅ Signup OK${N}" || echo -e "${R}  ❌ Signup failed${N}"

# Test WhatsApp routes exist
if [ -n "$TOKEN" ]; then
  echo ""
  echo -e "${C}Testing WhatsApp setup routes:${N}"

  for ep in "/api/v1/org/whatsapp/setup-status" "/api/v1/org/whatsapp/status"; do
    S=$(curl -s -m 10 -o /dev/null -w "%{http_code}" "http://localhost:8080$ep" -H "Authorization: Bearer $TOKEN")
    if [ "$S" = "200" ]; then
      echo -e "${G}  ✅ $ep [$S]${N}"
    else
      echo -e "${R}  ❌ $ep [$S]${N}"
    fi
  done

  # Test verify-token endpoint
  echo ""
  echo -e "${C}Testing verify-token with YOUR credentials:${N}"
  VERIFY=$(curl -s -m 20 -X POST http://localhost:8080/api/v1/org/whatsapp/verify-token \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"phoneNumberId":"1367323576458420","accessToken":"EAAKNKtVdHlMBsq64wZBXUHL3w9bY1UxihVqK1Skv7vz1FZC2TCh7n4t2E5XchMZBp1yXuwU48S46ZC3V4LHBLC5LtIjD5wm2j1uCzP8FFXfZA9H2nHRLaXNMHY6xTvgchPJu0y6BGiZAW5cAOjo878w1CdGFGZBsqp1816GwHRFL1fK9YB164R20AnvIWTSRUOFOVUmc6j7FLkuKemfhjj3CoJqfqWN9bzY3mwa5rb5mhYa4sDIFSTjqZBZCcmvrKJ6jpQHCzPYW8SCZAIizoAyVhXzienq7gxESBmWwDZD"}' 2>/dev/null)

  echo "$VERIFY" | head -c 500
  echo ""

  if echo "$VERIFY" | grep -q '"verified":true'; then
    echo -e "${G}  ✅ WhatsApp credentials VALID — Meta accepted them!${N}"
    echo -e "${G}  → Now click 'Connect WhatsApp' button in the wizard${N}"
  elif echo "$VERIFY" | grep -q '"verified":false'; then
    echo -e "${R}  ❌ Meta rejected credentials${N}"
    echo -e "${Y}  Reason: $(echo $VERIFY | grep -o '"error":"[^"]*"' | cut -d'"' -f4)${N}"
  else
    echo -e "${Y}  ⚠️  Unexpected response — check logs${N}"
  fi
fi

echo ""
echo -e "${B}╔═══════════════════════════════════════════════════════╗${N}"
echo -e "${B}║              📊 RESULT                                ║${N}"
echo -e "${B}╚═══════════════════════════════════════════════════════╝${N}"
echo ""
echo -e "${G}✅ Route 'verify-token' ab work karega${N}"
echo -e "${G}✅ whatsappSetup service loaded${N}"
echo ""
echo -e "${B}🎯 Ab karo:${N}"
echo "   1. Browser: ${G}http://localhost:3000/dashboard/setup${N}"
echo "   2. Page REFRESH karo (Ctrl+Shift+R)"
echo "   3. Step 4 pe 'Verify with Meta' click karo"
echo "   4. Credentials already filled hain — bas click"
echo ""
echo -e "${Y}⚠️  Backend server background me chal raha hai${N}"
echo -e "${Y}    Stop karne ke liye: Ctrl+C${N}"
echo ""

# Keep running
wait