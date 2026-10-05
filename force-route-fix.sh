#!/usr/bin/env bash
set +e

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;34m'; C='\033[0;36m'; M='\033[0;35m'; N='\033[0m'

cd ~/OneDrive/Desktop/chatnexa/chatnexa
PD=$(pwd)

echo ""
echo -e "${B}╔═══════════════════════════════════════════════════════╗${N}"
echo -e "${B}║  🔨 FORCE ROUTE FIX — Guaranteed Registration        ║${N}"
echo -e "${B}╚═══════════════════════════════════════════════════════╝${N}"
echo ""

# ============================================================
# [1] KILL EVERYTHING (twice for safety)
# ============================================================
echo -e "${B}[1/8] Killing all node processes...${N}"
taskkill //F //IM node.exe 2>/dev/null || true
sleep 3
taskkill //F //IM node.exe 2>/dev/null || true
sleep 2
rm -rf backend/dist frontend/.next /tmp/cnx-force.log
echo -e "${G}  ✅ All killed${N}"

# ============================================================
# [2] NUKE OLD FILES
# ============================================================
echo ""
echo -e "${B}[2/8] Removing old route files...${N}"
rm -f backend/src/routes/whatsapp-setup.ts
rm -f backend/src/routes/index.ts
echo -e "${G}  ✅ Removed${N}"

# ============================================================
# [3] WRITE FRESH whatsapp-setup.ts (QUOTED heredoc)
# ============================================================
echo ""
echo -e "${B}[3/8] Writing fresh whatsapp-setup.ts...${N}"

cat > backend/src/routes/whatsapp-setup.ts << 'WASETUP_END'
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { ApiError, asyncHandler, ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { env } from '../config/env';
import { logger } from '../lib/logger';

const router = Router();

// Log every hit for debugging
router.use((req: Request, _res: Response, next) => {
  logger.info(`[WA-Setup Route] ${req.method} ${req.originalUrl}`);
  next();
});

router.use(requireAuth);

/**
 * POST /api/v1/org/whatsapp/verify-token
 */
router.post('/verify-token', asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumberId, accessToken, wabaId } = z.object({
    phoneNumberId: z.string().min(3),
    accessToken: z.string().min(20),
    wabaId: z.string().optional(),
  }).parse(req.body);

  logger.info(`[WA Verify] tenant=${req.user!.orgId} phone=${phoneNumberId.slice(0, 6)}...`);

  try {
    const resp = await axios.get(
      `https://graph.facebook.com/${env.META_API_VERSION}/${phoneNumberId}`,
      {
        params: { fields: 'display_phone_number,verified_name,quality_rating,platform_type' },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      }
    );

    return ok(res, {
      verified: true,
      info: {
        display_phone_number: resp.data?.display_phone_number,
        verified_name: resp.data?.verified_name,
        quality_rating: resp.data?.quality_rating,
        platform_type: resp.data?.platform_type,
      },
      wabaId: wabaId || null,
    });
  } catch (e: any) {
    const status = e.response?.status;
    const metaErr = e.response?.data?.error || {};
    let code = 'META_UNKNOWN_ERROR';
    let message = 'Could not verify with Meta.';

    if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') {
      code = 'META_TIMEOUT';
      message = 'Meta API timeout. Please try again.';
    } else if (status === 401) {
      code = 'META_AUTH_ERROR';
      message = 'Access token is invalid or expired. Generate a new permanent token.';
    } else if (status === 403) {
      code = 'META_FORBIDDEN';
      message = 'Token does not have required WhatsApp permissions.';
    } else if (status === 404) {
      code = 'META_NOT_FOUND';
      message = 'Phone Number ID not found. Check Meta dashboard.';
    } else if (status === 400) {
      code = 'META_BAD_REQUEST';
      message = metaErr.message || 'Invalid credentials format.';
    } else if (status === 429) {
      code = 'META_RATE_LIMIT';
      message = 'Too many requests to Meta. Wait a moment.';
    } else if (metaErr.message) {
      message = metaErr.message;
    }

    logger.warn(`[WA Verify] FAILED code=${code} status=${status}`);

    return ok(res, {
      verified: false,
      error: { code, message },
      metaCode: metaErr.code,
    });
  }
}));

/**
 * POST /api/v1/org/whatsapp/connect-v2
 */
router.post('/connect-v2', asyncHandler(async (req: Request, res: Response) => {
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

/**
 * GET /api/v1/org/whatsapp/setup-status
 */
router.get('/setup-status', asyncHandler(async (req: Request, res: Response) => {
  const { one } = await import('../db/pool');
  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  return ok(res, {
    connected: org?.wa_connected || false,
    phoneNumberId: org?.wa_phone_number_id,
    wabaId: org?.wa_business_id,
  });
}));

/**
 * GET /api/v1/org/whatsapp/health
 */
router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  return ok(res, {
    ok: true,
    metaVersion: env.META_API_VERSION,
    ts: new Date().toISOString(),
  });
}));

export default router;
WASETUP_END

echo -e "${G}  ✅ whatsapp-setup.ts created (4 endpoints)${N}"

# ============================================================
# [4] WRITE FRESH index.ts (QUOTED heredoc)
# ============================================================
echo ""
echo -e "${B}[4/8] Writing fresh index.ts...${N}"

cat > backend/src/routes/index.ts << 'INDEX_END'
import { Router } from 'express';
import authRoutes from './auth';
import orgRoutes from './org';
import contactRoutes from './contacts';
import templateRoutes from './templates';
import campaignRoutes from './campaigns';
import inboxRoutes from './inbox';
import aiRoutes from './ai';
import leadRoutes from './leads';
import paymentRoutes from './payments';
import analyticsRoutes from './analytics';
import webhookRoutes from './webhooks';
import dealRoutes from './deals';
import followupRoutes from './followups';
import clientLoveRoutes from './client-love';
import growthRoutes from './growth';
import megaRoutes from './mega';
import bspRoutes from './bsp';
import adminRoutes from './admin';
import aiTemplatesRoutes from './ai-templates';
import testNumberRoutes from './test-number';
import whatsappSetupRoutes from './whatsapp-setup';

const router = Router();

// ============================================================
// WhatsApp Setup — MUST be registered BEFORE /org to prevent shadowing
// ============================================================
router.use('/org/whatsapp', whatsappSetupRoutes);

// ============================================================
// Standard routes
// ============================================================
router.use('/auth', authRoutes);
router.use('/org', orgRoutes);
router.use('/contacts', contactRoutes);
router.use('/templates', templateRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/inbox', inboxRoutes);
router.use('/ai', aiRoutes);
router.use('/leads', leadRoutes);
router.use('/payments', paymentRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/deals', dealRoutes);
router.use('/followups', followupRoutes);
router.use('/client-love', clientLoveRoutes);
router.use('/growth', growthRoutes);
router.use('/mega', megaRoutes);
router.use('/bsp', bspRoutes);
router.use('/admin', adminRoutes);
router.use('/ai-templates', aiTemplatesRoutes);
router.use('/test-number', testNumberRoutes);

// ============================================================
// Route dump — log what's actually registered
// ============================================================
router.stack.forEach((layer: any) => {
  if (layer.name === 'router' && layer.regexp) {
    const path = layer.regexp.source
      .replace('^\\/','/')
      .replace('\\/?(?=\\/|$)', '')
      .replace(/\\\//g, '/');
    console.log(`[Route Mount] ${path}`);
  }
});

export default router;
INDEX_END

echo -e "${G}  ✅ index.ts created (with route logging)${N}"

# ============================================================
# [5] ADD ROUTE DUMP TO SERVER.TS
# ============================================================
echo ""
echo -e "${B}[5/8] Adding route verification to server startup...${N}"

# Create a separate debug route to list all routes
cat > backend/src/routes/_debug.ts << 'DEBUG_END'
import { Router, Request, Response } from 'express';
import routes from './index';

const router = Router();

router.get('/routes', (_req: Request, res: Response) => {
  const list: string[] = [];
  function walk(stack: any[], prefix: string) {
    for (const layer of stack) {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase()).join(',');
        list.push(`${methods} ${prefix}${layer.route.path}`);
      } else if (layer.name === 'router' && layer.handle.stack) {
        const match = layer.regexp.source
          .replace('^\\/', '/')
          .replace('\\/?(?=\\/|$)', '')
          .replace(/\\\//g, '/')
          .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ':id');
        walk(layer.handle.stack, prefix + match);
      }
    }
  }
  walk((routes as any).stack || [], '');
  res.json({ count: list.length, routes: list.sort() });
});

export default router;
DEBUG_END

# Register debug route in index.ts (only in dev)
node << 'NODE_END'
const fs = require('fs');
let src = fs.readFileSync('backend/src/routes/index.ts', 'utf8');
if (!src.includes('_debug')) {
  src = src.replace(
    "import whatsappSetupRoutes from './whatsapp-setup';",
    "import whatsappSetupRoutes from './whatsapp-setup';\nimport debugRoutes from './_debug';"
  );
  src = src.replace(
    "router.use('/test-number', testNumberRoutes);",
    "router.use('/test-number', testNumberRoutes);\nrouter.use('/_debug', debugRoutes);"
  );
  fs.writeFileSync('backend/src/routes/index.ts', src);
  console.log('  ✅ Debug route registered');
}
NODE_END

echo -e "${G}  ✅ Route debug endpoint added${N}"

# ============================================================
# [6] START BACKEND
# ============================================================
echo ""
echo -e "${B}[6/8] Starting backend...${N}"

cd backend
npm run dev > /tmp/cnx-force.log 2>&1 &
cd ..

echo -e "${C}  Waiting for backend (60s max)...${N}"
READY=0
for i in {1..30}; do
  sleep 2
  S=$(curl -s -m 3 -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null)
  if [ "$S" = "200" ] || [ "$S" = "503" ]; then
    READY=1
    echo -e "${G}  ✅ Backend up after $((i*2))s${N}"
    break
  fi
done

if [ "$READY" != "1" ]; then
  echo -e "${R}  ❌ Backend failed to start${N}"
  echo -e "${Y}  Last 25 log lines:${N}"
  tail -25 /tmp/cnx-force.log | sed 's/^/    /'
  exit 1
fi

# Wait for DB
for i in {1..15}; do
  sleep 2
  curl -s -m 5 http://localhost:8080/health 2>/dev/null | grep -q '"ok":true' && break
done

# ============================================================
# [7] VERIFY ROUTES REGISTERED
# ============================================================
echo ""
echo -e "${B}[7/8] Verifying routes registered...${N}"

# Get route dump
ROUTES_DUMP=$(curl -s -m 10 http://localhost:8080/api/v1/_debug/routes 2>/dev/null)

if echo "$ROUTES_DUMP" | grep -q "verify-token"; then
  echo -e "${G}  ✅ /org/whatsapp/verify-token IS REGISTERED${N}"
else
  echo -e "${R}  ❌ Route NOT registered — showing all registered routes:${N}"
  echo "$ROUTES_DUMP" | head -c 1500
  echo ""
fi

if echo "$ROUTES_DUMP" | grep -q "org/whatsapp"; then
  echo -e "${G}  ✅ /org/whatsapp prefix exists${N}"
fi

echo ""
echo -e "${C}  All mounted routers:${N}"
grep "Route Mount" /tmp/cnx-force.log | head -25 | sed 's/^/    /'

# ============================================================
# [8] CURL TEST
# ============================================================
echo ""
echo -e "${B}[8/8] Direct curl test to /verify-token...${N}"

# Signup
TS=$(date +%s)
SIGNUP=$(curl -s -m 15 -X POST http://localhost:8080/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"F\",\"email\":\"f${TS}@cnx.in\",\"password\":\"password123\",\"orgName\":\"F $TS\"}")
TOKEN=$(echo "$SIGNUP" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${R}  ❌ Signup failed${N}"
  echo "  $SIGNUP" | head -c 200
  exit 1
fi
echo -e "${G}  ✅ Auth token obtained${N}"

# Hit the endpoint
echo ""
echo -e "${C}  Testing verify-token with dummy token:${N}"
RESP=$(curl -s -m 20 -X POST http://localhost:8080/api/v1/org/whatsapp/verify-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"phoneNumberId":"1367323576458420","accessToken":"dummy_token_for_testing_1234567890abcdef"}' 2>/dev/null)

echo ""
echo -e "${C}  Raw response:${N}"
echo "$RESP" | head -c 500
echo ""

echo ""
if echo "$RESP" | grep -q "Route not found"; then
  echo -e "${R}  ❌❌❌ ROUTE NOT FOUND — deep issue${N}"
  echo ""
  echo -e "${Y}  Checking what backend ACTUALLY has:${N}"
  curl -s http://localhost:8080/api/v1/_debug/routes | head -c 800
elif echo "$RESP" | grep -q '"verified"'; then
  echo -e "${G}  ✅✅✅ ROUTE WORKING! ✅✅✅${N}"
  echo ""
  echo -e "${B}  ══════════════════════════════════════════════${N}"
  echo -e "${B}  🎯 NOW TEST IN BROWSER (either localhost or Vercel)${N}"
  echo -e "${B}  ══════════════════════════════════════════════${N}"
  echo ""
  echo -e "  ${Y}Local test:${N}"
  echo -e "    1. ${G}http://localhost:3000/dashboard/setup${N}"
  echo -e "    2. ${R}Ctrl+Shift+R${N}"
  echo -e "    3. Credentials daalo → Verify click"
  echo ""
  echo -e "  ${Y}Vercel test:${N}"
  echo -e "    1. Vercel env: ${G}NEXT_PUBLIC_API_URL=https://<tunnel-url>${N}"
  echo -e "    2. Redeploy Vercel"
  echo -e "    3. ${G}https://chatflow-saas-web.vercel.app/dashboard/setup${N}"
  echo ""
else
  echo -e "${Y}  ⚠️  Unexpected response${N}"
fi

echo ""
echo -e "${Y}  Backend running. Stop: taskkill /F /IM node.exe${N}"
echo ""
echo -e "${C}  💡 TIP: Open in browser to see all routes:${N}"
echo -e "     ${G}http://localhost:8080/api/v1/_debug/routes${N}"
echo ""

wait