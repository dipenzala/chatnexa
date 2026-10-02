import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db/pool';
import { ApiError, asyncHandler, ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { clientLove } from '../services/client-love';

const router = Router();
router.use(requireAuth);

/* ============================================================
   BIRTHDAYS & ANNIVERSARIES
============================================================ */
router.get('/upcoming', asyncHandler(async (req, res) => {
  const days = Math.min(60, Number(req.query.days || 30));
  const rows = await many(
    `SELECT id, name, phone, birthday, anniversary,
            CASE
              WHEN EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
                AND EXTRACT(DAY FROM birthday) >= EXTRACT(DAY FROM CURRENT_DATE)
                THEN EXTRACT(DAY FROM birthday) - EXTRACT(DAY FROM CURRENT_DATE)
              ELSE 365
            END AS days_until
       FROM contacts
      WHERE org_id = $1 AND (birthday IS NOT NULL OR anniversary IS NOT NULL)
      ORDER BY days_until ASC LIMIT 50`,
    [req.user!.orgId]
  );
  ok(res, { upcoming: rows });
}));

router.patch('/contacts/:id/dates', asyncHandler(async (req, res) => {
  const body = z.object({
    birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    anniversary: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  }).parse(req.body);

  const fields: string[] = []; const values: any[] = []; let i = 1;
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue;
    fields.push(`${k} = $${i++}`);
    values.push(v);
  }
  if (!fields.length) throw ApiError.badRequest('Nothing to update');
  values.push(req.params.id, req.user!.orgId);

  const contact = await one(`UPDATE contacts SET ${fields.join(', ')} WHERE id=$${i} AND org_id=$${i + 1} RETURNING *`, values);
  if (!contact) throw ApiError.notFound();
  ok(res, { contact });
}));

/* ============================================================
   GREETING LOG
============================================================ */
router.get('/greetings', asyncHandler(async (req, res) => {
  const rows = await many(
    `SELECT g.*, c.name AS contact_name, c.phone AS contact_phone
       FROM greeting_log g JOIN contacts c ON c.id = g.contact_id
      WHERE g.org_id = $1 ORDER BY g.sent_at DESC LIMIT 100`,
    [req.user!.orgId]
  );
  ok(res, { greetings: rows });
}));

router.post('/greetings/test', asyncHandler(async (req, res) => {
  const { type, contactId, festivalName } = z.object({
    type: z.enum(['birthday', 'anniversary', 'festival']),
    contactId: z.string().uuid(),
    festivalName: z.string().optional(),
  }).parse(req.body);

  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  const contact = await one<any>(`SELECT * FROM contacts WHERE id=$1 AND org_id=$2`, [contactId, req.user!.orgId]);
  if (!contact) throw ApiError.notFound('Contact not found');

  const msg = await clientLove.generateGreeting(type, contact, org, festivalName);
  ok(res, { preview: msg });
}));

/* ============================================================
   REFERRALS
============================================================ */
router.post('/referral/generate/:contactId', asyncHandler(async (req, res) => {
  const code = await clientLove.createReferralCode(req.user!.orgId, req.params.contactId);
  ok(res, { code, link: `${process.env.FRONTEND_URL}/r/${code}` });
}));

router.get('/referrals', asyncHandler(async (req, res) => {
  const rows = await many(
    `SELECT r.*, c.name AS referrer_name, c.phone AS referrer_phone
       FROM referrals r JOIN contacts c ON c.id = r.referrer_contact_id
      WHERE r.org_id = $1 ORDER BY r.created_at DESC LIMIT 100`,
    [req.user!.orgId]
  );
  ok(res, { referrals: rows });
}));

router.post('/referral/track', asyncHandler(async (req, res) => {
  const { code, contactId } = z.object({ code: z.string(), contactId: z.string().uuid() }).parse(req.body);
  const ref = await clientLove.trackReferral(req.user!.orgId, code, contactId);
  if (!ref) throw ApiError.badRequest('Invalid referral code');
  ok(res, { referral: ref });
}));

/* ============================================================
   REVIEW REQUEST
============================================================ */
router.post('/review/request/:contactId', asyncHandler(async (req, res) => {
  const sent = await clientLove.requestReview(req.user!.orgId, req.params.contactId);
  if (!sent) throw ApiError.badRequest('Could not send (rate-limited or no Google URL set)');
  ok(res, { sent: true });
}));

router.post('/review/request-bulk', asyncHandler(async (req, res) => {
  const { contactIds } = z.object({ contactIds: z.array(z.string().uuid()).min(1).max(500) }).parse(req.body);
  let sent = 0;
  for (const id of contactIds) {
    const r = await clientLove.requestReview(req.user!.orgId, id);
    if (r) sent++;
    await new Promise((res) => setTimeout(res, 100));
  }
  ok(res, { sent, total: contactIds.length });
}));

/* ============================================================
   LOYALTY
============================================================ */
router.get('/loyalty', asyncHandler(async (req, res) => {
  const rows = await many(
    `SELECT id, name, phone, loyalty_points, total_spent
       FROM contacts
      WHERE org_id = $1 AND loyalty_points > 0
      ORDER BY loyalty_points DESC LIMIT 100`,
    [req.user!.orgId]
  );
  ok(res, { loyalty: rows });
}));

export default router;
