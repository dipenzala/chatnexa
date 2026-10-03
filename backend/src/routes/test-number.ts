import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db/pool';
import { ApiError, asyncHandler, ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/log', asyncHandler(async (req, res) => {
  const rows = await many(`SELECT * FROM wa_test_log WHERE org_id = $1 ORDER BY sent_at DESC LIMIT 50`, [req.user!.orgId]);
  ok(res, { log: rows });
}));

router.post('/send', asyncHandler(async (req, res) => {
  const body = z.object({
    phone: z.string().min(10),
    message: z.string().max(1000).default('🎉 ChatNexa test — WhatsApp API working!'),
  }).parse(req.body);

  const org = await one<any>(`SELECT * FROM organizations WHERE id = $1`, [req.user!.orgId]);
  const log = await one<any>(`INSERT INTO wa_test_log (org_id, phone_number, status) VALUES ($1,$2,'pending') RETURNING *`, [req.user!.orgId, body.phone]);

  try {
    const { credsFromOrg, sendMessageSmart } = await import('../services/whatsapp');
    const creds = credsFromOrg(org);
    const hasBSP = org?.bsp_provider && org.bsp_provider !== 'direct' && org.bsp_api_key_encrypted;
    if (!creds && !hasBSP) throw new Error('WhatsApp not connected. Complete Setup Wizard.');

    const messageId = await sendMessageSmart(org, body.phone, 'text', { text: body.message });
    await query(`UPDATE wa_test_log SET status='sent', message_id=$2 WHERE id=$1`, [log.id, messageId || 'unknown']);
    ok(res, { sent: true, messageId, log: { ...log, status: 'sent' } }, 201);
  } catch (e: any) {
    const errMsg = e.response?.data?.error?.message || e.message;
    await query(`UPDATE wa_test_log SET status='failed', error=$2 WHERE id=$1`, [log.id, errMsg?.slice(0, 500)]);
    throw ApiError.badRequest(`Test send failed: ${errMsg}`);
  }
}));

router.get('/whatsapp-details', asyncHandler(async (req, res) => {
  const org = await one<any>(`SELECT * FROM organizations WHERE id = $1`, [req.user!.orgId]);
  let liveInfo = null; let errorInfo = null;
  if (org?.wa_phone_number_id && org?.wa_access_token) {
    try {
      const { whatsapp, credsFromOrg } = await import('../services/whatsapp');
      const creds = credsFromOrg(org);
      if (creds) liveInfo = await whatsapp.getPhoneNumber(creds);
    } catch (e: any) { errorInfo = e.response?.data?.error?.message || e.message; }
  }
  ok(res, {
    connected: org?.wa_connected || false,
    phoneNumberId: org?.wa_phone_number_id ? `${org.wa_phone_number_id.slice(0, 6)}...${org.wa_phone_number_id.slice(-4)}` : null,
    wabaId: org?.wa_business_id ? `${org.wa_business_id.slice(0, 6)}...${org.wa_business_id.slice(-4)}` : null,
    bspProvider: org?.bsp_provider || 'direct',
    hasBSP: !!(org?.bsp_api_key_encrypted),
    live: liveInfo, error: errorInfo,
    quality: liveInfo?.quality_rating || 'N/A',
    displayPhone: liveInfo?.display_phone_number,
    verifiedName: liveInfo?.verified_name,
  });
}));

export default router;
