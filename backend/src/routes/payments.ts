import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db/pool';
import { ApiError, asyncHandler, ok, pageParams } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { payments } from '../services/razorpay';
import { whatsapp, credsFromOrg } from '../services/whatsapp';
import { env } from '../config/env';

const router = Router();
router.use(requireAuth);

router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await one(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status='paid')::int AS paid,
            COALESCE(SUM(amount) FILTER (WHERE status='paid'),0)::numeric AS collected,
            COALESCE(SUM(amount) FILTER (WHERE status='created'),0)::numeric AS pending
       FROM payments WHERE org_id=$1`,
    [req.user!.orgId]
  );
  ok(res, { stats });
}));

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = pageParams(req);
  const { rows } = await query(
    `SELECT p.*, c.name AS contact_name, c.phone AS contact_phone
       FROM payments p LEFT JOIN contacts c ON c.id = p.contact_id
      WHERE p.org_id=$1 ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
    [req.user!.orgId, limit, offset]
  );
  const total = await one<{ count: string }>(`SELECT COUNT(*)::int AS count FROM payments WHERE org_id=$1`, [req.user!.orgId]);
  ok(res, { payments: rows, pagination: { page, limit, total: Number(total?.count || 0) } });
}));

router.post('/link', asyncHandler(async (req, res) => {
  if (!payments.enabled) throw ApiError.badRequest('Razorpay is not configured');
  const body = z.object({
    amount: z.number().positive().max(1000000),
    description: z.string().min(1).max(200),
    contactId: z.string().uuid().optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    customerEmail: z.string().email().optional(),
    sendWhatsApp: z.boolean().default(false),
  }).parse(req.body);

  let contact: any = null;
  if (body.contactId) {
    contact = await one(`SELECT * FROM contacts WHERE id=$1 AND org_id=$2`, [body.contactId, req.user!.orgId]);
    if (!contact) throw ApiError.notFound('Contact not found');
  }

  const link: any = await payments.createPaymentLink({
    amountInr: body.amount, description: body.description,
    customer: { name: body.customerName || contact?.name || 'Customer', contact: body.customerPhone || contact?.phone || '', email: body.customerEmail || contact?.email || undefined },
    notes: { orgId: req.user!.orgId },
  });

  const payment = await one(
    `INSERT INTO payments (org_id, contact_id, amount, description, status, razorpay_order_id, short_url)
     VALUES ($1,$2,$3,$4,'created',$5,$6) RETURNING *`,
    [req.user!.orgId, body.contactId ?? null, body.amount, body.description, link.id, link.short_url]
  );

  if (body.sendWhatsApp && contact) {
    const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
    const creds = credsFromOrg(org);
    if (creds) {
      try {
        const text = `Hi ${contact.name || 'there'} 👋\n\n${body.description}\nAmount: ₹${body.amount.toFixed(2)}\n\nPay securely here:\n${link.short_url}`;
        const waId = await whatsapp.sendText(creds, contact.phone, text, true);
        await query(`INSERT INTO messages (org_id, contact_id, direction, wa_message_id, type, body, status) VALUES ($1,$2,'outbound',$3,'text',$4,'sent')`, [req.user!.orgId, contact.id, waId, text]);
      } catch { /* non-fatal */ }
    }
  }

  ok(res, { payment, link: link.short_url }, 201);
}));

router.post('/order', asyncHandler(async (req, res) => {
  if (!payments.enabled) throw ApiError.badRequest('Razorpay is not configured');
  const { amount, purpose } = z.object({ amount: z.number().positive().max(1000000), purpose: z.string().default('wallet_topup') }).parse(req.body);
  const order = await payments.createOrder(amount, `cnx_${Date.now()}`, { orgId: req.user!.orgId, purpose });
  ok(res, { order, keyId: env.RAZORPAY_KEY_ID }, 201);
}));

router.post('/verify', asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = z.object({
    razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string(), amount: z.number().positive(),
  }).parse(req.body);

  const valid = payments.verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!valid) throw ApiError.badRequest('Invalid payment signature');

  const { billing } = await import('../services/billing');
  const balance = await billing.credit(req.user!.orgId, amount, 'topup', `Razorpay ${razorpay_payment_id}`, razorpay_order_id);
  ok(res, { verified: true, balance });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const p = await one<any>(`SELECT * FROM payments WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  if (!p) throw ApiError.notFound();
  if (p.status === 'paid') throw ApiError.badRequest('Cannot delete a completed payment');
  await query(`DELETE FROM payments WHERE id=$1`, [req.params.id]);
  ok(res);
}));

export default router;
