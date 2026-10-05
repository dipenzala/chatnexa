#!/usr/bin/env bash
set +e

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;34m'; C='\033[0;36m'; N='\033[0m'

cd ~/OneDrive/Desktop/chatnexa/chatnexa

echo ""
echo -e "${B}🔍 Diagnosing Route Issue...${N}"
echo ""

# STOP ALL
taskkill //F //IM node.exe 2>/dev/null || true
sleep 3
rm -rf backend/dist frontend/.next

# ============================================================
# CHECK 1: Is the route in org.ts?
# ============================================================
echo -e "${C}[CHECK 1] Is 'verify-token' in org.ts?${N}"
if grep -q "verify-token" backend/src/routes/org.ts; then
  echo -e "${G}  ✅ Route IS in file${N}"
else
  echo -e "${R}  ❌ Route NOT in file — adding now${N}"
  cat >> backend/src/routes/org.ts << 'END'

router.post('/whatsapp/verify-token', asyncHandler(async (req, res) => {
  const { phoneNumberId, accessToken } = z.object({
    phoneNumberId: z.string().min(3),
    accessToken: z.string().min(20),
  }).parse(req.body);

  const axios = (await import('axios')).default;
  const { env } = await import('../config/env');

  try {
    const resp = await axios.get(
      `https://graph.facebook.com/${env.META_API_VERSION}/${phoneNumberId}`,
      {
        params: { fields: 'display_phone_number,verified_name,quality_rating' },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      }
    );
    ok(res, { verified: true, info: resp.data });
  } catch (e: any) {
    ok(res, {
      verified: false,
      error: e.response?.data?.error?.message || e.message,
      code: e.response?.data?.error?.code,
    });
  }
}));
END
  echo -e "${G}  ✅ Route added${N}"
fi

# ============================================================
# CHECK 2: org.ts has required imports
# ============================================================
echo ""
echo -e "${C}[CHECK 2] Checking imports in org.ts...${N}"

if ! head -20 backend/src/routes/org.ts | grep -q "from 'zod'"; then
  echo -e "${Y}  Adding zod import...${N}"
  sed -i "1i import { z } from 'zod';" backend/src/routes/org.ts
fi

if ! head -20 backend/src/routes/org.ts | grep -q "asyncHandler"; then
  echo -e "${Y}  Checking asyncHandler import...${N}"
  grep -q "asyncHandler" backend/src/routes/org.ts || echo -e "${R}  ❌ asyncHandler missing!${N}"
fi

echo -e "${C}  First 10 lines of org.ts:${N}"
head -10 backend/src/routes/org.ts | sed 's/^/    /'

# ============================================================
# CHECK 3: Restart backend
# ============================================================
echo ""
echo -e "${C}[CHECK 3] Starting backend...${N}"
npm run dev > /tmp/cnx-force.log 2>&1 &

sleep 30

# Check if running
H=$(curl -s -m 5 http://localhost:8080/health 2>/dev/null)
if echo "$H" | grep -q '"ok":true'; then
  echo -e "${G}  ✅ Backend started${N}"
else
  echo -e "${R}  ❌ Backend not responding${N}"
  echo -e "${Y}  Last 20 log lines:${N}"
  tail -20 /tmp/cnx-force.log | sed 's/^/    /'
  exit 1
fi

# ============================================================
# CHECK 4: Actual route test
# ============================================================
echo ""
echo -e "${C}[CHECK 4] Testing route...${N}"

# Signup
TS=$(date +%s)
SIGNUP=$(curl -s -m 15 -X POST http://localhost:8080/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test\",\"email\":\"route${TS}@cnx.in\",\"password\":\"password123\",\"orgName\":\"Route $TS\"}")
TOKEN=$(echo "$SIGNUP" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${R}  ❌ Signup failed — backend maybe still starting${N}"
  echo "  Response: $SIGNUP" | head -c 300
  echo ""
  echo -e "${Y}  Wait 30s and try again${N}"
  exit 1
fi

echo -e "${G}  ✅ Signup works${N}"

# Test the route
echo ""
echo -e "${C}  Testing POST /api/v1/org/whatsapp/verify-token${N}"

RESP=$(curl -s -m 20 -X POST http://localhost:8080/api/v1/org/whatsapp/verify-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"phoneNumberId":"1367323576458420","accessToken":"test"}' 2>/dev/null)

echo -e "${C}  Response:${N}"
echo "  $RESP" | head -c 500
echo ""

if echo "$RESP" | grep -q "Route not found"; then
  echo -e "${R}  ❌ Route STILL not found${N}"
  echo ""
  echo -e "${Y}  DEBUG — checking backend logs for route registration:${N}"
  tail -50 /tmp/cnx-force.log | grep -i "route\|error\|org\|whatsapp" | head -10 | sed 's/^/    /'
  echo ""
  echo -e "${Y}  Trying a different fix — rewrite org.ts completely...${N}"
  
  # Force move old file and create minimal
  cp backend/src/routes/org.ts backend/src/routes/org.ts.bak
  
  cat > backend/src/routes/org.ts << 'ORG_END'
import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db/pool';
import { ApiError, asyncHandler, ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { encrypt, randomKey } from '../lib/crypto';
import { whatsapp, credsFromOrg } from '../services/whatsapp';
import { billing } from '../services/billing';
import { storage } from '../services/cloudinary';
import { env } from '../config/env';
import crypto from 'crypto';

const router = Router();
router.use(requireAuth);

/* ============================================================
   BASIC ORG ROUTES
============================================================ */

router.get('/', asyncHandler(async (req, res) => {
  const org = await one<any>(`SELECT * FROM organizations WHERE id = $1`, [req.user!.orgId]);
  if (!org) throw ApiError.notFound();
  ok(res, {
    organization: {
      id: org.id, name: org.name, slug: org.slug, plan: org.plan,
      wallet_balance: Number(org.wallet_balance),
      wa_phone_number_id: org.wa_phone_number_id, wa_business_id: org.wa_business_id,
      wa_connected: org.wa_connected, meta_page_id: org.meta_page_id,
      ai_enabled: org.ai_enabled, ai_system_prompt: org.ai_system_prompt,
      exotel_number: org.exotel_number, settings: org.settings, created_at: org.created_at,
    },
  });
}));

router.patch('/', asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(2).max(80).optional(),
    ai_enabled: z.boolean().optional(),
    ai_system_prompt: z.string().max(4000).optional(),
    meta_page_id: z.string().optional(),
    exotel_number: z.string().optional(),
    settings: z.record(z.any()).optional(),
  }).parse(req.body);

  const fields: string[] = []; const values: any[] = []; let i = 1;
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue;
    fields.push(`${k} = $${i++}`);
    values.push(k === 'settings' ? JSON.stringify(v) : v);
  }
  if (!fields.length) throw ApiError.badRequest('Nothing to update');
  values.push(req.user!.orgId);
  const org = await one(`UPDATE organizations SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values);
  ok(res, { organization: org });
}));

/* ============================================================
   WHATSAPP SETUP — VERIFY TOKEN (KEY ROUTE)
============================================================ */

router.post('/whatsapp/verify-token', asyncHandler(async (req, res) => {
  const { phoneNumberId, accessToken } = z.object({
    phoneNumberId: z.string().min(3),
    accessToken: z.string().min(20),
  }).parse(req.body);

  const axios = (await import('axios')).default;

  try {
    const resp = await axios.get(
      `https://graph.facebook.com/${env.META_API_VERSION}/${phoneNumberId}`,
      {
        params: { fields: 'display_phone_number,verified_name,quality_rating,throughput' },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      }
    );
    ok(res, { verified: true, info: resp.data });
  } catch (e: any) {
    ok(res, {
      verified: false,
      error: e.response?.data?.error?.message || e.message,
      code: e.response?.data?.error?.code,
      fbtrace: e.response?.data?.error?.fbtrace_id,
    });
  }
}));

/* ============================================================
   WHATSAPP SETUP — CONNECT
============================================================ */

router.post('/whatsapp/connect-v2', asyncHandler(async (req, res) => {
  const { phoneNumberId, accessToken, businessId } = z.object({
    phoneNumberId: z.string().min(3),
    accessToken: z.string().min(20),
    businessId: z.string().optional(),
  }).parse(req.body);

  const axios = (await import('axios')).default;

  // Verify
  let verified: any = null;
  try {
    const v = await axios.get(
      `https://graph.facebook.com/${env.META_API_VERSION}/${phoneNumberId}`,
      {
        params: { fields: 'display_phone_number,verified_name,quality_rating,account_mode' },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      }
    );
    verified = v.data;
  } catch (e: any) {
    throw ApiError.badRequest(`Invalid credentials: ${e.response?.data?.error?.message || e.message}`);
  }

  // Auto-detect WABA ID
  let wabaId = businessId;
  if (!wabaId && verified?.account_mode) {
    try {
      const w = await axios.get(
        `https://graph.facebook.com/${env.META_API_VERSION}/${phoneNumberId}`,
        {
          params: { fields: 'account_mode' },
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );
      wabaId = w.data?.id;
    } catch {}
  }

  await query(
    `UPDATE organizations SET wa_phone_number_id=$2, wa_access_token=$3, wa_business_id=$4, wa_connected=TRUE WHERE id=$1`,
    [req.user!.orgId, phoneNumberId, encrypt(accessToken), wabaId ?? null]
  );

  ok(res, {
    connected: true,
    phoneNumberId,
    wabaId,
    info: verified,
  });
}));

/* Legacy connect */
router.post('/whatsapp/connect', asyncHandler(async (req, res) => {
  const { phoneNumberId, accessToken, businessId } = z.object({
    phoneNumberId: z.string().min(3),
    accessToken: z.string().min(20),
    businessId: z.string().optional(),
  }).parse(req.body);

  const axios = (await import('axios')).default;
  let info: any = null;
  try {
    const v = await axios.get(
      `https://graph.facebook.com/${env.META_API_VERSION}/${phoneNumberId}`,
      {
        params: { fields: 'display_phone_number,verified_name,quality_rating' },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      }
    );
    info = v.data;
  } catch (e: any) {
    throw ApiError.badRequest(`Could not validate: ${e.response?.data?.error?.message || e.message}`);
  }

  await query(
    `UPDATE organizations SET wa_phone_number_id=$2, wa_access_token=$3, wa_business_id=$4, wa_connected=TRUE WHERE id=$1`,
    [req.user!.orgId, phoneNumberId, encrypt(accessToken), businessId ?? null]
  );
  ok(res, { connected: true, display_phone_number: info?.display_phone_number, verified_name: info?.verified_name });
}));

router.get('/whatsapp/status', asyncHandler(async (req, res) => {
  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  const creds = credsFromOrg(org);
  if (!creds) return ok(res, { connected: false });
  try {
    const info = await whatsapp.getPhoneNumber(creds);
    ok(res, { connected: true, info });
  } catch {
    ok(res, { connected: false, error: 'Credentials invalid or expired' });
  }
}));

router.get('/whatsapp/setup-status', asyncHandler(async (req, res) => {
  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  const creds = credsFromOrg(org);
  ok(res, {
    connected: org?.wa_connected || false,
    hasCredentials: !!creds,
    hasWabaId: !!org?.wa_business_id,
    phoneNumberId: org?.wa_phone_number_id,
    wabaId: org?.wa_business_id,
    webhookUrl: `${env.FRONTEND_URL.replace('3000', '8080')}/api/v1/webhooks/whatsapp`,
    verifyToken: env.META_VERIFY_TOKEN,
  });
}));

router.post('/whatsapp/disconnect', asyncHandler(async (req, res) => {
  await query(`UPDATE organizations SET wa_connected=FALSE, wa_access_token=NULL, wa_phone_number_id=NULL WHERE id=$1`, [req.user!.orgId]);
  ok(res, { connected: false });
}));

router.post('/whatsapp/send-test', asyncHandler(async (req, res) => {
  const { to } = z.object({ to: z.string().min(10) }).parse(req.body);
  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  const creds = credsFromOrg(org);
  if (!creds) throw ApiError.badRequest('WhatsApp not connected');
  try {
    const msgId = await whatsapp.sendText(creds, to, '🎉 ChatNexa test — WhatsApp API working!');
    ok(res, { sent: true, messageId: msgId });
  } catch (e: any) {
    throw ApiError.badRequest(e.response?.data?.error?.message || e.message);
  }
}));

/* ============================================================
   TEMPLATES SYNC
============================================================ */

router.post('/whatsapp/sync-templates', asyncHandler(async (req, res) => {
  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  const creds = credsFromOrg(org);
  if (!creds || !org.wa_business_id) throw ApiError.badRequest('Connect WhatsApp first');
  const templates = await whatsapp.listTemplates(creds, org.wa_business_id);
  let upserted = 0;
  for (const t of templates) {
    const bodyComp = (t.components || []).find((c: any) => c.type === 'BODY');
    const headerComp = (t.components || []).find((c: any) => c.type === 'HEADER');
    const footerComp = (t.components || []).find((c: any) => c.type === 'FOOTER');
    await query(
      `INSERT INTO templates (org_id, name, category, language, header_type, header_text, body, footer, meta_template_id, meta_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
      [req.user!.orgId, t.name, t.category || 'MARKETING', t.language || 'en', headerComp?.format || null, headerComp?.text || null, bodyComp?.text || '', footerComp?.text || null, t.id, t.status || 'APPROVED']
    );
    upserted++;
  }
  ok(res, { synced: upserted, templates: templates.length });
}));

/* ============================================================
   WALLET
============================================================ */

router.get('/wallet', asyncHandler(async (req, res) => {
  const balance = await billing.balance(req.user!.orgId);
  const ledger = await billing.ledger(req.user!.orgId, 100);
  ok(res, { balance, ledger });
}));

router.post('/wallet/topup', asyncHandler(async (req, res) => {
  const { amount, reference } = z.object({ amount: z.number().positive().max(500000), reference: z.string().optional() }).parse(req.body);
  const balance = await billing.credit(req.user!.orgId, amount, 'topup', reference ? `Top-up ${reference}` : 'Manual top-up');
  ok(res, { balance });
}));

/* ============================================================
   API KEYS
============================================================ */

router.get('/api-keys', asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT id, name, key_prefix, last_used_at, revoked, created_at FROM api_keys WHERE org_id=$1 ORDER BY created_at DESC`, [req.user!.orgId]);
  ok(res, { keys: rows });
}));

router.post('/api-keys', asyncHandler(async (req, res) => {
  const { name } = z.object({ name: z.string().default('default') }).parse(req.body);
  const raw = randomKey('cnx');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const row = await one(
    `INSERT INTO api_keys (org_id, name, key_hash, key_prefix) VALUES ($1,$2,$3,$4) RETURNING id, name, key_prefix, created_at`,
    [req.user!.orgId, name, hash, raw.slice(0, 12)]
  );
  ok(res, { key: raw, meta: row }, 201);
}));

router.delete('/api-keys/:id', asyncHandler(async (req, res) => {
  await query(`UPDATE api_keys SET revoked=TRUE WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  ok(res);
}));

/* ============================================================
   UPLOAD
============================================================ */

router.post('/upload', asyncHandler(async (req, res) => {
  const { base64, filename, mime } = z.object({
    base64: z.string(), filename: z.string().default('upload'), mime: z.string().default('image/png'),
  }).parse(req.body);
  if (!storage.enabled) throw ApiError.badRequest('Media storage not configured');
  const buffer = Buffer.from(base64.replace(/^data:.*?;base64,/, ''), 'base64');
  if (buffer.length > 16 * 1024 * 1024) throw ApiError.badRequest('File too large');
  const result = await storage.upload(buffer, `chatnexa/${req.user!.orgId}`);
  ok(res, { url: result.url, publicId: result.publicId, mime, filename });
}));

export default router;
ORG_END
  
  echo -e "${G}  ✅ org.ts completely rewritten with verify-token route${N}"
  echo -e "${Y}  Restarting backend...${N}"
  
  taskkill //F //IM node.exe 2>/dev/null || true
  sleep 2
  npm run dev > /tmp/cnx-force2.log 2>&1 &
  sleep 35
  
  # Test again
  H2=$(curl -s -m 5 http://localhost:8080/health 2>/dev/null)
  if echo "$H2" | grep -q '"ok":true'; then
    echo -e "${G}  ✅ Backend restarted${N}"
    
    TS2=$(date +%s)
    SIGNUP2=$(curl -s -m 15 -X POST http://localhost:8080/api/v1/auth/signup \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"Test2\",\"email\":\"fix${TS2}@cnx.in\",\"password\":\"password123\",\"orgName\":\"Fix $TS2\"}")
    TOKEN2=$(echo "$SIGNUP2" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -n "$TOKEN2" ]; then
      RESP2=$(curl -s -m 20 -X POST http://localhost:8080/api/v1/org/whatsapp/verify-token \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN2" \
        -d '{"phoneNumberId":"1367323576458420","accessToken":"test"}' 2>/dev/null)
      
      echo ""
      echo -e "${C}  Response after rewrite:${N}"
      echo "  $RESP2" | head -c 500
      echo ""
      
      if echo "$RESP2" | grep -q "Route not found"; then
        echo -e "${R}  ❌ STILL not working — check tsconfig or build${N}"
      else
        echo -e "${G}  ✅ ROUTE NOW WORKS!${N}"
      fi
    fi
  else
    echo -e "${R}  ❌ Backend failed to restart${N}"
    tail -30 /tmp/cnx-force2.log | sed 's/^/    /'
  fi
else
  echo -e "${G}  ✅ Route works!${N}"
  echo ""
  echo -e "${C}  Response:${N}"
  echo "  $RESP" | head -c 300
fi

echo ""
echo -e "${B}═══════════════════════════════════════════════════${N}"
echo -e "${G}✅ Backend chal raha hai: http://localhost:8080${N}"
echo -e "${Y}🎯 Ab browser me:${N}"
echo -e "${C}   http://localhost:3000/dashboard/setup${N}"
echo -e "${C}   Ctrl+Shift+R (hard refresh)${N}"
echo -e "${C}   Step 4 pe 'Verify with Meta' click karo${N}"
echo ""
echo -e "${Y}⚠️  Server background me chal raha hai${N}"
echo -e "${Y}   Stop karne ke liye: taskkill /F /IM node.exe${N}"
echo ""

wait