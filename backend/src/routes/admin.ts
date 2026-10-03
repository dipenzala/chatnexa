import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db/pool';
import { ApiError, asyncHandler, ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

async function requireSuperAdmin(req: any, _res: any, next: any) {
  const u = await one<any>(`SELECT is_super_admin FROM users WHERE id = $1`, [req.user.id]);
  if (!u?.is_super_admin) return next(ApiError.forbidden('Super admin only'));
  next();
}

router.get('/overview', requireSuperAdmin, asyncHandler(async (_req, res) => {
  const [orgs, users, msgs, revenue, campaigns] = await Promise.all([
    one(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE onboarding_status='active')::int AS active, COUNT(*) FILTER (WHERE onboarding_status='pending')::int AS pending FROM organizations`),
    one(`SELECT COUNT(*)::int AS total FROM users WHERE is_active = TRUE`),
    one(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE direction='outbound')::int AS outbound, COUNT(*) FILTER (WHERE direction='inbound')::int AS inbound, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS last_30d, COUNT(*) FILTER (WHERE created_at > CURRENT_DATE)::int AS today FROM messages`),
    one(`SELECT COALESCE(SUM(cost),0)::numeric AS client_charges, COALESCE(SUM(cost * 0.7),0)::numeric AS est_profit FROM messages WHERE direction='outbound'`),
    one(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='running')::int AS running FROM campaigns`),
  ]);
  ok(res, { orgs, users, msgs, revenue, campaigns });
}));

router.get('/clients', requireSuperAdmin, asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim();
  const status = String(req.query.status || '').trim();
  const where = ['1=1']; const params: any[] = []; let i = 1;
  if (search) { where.push(`(o.name ILIKE $${i} OR o.slug ILIKE $${i} OR o.owner_email ILIKE $${i})`); params.push(`%${search}%`); i++; }
  if (status) { where.push(`o.onboarding_status = $${i}`); params.push(status); i++; }
  const rows = await many(
    `SELECT o.id, o.name, o.slug, o.owner_email, o.plan, o.wallet_balance, o.onboarding_status, o.wa_connected, o.created_at, o.monthly_msg_limit, o.bsp_provider,
       (SELECT COUNT(*)::int FROM users WHERE org_id = o.id) AS user_count,
       (SELECT COUNT(*)::int FROM contacts WHERE org_id = o.id) AS contact_count,
       (SELECT COUNT(*)::int FROM messages WHERE org_id = o.id) AS total_msgs,
       (SELECT COUNT(*)::int FROM messages WHERE org_id = o.id AND created_at > NOW() - INTERVAL '30 days') AS msgs_30d,
       (SELECT COUNT(*)::int FROM messages WHERE org_id = o.id AND created_at > CURRENT_DATE) AS msgs_today,
       (SELECT COUNT(*)::int FROM campaigns WHERE org_id = o.id) AS campaign_count,
       (SELECT COALESCE(SUM(cost),0)::numeric FROM messages WHERE org_id = o.id AND direction='outbound') AS total_charged
     FROM organizations o WHERE ${where.join(' AND ')} ORDER BY o.created_at DESC LIMIT 200`,
    params
  );
  ok(res, { clients: rows });
}));

router.patch('/clients/:id', requireSuperAdmin, asyncHandler(async (req, res) => {
  const body = z.object({
    onboarding_status: z.enum(['pending', 'active', 'suspended', 'trial']).optional(),
    monthly_msg_limit: z.number().min(0).optional(),
  }).parse(req.body);
  const fields: string[] = []; const values: any[] = []; let i = 1;
  for (const [k, v] of Object.entries(body)) { if (v === undefined) continue; fields.push(`${k} = $${i++}`); values.push(v); }
  if (!fields.length) throw ApiError.badRequest('Nothing to update');
  values.push(req.params.id);
  await query(`UPDATE organizations SET ${fields.join(', ')} WHERE id = $${i}`, values);
  ok(res, { updated: true });
}));

router.post('/clients/:id/suspend', requireSuperAdmin, asyncHandler(async (req, res) => {
  await query(`UPDATE organizations SET onboarding_status='suspended' WHERE id=$1`, [req.params.id]);
  ok(res, { suspended: true });
}));

router.post('/clients/:id/activate', requireSuperAdmin, asyncHandler(async (req, res) => {
  await query(`UPDATE organizations SET onboarding_status='active', approved_by=$2, approved_at=NOW() WHERE id=$1`, [req.params.id, req.user!.id]);
  ok(res, { activated: true });
}));

router.get('/usage/monthly', requireSuperAdmin, asyncHandler(async (_req, res) => {
  const rows = await many(
    `SELECT TO_CHAR(date_trunc('month', created_at), 'YYYY-MM') AS month, COUNT(*)::int AS total_msgs, COUNT(*) FILTER (WHERE direction='outbound')::int AS outbound, COUNT(*) FILTER (WHERE direction='inbound')::int AS inbound, COALESCE(SUM(cost),0)::numeric AS revenue FROM messages WHERE created_at > NOW() - INTERVAL '12 months' GROUP BY month ORDER BY month DESC`
  );
  ok(res, { usage: rows });
}));

export default router;
