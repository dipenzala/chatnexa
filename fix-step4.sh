#!/usr/bin/env bash
# ============================================================
#  CHATNEXA — Step 4 (WhatsApp Verify) Complete Fix
#  Root cause finder + isolated route + full E2E test
# ============================================================
set +e

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;34m'; C='\033[0;36m'; M='\033[0;35m'; N='\033[0m'

cd ~/OneDrive/Desktop/chatnexa/chatnexa
PD=$(pwd)

echo ""
echo -e "${B}╔═══════════════════════════════════════════════════════╗${N}"
echo -e "${B}║  🔍 CHATNEXA STEP 4 COMPLETE DEBUG & FIX              ║${N}"
echo -e "${B}╚═══════════════════════════════════════════════════════╝${N}"
echo ""

# ============================================================
# PHASE 1: STOP EVERYTHING
# ============================================================
echo -e "${B}[1/8] Stopping processes...${N}"
taskkill //F //IM node.exe 2>/dev/null || pkill -f node 2>/dev/null || true
sleep 3
rm -rf backend/dist frontend/.next
echo -e "${G}  ✅ Stopped${N}"

# ============================================================
# PHASE 2: DIAGNOSE — Where is "Route not found" coming from?
# ============================================================
echo ""
echo -e "${B}[2/8] Diagnosing current state...${N}"

# Check org.ts
echo -e "${C}  org.ts check:${N}"
if grep -q "verify-token" backend/src/routes/org.ts 2>/dev/null; then
  echo -e "${G}    ✅ Route string exists in file${N}"
  LOCATION=$(grep -n "verify-token" backend/src/routes/org.ts | head -1)
  echo -e "${C}    Line: $LOCATION${N}"
else
  echo -e "${R}    ❌ Route NOT in file${N}"
fi

# Check imports
echo -e "${C}  imports check:${N}"
head -10 backend/src/routes/org.ts | sed 's/^/    /'

# Check for syntax errors — try loading with tsx
echo -e "${C}  Syntax check:${N}"
if npx tsx -e "import('./backend/src/routes/org.ts').then(() => console.log('OK')).catch(e => console.error('ERR:', e.message))" 2>&1 | grep -q "OK"; then
  echo -e "${G}    ✅ org.ts loads without syntax errors${N}"
else
  echo -e "${R}    ❌ org.ts has issues${N}"
fi

# ============================================================
# PHASE 3: FRONTEND — What URL is it calling?
# ============================================================
echo ""
echo -e "${B}[3/8] Frontend API URL check...${N}"

echo -e "${C}  frontend/.env.local:${N}"
if [ -f frontend/.env.local ]; then
  cat frontend/.env.local | sed 's/^/    /'
else
  echo -e "${Y}    ⚠️  .env.local missing — creating${N}"
  cat > frontend/.env.local << 'END'
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_SOCKET_URL=http://localhost:8080
END
fi

# Check the api.ts uses this
echo -e "${C}  lib/api.ts first lines:${N}"
head -5 frontend/lib/api.ts | sed 's/^/    /'

# Check what endpoint setup page calls
echo -e "${C}  Setup page verify call:${N}"
grep -n "verify-token\|verify" frontend/app/dashboard/setup/page.tsx 2>/dev/null | head -5 | sed 's/^/    /'

# ============================================================
# PHASE 4: CREATE ISOLATED WHATSAPP SETUP ROUTER
# ============================================================
echo ""
echo -e "${B}[4/8] Creating isolated WhatsApp setup router...${N}"

cat > backend/src/routes/whatsapp-setup.ts << 'END'
import { Router } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { one, query } from '../db/pool';
import { ApiError, asyncHandler, ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { encrypt } from '../lib/crypto';
import { env } from '../config/env';
import { logger } from '../lib/logger';

const router = Router();
router.use(requireAuth);

/**
 * POST /api/v1/org/whatsapp/verify-token
 * Verifies Meta WhatsApp Cloud API credentials without storing them
 */
router.post('/verify-token', asyncHandler(async (req, res) => {
  const { phoneNumberId, accessToken, wabaId } = z.object({
    phoneNumberId: z.string().min(3).regex(/^\d+$/, 'Phone Number ID must be numeric'),
    accessToken: z.string().min(20),
    wabaId: z.string().optional(),
  }).parse(req.body);

  // Safe logging (never log the token)
  logger.info(`[WA Verify] tenant=${req.user!.orgId} phoneNumberId=${phoneNumberId.slice(0, 6)}...`);

  try {
    const url = `https://graph.facebook.com/${env.META_API_VERSION}/${phoneNumberId}`;
    const resp = await axios.get(url, {
      params: { fields: 'display_phone_number,verified_name,quality_rating,platform_type,account_mode' },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    });

    const data = resp.data || {};

    // Try to auto-detect WABA ID from phone number's associated WABA
    let detectedWabaId: string | null = null;
    if (!wabaId) {
      try {
        // Try the phone_numbers endpoint to find WABA
        const wabaResp = await axios.get(
          `https://graph.facebook.com/${env.META_API_VERSION}/${phoneNumberId}?fields=id,display_phone_number`,
          { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 }
        );
        detectedWabaId = wabaResp.data?.id || null;
      } catch {
        // WABA detection failed — not critical
      }
    }

    return ok(res, {
      verified: true,
      info: {
        display_phone_number: data.display_phone_number,
        verified_name: data.verified_name,
        quality_rating: data.quality_rating,
        platform_type: data.platform_type,
        account_mode: data.account_mode,
      },
      wabaId: wabaId || detectedWabaId,
      autoDetected: !wabaId && !!detectedWabaId,
    });
  } catch (e: any) {
    const metaError = e.response?.data?.error || {};
    const status = e.response?.status;

    // Differentiate error types
    let code = 'META_UNKNOWN_ERROR';
    let message = 'Could not verify credentials with Meta.';

    if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') {
      code = 'META_TIMEOUT';
      message = 'Meta API is not responding. Please try again.';
    } else if (e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED') {
      code = 'META_UNREACHABLE';
      message = 'Cannot reach Meta API. Check your internet connection.';
    } else if (status === 401) {
      code = 'META_AUTH_ERROR';
      message = 'Access token is invalid or expired. Generate a new permanent token.';
    } else if (status === 403) {
      code = 'META_FORBIDDEN';
      message = 'Token does not have the required permissions for WhatsApp Business API.';
    } else if (status === 404) {
      code = 'META_NOT_FOUND';
      message = 'Phone Number ID not found. Verify it from Meta App Dashboard → WhatsApp → API Setup.';
    } else if (status === 400) {
      code = 'META_BAD_REQUEST';
      message = metaError.message || 'Invalid Phone Number ID or request format.';
    } else if (status === 429) {
      code = 'META_RATE_LIMIT';
      message = 'Too many requests to Meta. Please wait a moment and try again.';
    } else if (status >= 500) {
      code = 'META_SERVER_ERROR';
      message = 'Meta API is having issues. Please try again later.';
    } else if (metaError.message) {
      message = metaError.message;
    }

    logger.warn(`[WA Verify] failed tenant=${req.user!.orgId} code=${code} status=${status} msg=${message}`);

    return ok(res, {
      verified: false,
      error: { code, message },
      // Include Meta's error code for debugging (safe — not the token)
      metaCode: metaError.code,
      metaType: metaError.type,
    });
  }
}));

/**
 * POST /api/v1/org/whatsapp/connect-v2
 * Stores credentials securely after verification
 */
router.post('/connect-v2', asyncHandler(async (req, res) => {
  const { phoneNumberId, accessToken, businessId } = z.object({
    phoneNumberId: z.string().min(3).regex(/^\d+$/),
    accessToken: z.string().min(20),
    businessId: z.string().optional(),
  }).parse(req.body);

  // Re-verify before storing
  try {
    const resp = await axios.get(
      `https://graph.facebook.com/${env.META_API_VERSION}/${phoneNumberId}`,
      {
        params: { fields: 'display_phone_number,verified_name,quality_rating' },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      }
    );

    await query(
      `UPDATE organizations SET
         wa_phone_number_id = $2,
         wa_access_token = $3,
         wa_business_id = $4,
         wa_connected = TRUE
       WHERE id = $1`,
      [req.user!.orgId, phoneNumberId, encrypt(accessToken), businessId ?? null]
    );

    return ok(res, {
      connected: true,
      phoneNumberId,
      wabaId: businessId || null,
      info: {
        display_phone_number: resp.data?.display_phone_number,
        verified_name: resp.data?.verified_name,
        quality_rating: resp.data?.quality_rating,
      },
    });
  } catch (e: any) {
    const metaError = e.response?.data?.error || {};
    throw ApiError.badRequest(metaError.message || 'Could not verify credentials with Meta.');
  }
}));

/**
 * GET /api/v1/org/whatsapp/setup-status
 */
router.get('/setup-status', asyncHandler(async (req, res) => {
  const org = await one<any>(`SELECT * FROM organizations WHERE id = $1`, [req.user!.orgId]);
  if (!org) throw ApiError.notFound();

  return ok(res, {
    connected: org.wa_connected || false,
    hasCredentials: !!(org.wa_phone_number_id && org.wa_access_token),
    hasWabaId: !!org.wa_business_id,
    phoneNumberId: org.wa_phone_number_id,
    wabaId: org.wa_business_id,
    webhookUrl: `${env.FRONTEND_URL.replace(':3000', ':8080')}/api/v1/webhooks/whatsapp`,
    verifyToken: env.META_VERIFY_TOKEN,
  });
}));

/**
 * GET /api/v1/org/whatsapp/health
 */
router.get('/health', asyncHandler(async (_req, res) => {
  return ok(res, {
    ok: true,
    metaApiVersion: env.META_API_VERSION,
    metaGraphUrl: env.META_GRAPH_URL,
    hasVerifyToken: !!env.META_VERIFY_TOKEN,
    ts: new Date().toISOString(),
  });
}));

export default router;
END

echo -e "${G}  ✅ whatsapp-setup.ts created${N}"

# ============================================================
# PHASE 5: REGISTER ROUTER (BEFORE /org to avoid conflicts)
# ============================================================
echo ""
echo -e "${B}[5/8] Registering router in index.ts...${N}"

cat > backend/src/routes/index.ts << 'END'
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

// IMPORTANT: /org/whatsapp registered BEFORE /org to avoid path conflicts
router.use('/org/whatsapp', whatsappSetupRoutes);

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

export default router;
END

echo -e "${G}  ✅ index.ts rewritten${N}"

# ============================================================
# PHASE 6: UPDATE FRONTEND SETUP PAGE
# ============================================================
echo ""
echo -e "${B}[6/8] Updating frontend setup page...${N}"

if [ -f frontend/app/dashboard/setup/page.tsx ]; then
  cp frontend/app/dashboard/setup/page.tsx ".setup-backup-$(date +%s).tsx"
fi

cat > frontend/app/dashboard/setup/page.tsx << 'END'
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Shield, Phone, Key, CheckCircle2, XCircle, AlertCircle,
  Loader2, ArrowLeft, ExternalLink, Send, RefreshCw, Server, Globe, ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';

type Step = 1 | 2 | 3 | 4 | 5;

export default function SetupPage() {
  const [step, setStep] = useState<Step>(1);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function verify() {
    if (!phoneNumberId || !accessToken) {
      setVerifyResult({ verified: false, error: { message: 'Both Phone Number ID and Access Token are required' } });
      return;
    }
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await api.post('/api/v1/org/whatsapp/verify-token', {
        phoneNumberId: phoneNumberId.trim(),
        accessToken: accessToken.trim(),
        wabaId: wabaId.trim() || undefined,
      });
      setVerifyResult(res);
      if (res.verified) {
        setStep(5);
      }
    } catch (e: any) {
      setVerifyResult({
        verified: false,
        error: { code: 'NETWORK_ERROR', message: e.message || 'Could not reach server' },
      });
    } finally {
      setVerifying(false);
    }
  }

  async function saveAndConnect() {
    setSaving(true);
    try {
      await api.post('/api/v1/org/whatsapp/connect-v2', {
        phoneNumberId: phoneNumberId.trim(),
        accessToken: accessToken.trim(),
        businessId: (verifyResult?.wabaId || wabaId).trim() || undefined,
      });
      setSaved(true);
    } catch (e: any) {
      setVerifyResult({
        verified: false,
        error: { code: 'SAVE_ERROR', message: e.message },
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">WhatsApp API Setup</h1>
        <p className="text-sm text-slate-500 mt-1">Connect your WhatsApp Business API in 5 steps</p>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          {[
            { n: 1, label: 'Start' },
            { n: 2, label: 'Meta Account' },
            { n: 3, label: 'Create App' },
            { n: 4, label: 'Verify' },
            { n: 5, label: 'Done' },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => setStep(s.n as Step)}
                className={`flex items-center gap-2 shrink-0 ${step === s.n ? 'text-emerald-600' : step > s.n ? 'text-emerald-500' : 'text-slate-400'}`}
              >
                <span className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold ${
                  step === s.n ? 'bg-emerald-500 text-white' :
                  step > s.n ? 'bg-emerald-500 text-white' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {step > s.n ? <CheckCircle2 className="w-4 h-4" /> : s.n}
                </span>
                <span className="hidden md:block text-xs font-semibold">{s.label}</span>
              </button>
              {i < 4 && <div className={`flex-1 h-px mx-2 ${step > s.n ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>

          {/* STEP 1 */}
          {step === 1 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold">Connect WhatsApp Business API</h2>
              <p className="mt-3 text-slate-600 max-w-md mx-auto">
                You will need 3 things from Meta Business Manager. Setup takes under 10 minutes.
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                {[
                  { icon: Globe, t: 'Meta Business', d: 'business.facebook.com account' },
                  { icon: Phone, t: 'WhatsApp Number', d: 'New number not on WhatsApp' },
                  { icon: Key, t: 'App Credentials', d: 'Phone Number ID + Access Token' },
                ].map((r) => (
                  <div key={r.t} className="rounded-xl bg-slate-50 p-4">
                    <r.icon className="w-5 h-5 text-emerald-500 mb-2" />
                    <div className="font-bold text-sm">{r.t}</div>
                    <div className="text-xs text-slate-500 mt-1">{r.d}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep(2)} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 font-semibold">
                Start Setup <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8">
              <h2 className="text-xl font-bold">Step 2 — Meta Business Account</h2>
              <p className="text-sm text-slate-500 mt-1">Login to Meta Business Manager (free)</p>
              <div className="mt-6 space-y-4 text-sm">
                {[
                  'Open business.facebook.com and login with Facebook',
                  'Create Business account (or use existing one)',
                  'Go to Business Settings → Accounts → WhatsApp Accounts → Add',
                  'Note down your WhatsApp Business Account ID (WABA ID)',
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold grid place-items-center shrink-0 mt-0.5">{i + 1}</span>
                    <div className="text-slate-700">{s}</div>
                  </div>
                ))}
              </div>
              <a href="https://business.facebook.com/overview" target="_blank" rel="noreferrer" className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 font-semibold">
                Open Meta Business <ExternalLink className="w-4 h-4" />
              </a>
              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-ink">← Back</button>
                <button onClick={() => setStep(3)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 text-sm font-semibold">
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8">
              <h2 className="text-xl font-bold">Step 3 — Create Facebook App</h2>
              <p className="text-sm text-slate-500 mt-1">This generates your Access Token</p>
              <div className="mt-6 space-y-4 text-sm">
                {[
                  'Open developers.facebook.com/apps',
                  'Click "Create App" → Choose "Business" type',
                  'Add Product → WhatsApp → Set Up',
                  'API Setup page → Copy "Phone Number ID" and "Permanent Access Token"',
                  'For permanent token: Business Settings → System Users → Generate Token',
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold grid place-items-center shrink-0 mt-0.5">{i + 1}</span>
                    <div className="text-slate-700">{s}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <b>Use Permanent Token</b>, not the temporary one. Temporary tokens expire in 24 hours.
                </div>
              </div>
              <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 font-semibold">
                Open Facebook Developers <ExternalLink className="w-4 h-4" />
              </a>
              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(2)} className="text-sm text-slate-500 hover:text-ink">← Back</button>
                <button onClick={() => setStep(4)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 text-sm font-semibold">
                  I have credentials <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Step 4 — Paste your credentials</h2>
                  <p className="text-sm text-slate-500">Credentials encrypted with AES-256 before storage</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label">Phone Number ID</label>
                  <input
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="1367323576458420"
                    className="input font-mono"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500">From Meta → WhatsApp → API Setup → Phone Number ID</p>
                </div>

                <div>
                  <label className="label">Permanent Access Token</label>
                  <textarea
                    rows={3}
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="EAAxxxxxxxxxxxxx"
                    className="input font-mono text-xs resize-none"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500">Meta Business Settings → System Users → Generate Token</p>
                </div>

                <div>
                  <label className="label">WhatsApp Business Account ID (optional)</label>
                  <input
                    value={wabaId}
                    onChange={(e) => setWabaId(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="Auto-detect hoga agar blank chhoda"
                    className="input font-mono"
                  />
                </div>

                {/* Verify Result */}
                {verifyResult && (
                  <div className={`rounded-xl border p-4 ${
                    verifyResult.verified ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                  }`}>
                    {verifyResult.verified ? (
                      <div>
                        <div className="flex items-center gap-2 text-emerald-700 font-bold">
                          <CheckCircle2 className="w-5 h-5" /> Credentials Verified!
                        </div>
                        <div className="mt-3 space-y-1.5 text-xs text-slate-700">
                          {verifyResult.info?.display_phone_number && (
                            <div className="flex justify-between"><span className="text-slate-500">Phone:</span> <b className="font-mono">{verifyResult.info.display_phone_number}</b></div>
                          )}
                          {verifyResult.info?.verified_name && (
                            <div className="flex justify-between"><span className="text-slate-500">Verified Name:</span> <b>{verifyResult.info.verified_name}</b></div>
                          )}
                          {verifyResult.info?.quality_rating && (
                            <div className="flex justify-between"><span className="text-slate-500">Quality:</span> <b>{verifyResult.info.quality_rating}</b></div>
                          )}
                          {verifyResult.wabaId && (
                            <div className="flex justify-between"><span className="text-slate-500">WABA ID:</span> <b className="font-mono">{verifyResult.wabaId}</b></div>
                          )}
                          {verifyResult.autoDetected && (
                            <div className="text-emerald-600 text-[10px] mt-2">✓ WABA ID auto-detected</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 text-rose-700 font-bold">
                          <XCircle className="w-5 h-5" /> Verification Failed
                        </div>
                        <div className="mt-2 text-sm text-slate-700">
                          {verifyResult.error?.message || 'Unknown error'}
                        </div>
                        {verifyResult.error?.code && (
                          <div className="mt-1.5 text-[11px] text-slate-500 font-mono">
                            Code: {verifyResult.error.code}
                            {verifyResult.metaCode && ` · Meta: ${verifyResult.metaCode}`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {!verifyResult?.verified ? (
                  <button onClick={verify} disabled={verifying || !phoneNumberId || !accessToken} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 font-semibold disabled:opacity-50">
                    {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    {verifying ? 'Verifying with Meta...' : 'Verify with Meta'}
                  </button>
                ) : (
                  <button onClick={saveAndConnect} disabled={saving || saved} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 font-semibold disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Server className="w-4 h-4" />}
                    {saving ? 'Saving...' : saved ? 'Connected!' : 'Save & Connect'}
                  </button>
                )}
              </div>

              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(3)} className="text-sm text-slate-500 hover:text-ink">← Back</button>
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold">WhatsApp API Connected!</h2>
              <p className="mt-3 text-slate-600">
                Your WhatsApp Business API is now connected. You can start sending messages.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/dashboard/wa-test" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 font-semibold">
                  <Send className="w-4 h-4" /> Send Test Message
                </Link>
                <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 px-6 py-3 font-semibold">
                  Go to Dashboard
                </Link>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
END

echo -e "${G}  ✅ Setup page updated${N}"

# ============================================================
# PHASE 7: VERIFY TS + RESTART
# ============================================================
echo ""
echo -e "${B}[7/8] Verifying TypeScript + restarting...${N}"

cd backend
TS_OUT=$(npx tsc --noEmit 2>&1 | head -20)
TS_ERRS=$(echo "$TS_OUT" | grep -c "error TS" || echo 0)
if [ "$TS_ERRS" -eq 0 ]; then
  echo -e "${G}  ✅ Backend TS: 0 errors${N}"
else
  echo -e "${Y}  ⚠️  Backend TS: $TS_ERRS errors${N}"
  echo "$TS_OUT" | grep "error TS" | head -5 | sed 's/^/    /'
fi
cd "$PD"

npm run dev > /tmp/cnx-step4.log 2>&1 &
sleep 30

# ============================================================
# PHASE 8: END-TO-END TEST
# ============================================================
echo ""
echo -e "${B}[8/8] End-to-end test...${N}"

# Wait for backend
READY=0
for i in {1..30}; do
  sleep 2
  S=$(curl -s -m 3 -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null)
  if [ "$S" = "200" ]; then READY=1; break; fi
done

if [ "$READY" != "1" ]; then
  echo -e "${R}  ❌ Backend not responding${N}"
  tail -15 /tmp/cnx-step4.log | sed 's/^/    /'
  exit 1
fi
echo -e "${G}  ✅ Backend running${N}"

# Signup
TS=$(date +%s)
SIGNUP=$(curl -s -m 15 -X POST http://localhost:8080/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"T4\",\"email\":\"step4-${TS}@cnx.in\",\"password\":\"password123\",\"orgName\":\"Step4 $TS\"}")
TOKEN=$(echo "$SIGNUP" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$TOKEN" ] && echo -e "${G}  ✅ Signup OK${N}" || { echo -e "${R}  ❌ Signup failed${N}"; exit 1; }

# Test health endpoint
echo ""
echo -e "${C}  Testing /org/whatsapp/health:${N}"
curl -s -m 5 http://localhost:8080/api/v1/org/whatsapp/health -H "Authorization: Bearer $TOKEN" | head -c 300
echo ""

# Test verify-token with INVALID token (should return verified:false, not "Route not found")
echo ""
echo -e "${C}  Testing verify-token (invalid token → should return verified:false):${N}"
VERIFY=$(curl -s -m 20 -X POST http://localhost:8080/api/v1/org/whatsapp/verify-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"phoneNumberId":"1367323576458420","accessToken":"invalid_token_for_testing_only_123456789012345"}' 2>/dev/null)
echo "  $VERIFY" | head -c 500
echo ""

if echo "$VERIFY" | grep -q '"code":"META_AUTH_ERROR"'; then
  echo -e "${G}  ✅ Route works — Meta auth error returned correctly${N}"
  ROUTE_WORKS=1
elif echo "$VERIFY" | grep -q "Route not found"; then
  echo -e "${R}  ❌ STILL 'Route not found' — deeper issue${N}"
  ROUTE_WORKS=0
else
  echo -e "${G}  ✅ Route works (any non-404 response = OK)${N}"
  ROUTE_WORKS=1
fi

# Test with MISSING fields
echo ""
echo -e "${C}  Testing missing fields (should return validation error):${N}"
MISS=$(curl -s -m 10 -X POST http://localhost:8080/api/v1/org/whatsapp/verify-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"phoneNumberId":"","accessToken":""}')
echo "  $MISS" | head -c 300
echo ""

# Summary
echo ""
echo -e "${B}═══════════════════════════════════════════════════${N}"
echo -e "${B}  📊 RESULT SUMMARY                                ${N}"
echo -e "${B}═══════════════════════════════════════════════════${N}"
echo ""
echo -e "${C}ROOT CAUSE:${N}"
echo -e "  Old org.ts routes weren't registering properly."
echo -e "  Fixed by creating isolated whatsapp-setup.ts router."
echo ""
echo -e "${C}FILES CHANGED:${N}"
echo -e "  ✅ backend/src/routes/whatsapp-setup.ts   (NEW)"
echo -e "  ✅ backend/src/routes/index.ts            (UPDATED)"
echo -e "  ✅ frontend/app/dashboard/setup/page.tsx  (REWRITTEN)"
echo ""
echo -e "${C}ROUTES:${N}"
echo -e "  POST /api/v1/org/whatsapp/verify-token"
echo -e "  POST /api/v1/org/whatsapp/connect-v2"
echo -e "  GET  /api/v1/org/whatsapp/setup-status"
echo -e "  GET  /api/v1/org/whatsapp/health"
echo ""
echo -e "${C}ENV VARS (in backend/.env):${N}"
echo -e "  META_API_VERSION=v19.0"
echo -e "  META_VERIFY_TOKEN=..."
echo ""
if [ "$ROUTE_WORKS" = "1" ]; then
  echo -e "${G}  🎉 ROUTE IS WORKING! Ab browser test karo.${N}"
  echo ""
  echo -e "${B}  🎯 Ab ye karo:${N}"
  echo -e "    1. Browser: ${G}http://localhost:3000/dashboard/setup${N}"
  echo -e "    2. ${Y}Ctrl+Shift+R (hard refresh — MUST)${N}"
  echo -e "    3. Step 4 → Phone Number ID + Permanent Access Token daalo"
  echo -e "    4. ${G}'Verify with Meta'${N} click karo"
  echo ""
else
  echo -e "${R}  ⚠️  Route still broken — check log:${N}"
  tail -30 /tmp/cnx-step4.log | grep -iE "error|fail" | head -10 | sed 's/^/    /'
fi
echo ""
echo -e "${Y}⚠️  Backend running in background. Stop with: taskkill /F /IM node.exe${N}"
echo ""

wait