#!/usr/bin/env bash
set +e

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;34m'; C='\033[0;36m'; N='\033[0m'

cd ~/OneDrive/Desktop/chatnexa/chatnexa

echo ""
echo -e "${B}═════════════════════════════════════════════${N}"
echo -e "${B}  ⚡ QUICK FIX — Route Registration${N}"
echo -e "${B}═════════════════════════════════════════════${N}"
echo ""

# ============================================================
# STEP 1: KILL EVERYTHING HARD
# ============================================================
echo -e "${C}[1] Killing all node processes...${N}"
taskkill //F //IM node.exe 2>/dev/null || true
sleep 3
taskkill //F //IM node.exe 2>/dev/null || true
sleep 2
echo -e "${G}  ✅ Killed${N}"

# ============================================================
# STEP 2: VERIFY ROUTE FILE EXISTS
# ============================================================
echo ""
echo -e "${C}[2] Checking route file...${N}"

if [ -f "backend/src/routes/whatsapp-setup.ts" ]; then
  echo -e "${G}  ✅ backend/src/routes/whatsapp-setup.ts exists${N}"
  grep -c "router.post\|router.get" backend/src/routes/whatsapp-setup.ts | xargs echo "     Endpoints defined:"
else
  echo -e "${R}  ❌ File missing — creating...${N}"
  cat > backend/src/routes/whatsapp-setup.ts << 'END'
import { Router } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { ApiError, asyncHandler, ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { env } from '../config/env';
import { logger } from '../lib/logger';

const router = Router();
router.use(requireAuth);

router.post('/verify-token', asyncHandler(async (req, res) => {
  const { phoneNumberId, accessToken } = z.object({
    phoneNumberId: z.string().min(3),
    accessToken: z.string().min(20),
  }).parse(req.body);

  logger.info(`[WA Verify] tenant=${req.user!.orgId} phone=${phoneNumberId.slice(0, 6)}...`);

  try {
    const resp = await axios.get(
      `https://graph.facebook.com/${env.META_API_VERSION}/${phoneNumberId}`,
      {
        params: { fields: 'display_phone_number,verified_name,quality_rating' },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      }
    );
    return ok(res, { verified: true, info: resp.data });
  } catch (e: any) {
    const status = e.response?.status;
    const metaErr = e.response?.data?.error || {};
    let code = 'META_UNKNOWN_ERROR';
    let message = 'Could not verify with Meta.';

    if (status === 401) { code = 'META_AUTH_ERROR'; message = 'Access token is invalid or expired.'; }
    else if (status === 403) { code = 'META_FORBIDDEN'; message = 'Token lacks required permissions.'; }
    else if (status === 404) { code = 'META_NOT_FOUND'; message = 'Phone Number ID not found. Check Meta dashboard.'; }
    else if (status === 400) { code = 'META_BAD_REQUEST'; message = metaErr.message || 'Invalid credentials format.'; }
    else if (e.code === 'ECONNABORTED') { code = 'META_TIMEOUT'; message = 'Meta API timeout. Try again.'; }
    else if (metaErr.message) { message = metaErr.message; }

    return ok(res, {
      verified: false,
      error: { code, message },
      metaCode: metaErr.code,
    });
  }
}));

router.post('/connect-v2', asyncHandler(async (req, res) => {
  const { phoneNumberId, accessToken, businessId } = z.object({
    phoneNumberId: z.string().min(3),
    accessToken: z.string().min(20),
    businessId: z.string().optional(),
  }).parse(req.body);

  const { encrypt } = await import('../lib/crypto');
  const { query } = await import('../db/pool');

  await query(
    `UPDATE organizations SET wa_phone_number_id=$2, wa_access_token=$3, wa_business_id=$4, wa_connected=TRUE WHERE id=$1`,
    [req.user!.orgId, phoneNumberId, encrypt(accessToken), businessId ?? null]
  );

  return ok(res, { connected: true, phoneNumberId, wabaId: businessId || null });
}));

router.get('/setup-status', asyncHandler(async (req, res) => {
  const { one } = await import('../db/pool');
  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  return ok(res, {
    connected: org?.wa_connected || false,
    phoneNumberId: org?.wa_phone_number_id,
    wabaId: org?.wa_business_id,
  });
}));

router.get('/health', asyncHandler(async (_req, res) => {
  return ok(res, {
    ok: true,
    metaVersion: env.META_API_VERSION,
    ts: new Date().toISOString(),
  });
}));

export default router;
END
  echo -e "${G}  ✅ Created${N}"
fi

# ============================================================
# STEP 3: VERIFY INDEX.TS REGISTERS IT
# ============================================================
echo ""
echo -e "${C}[3] Checking index.ts registration...${N}"

if grep -q "whatsapp-setup" backend/src/routes/index.ts; then
  echo -e "${G}  ✅ Already registered${N}"
else
  echo -e "${Y}  ⚠️  Not registered — fixing...${N}"

  # Add import and use statement
  sed -i "s|import testNumberRoutes from './test-number';|import testNumberRoutes from './test-number';\nimport whatsappSetupRoutes from './whatsapp-setup';|" backend/src/routes/index.ts
  sed -i "s|router.use('/test-number', testNumberRoutes);|router.use('/test-number', testNumberRoutes);\nrouter.use('/org/whatsapp', whatsappSetupRoutes);|" backend/src/routes/index.ts
  echo -e "${G}  ✅ Fixed${N}"
fi

echo ""
echo -e "${C}  Current routes index (import lines):${N}"
grep "^import" backend/src/routes/index.ts | head -20 | sed 's/^/    /'
echo ""
echo -e "${C}  Route registrations:${N}"
grep "router.use" backend/src/routes/index.ts | sed 's/^/    /'

# ============================================================
# STEP 4: CLEAR CACHE + START BACKEND ONLY
# ============================================================
echo ""
echo -e "${C}[4] Clearing caches + starting backend...${N}"
rm -rf backend/dist frontend/.next

# Start backend only (skip web)
cd backend
npm run dev > /tmp/quick-fix-backend.log 2>&1 &
BACKEND_PID=$!
cd ..

echo -e "${C}  Waiting 40s for backend to start...${N}"

READY=0
for i in {1..20}; do
  sleep 2
  S=$(curl -s -m 3 -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null)
  if [ "$S" = "200" ]; then
    READY=1
    echo -e "${G}  ✅ Backend up after $((i*2))s${N}"
    break
  fi
done

if [ "$READY" != "1" ]; then
  echo -e "${R}  ❌ Backend not responding${N}"
  echo -e "${Y}  Last 20 log lines:${N}"
  tail -20 /tmp/quick-fix-backend.log | sed 's/^/    /'
  exit 1
fi

# ============================================================
# STEP 5: CURL TEST THE ROUTE
# ============================================================
echo ""
echo -e "${C}[5] Testing route with curl...${N}"

# Signup
TS=$(date +%s)
SIGNUP=$(curl -s -m 15 -X POST http://localhost:8080/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"QF\",\"email\":\"qf${TS}@cnx.in\",\"password\":\"password123\",\"orgName\":\"QF $TS\"}")
TOKEN=$(echo "$SIGNUP" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${R}  ❌ Signup failed${N}"
  echo "  $SIGNUP" | head -c 300
  exit 1
fi
echo -e "${G}  ✅ Signup OK${N}"

# Test the endpoint
echo ""
echo -e "${C}  POST /api/v1/org/whatsapp/verify-token (invalid token)${N}"
RESP=$(curl -s -m 20 -X POST http://localhost:8080/api/v1/org/whatsapp/verify-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"phoneNumberId":"1367323576458420","accessToken":"invalid_token_test_1234567890abcdefghij"}' 2>/dev/null)

echo "  Response:"
echo "  $RESP" | head -c 400
echo ""

# Verdict
echo ""
if echo "$RESP" | grep -q "Route not found"; then
  echo -e "${R}  ❌ ROUTE NOT REGISTERED — backend still not loading new file${N}"
  echo ""
  echo -e "${Y}  Checking backend startup log for errors:${N}"
  grep -iE "error|cannot|fail|crash" /tmp/quick-fix-backend.log | head -10 | sed 's/^/    /'
  echo ""
  echo -e "${Y}  Checking if whatsapp-setup.ts has syntax errors:${N}"
  cd backend
  npx tsc --noEmit src/routes/whatsapp-setup.ts 2>&1 | head -10 | sed 's/^/    /'
  cd ..
elif echo "$RESP" | grep -q '"code":"META_AUTH_ERROR"'; then
  echo -e "${G}  ✅✅✅ ROUTE IS WORKING! ✅✅✅${N}"
  echo ""
  echo -e "${G}  Response has proper error code (META_AUTH_ERROR)${N}"
  echo -e "${G}  Meta rejected the token — this is EXPECTED for invalid token${N}"
  echo ""
  echo -e "${B}  ══════════════════════════════════════════════${N}"
  echo -e "${B}  🎯 NOW TEST IN BROWSER:${N}"
  echo -e "${B}  ══════════════════════════════════════════════${N}"
  echo ""
  echo -e "${Y}  CRITICAL: Do these in EXACT order:${N}"
  echo -e "  1. Browser me purane tab ko CLOSE karo"
  echo -e "  2. Naya tab kholo: ${G}http://localhost:3000/dashboard/setup${N}"
  echo -e "  3. ${R}Ctrl+Shift+R${N} (hard refresh — MUST!)"
  echo -e "  4. Step 4 pe credentials daalo"
  echo -e "  5. 'Verify with Meta' click karo"
  echo ""
  echo -e "${G}  Backend ab live hai: http://localhost:8080${N}"
elif echo "$RESP" | grep -q '"verified"'; then
  echo -e "${G}  ✅ Route working!${N}"
  echo -e "${C}  $RESP${N}"
else
  echo -e "${Y}  ⚠️  Unexpected response:${N}"
  echo -e "${C}  $RESP${N}"
fi

echo ""
echo -e "${Y}  Backend running. To stop: taskkill /F /IM node.exe${N}"
echo ""

wait