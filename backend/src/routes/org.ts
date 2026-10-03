import { env } from '../config/env';
import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db/pool';
import { ApiError, asyncHandler, ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { encrypt, randomKey } from '../lib/crypto';
import { whatsapp, credsFromOrg } from '../services/whatsapp';
import { billing } from '../services/billing';
import { storage } from '../services/cloudinary';
import crypto from 'crypto';

const router = Router();
router.use(requireAuth);

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

router.post('/whatsapp/connect', asyncHandler(async (req, res) => {
  const { phoneNumberId, accessToken, businessId } = z.object({
    phoneNumberId: z.string().min(3),
    accessToken: z.string().min(20),
    businessId: z.string().optional(),
  }).parse(req.body);

  let info: any = null;
  try { info = await whatsapp.getPhoneNumber({ phoneNumberId, accessToken }); }
  catch { throw ApiError.badRequest('Could not validate WhatsApp credentials with Meta.'); }

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
  try { const info = await whatsapp.getPhoneNumber(creds); ok(res, { connected: true, info }); }
  catch { ok(res, { connected: false, error: 'Credentials invalid or expired' }); }
}));

router.post('/whatsapp/disconnect', asyncHandler(async (req, res) => {
  await query(`UPDATE organizations SET wa_connected=FALSE, wa_access_token=NULL, wa_phone_number_id=NULL WHERE id=$1`, [req.user!.orgId]);
  ok(res, { connected: false });
}));

router.post('/whatsapp/sync-templates', asyncHandler(async (req, res) => {
  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  const creds = credsFromOrg(org);
  if (!creds || !org.wa_business_id) throw ApiError.badRequest('Connect WhatsApp Business and set a Business ID first');

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

router.post('/upload', asyncHandler(async (req, res) => {
  const { base64, filename, mime } = z.object({
    base64: z.string(), filename: z.string().default('upload'), mime: z.string().default('image/png'),
  }).parse(req.body);
  if (!storage.enabled) throw ApiError.badRequest('Media storage is not configured');
  const buffer = Buffer.from(base64.replace(/^data:.*?;base64,/, ''), 'base64');
  if (buffer.length > 16 * 1024 * 1024) throw ApiError.badRequest('File too large (max 16MB)');
  const result = await storage.upload(buffer, `chatnexa/${req.user!.orgId}`);
  ok(res, { url: result.url, publicId: result.publicId, mime, filename });
}));

export default router;

/* ============================================================
   WHATSAPP API SETUP WIZARD ROUTES
============================================================ */

// GET /org/whatsapp/setup-status
// Returns current setup state so the wizard knows which step to show
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

  let subs: any = null;
  if (hasCreds && hasWaba) {
    const s = await (await import('../services/whatsapp')).whatsappSetup.getSubscriptions(org.wa_business_id, creds.accessToken);
    if (s.ok) subs = s.data;
  }

  const templateCount = await one<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM templates WHERE org_id=$1`,
    [req.user!.orgId]
  );

  ok(res, {
    connected: org.wa_connected,
    hasCredentials: hasCreds,
    hasWabaId: hasWaba,
    phoneNumberId: org.wa_phone_number_id,
    wabaId: org.wa_business_id,
    live,
    subscriptions: subs?.data || [],
    templateCount: Number(templateCount?.count || 0),
    webhookUrl: `${env.FRONTEND_URL.replace('3000', '8080')}/api/v1/webhooks/whatsapp`,
    verifyToken: env.META_VERIFY_TOKEN,
  });
}));

// POST /org/whatsapp/verify-token
// Step 4 — verify credentials before saving
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

// POST /org/whatsapp/connect-v2
// Saves credentials + auto-fetches WABA ID + subscribes app
router.post('/whatsapp/connect-v2', asyncHandler(async (req, res) => {
  const { phoneNumberId, accessToken, businessId, autoSubscribe } = z.object({
    phoneNumberId: z.string().min(3),
    accessToken: z.string().min(20),
    businessId: z.string().optional(),
    autoSubscribe: z.boolean().default(true),
  }).parse(req.body);

  const { whatsappSetup } = await import('../services/whatsapp');

  // Verify first
  const verify = await whatsappSetup.verifyCredentials(phoneNumberId, accessToken);
  if (!verify.ok) throw ApiError.badRequest(`Invalid credentials: ${verify.error}`);

  // Try to auto-detect WABA ID if not provided
  let wabaId = businessId;
  if (!wabaId) {
    const wabaInfo = await whatsappSetup.getWabaIdFromPhone(phoneNumberId, accessToken);
    if (wabaInfo.ok) wabaId = wabaInfo.data?.id;
  }

  // Save credentials
  await query(
    `UPDATE organizations SET
       wa_phone_number_id=$2,
       wa_access_token=$3,
       wa_business_id=$4,
       wa_connected=TRUE
     WHERE id=$1`,
    [req.user!.orgId, phoneNumberId, encrypt(accessToken), wabaId ?? null]
  );

  // Auto-subscribe app to WABA
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

// POST /org/whatsapp/register-number
// Registers phone with a 6-digit PIN (required for outbound)
router.post('/whatsapp/register-number', asyncHandler(async (req, res) => {
  const { pin } = z.object({
    pin: z.string().length(6).regex(/^\d{6}$/),
  }).parse(req.body);

  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  const creds = credsFromOrg(org);
  if (!creds) throw ApiError.badRequest('Connect WhatsApp first');

  const { whatsappSetup } = await import('../services/whatsapp');
  const result = await whatsappSetup.registerNumber(creds.phoneNumberId, creds.accessToken, pin);

  if (!result.ok) throw ApiError.badRequest(result.error);
  ok(res, { registered: true });
}));

// POST /org/whatsapp/subscribe-webhook
// Re-subscribe app to WABA (idempotent)
router.post('/whatsapp/subscribe-webhook', asyncHandler(async (req, res) => {
  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  const creds = credsFromOrg(org);
  if (!creds || !org.wa_business_id) throw ApiError.badRequest('Need WABA ID — connect WhatsApp first');

  const { whatsappSetup } = await import('../services/whatsapp');
  const result = await whatsappSetup.subscribeApp(org.wa_business_id, creds.accessToken);

  if (!result.ok) throw ApiError.badRequest(result.error);
  ok(res, { subscribed: true });
}));

// POST /org/whatsapp/send-test
// Sends a test message to a phone number
router.post('/whatsapp/send-test', asyncHandler(async (req, res) => {
  const { to } = z.object({
    to: z.string().min(10),
  }).parse(req.body);

  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  const creds = credsFromOrg(org);
  if (!creds) throw ApiError.badRequest('Connect WhatsApp first');

  const { whatsappSetup } = await import('../services/whatsapp');
  const result = await whatsappSetup.sendTest(creds.phoneNumberId, creds.accessToken, to);

  if (!result.ok) throw ApiError.badRequest(result.error);
  ok(res, { sent: true, messageId: result.data?.messages?.[0]?.id });
}));
