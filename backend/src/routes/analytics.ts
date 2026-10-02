import { Router } from 'express';
import { many, one } from '../db/pool';
import { asyncHandler, ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { billing } from '../services/billing';

const router = Router();
router.use(requireAuth);

router.get('/overview', asyncHandler(async (req, res) => {
  const orgId = req.user!.orgId;
  const [contacts, messages, campaigns, leads, revenue, wallet] = await Promise.all([
    one(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL '30 days')::int AS new_30d FROM contacts WHERE org_id=$1`, [orgId]),
    one(`SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE direction='inbound')::int AS inbound,
                COUNT(*) FILTER (WHERE direction='outbound')::int AS outbound,
                COUNT(*) FILTER (WHERE status='delivered')::int AS delivered,
                COUNT(*) FILTER (WHERE status='read')::int AS read_count,
                COUNT(*) FILTER (WHERE status='failed')::int AS failed
         FROM messages WHERE org_id=$1`, [orgId]),
    one(`SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status='running')::int AS running,
                COUNT(*) FILTER (WHERE status='completed')::int AS completed,
                COALESCE(SUM(sent),0)::int AS sent,
                COALESCE(SUM(delivered),0)::int AS delivered,
                COALESCE(SUM(read_count),0)::int AS read_count
         FROM campaigns WHERE org_id=$1`, [orgId]),
    one(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='new')::int AS new FROM leads WHERE org_id=$1`, [orgId]),
    one(`SELECT COALESCE(SUM(amount) FILTER (WHERE status='paid'),0)::numeric AS collected FROM payments WHERE org_id=$1`, [orgId]),
    billing.balance(orgId),
  ]);

  const totalMessages = Number((messages as any)?.outbound || 0);
  const readRate = totalMessages ? Number((((messages as any)?.read_count || 0) / totalMessages) * 100) : 0;
  const deliveryRate = totalMessages ? Number((((messages as any)?.delivered || 0) / totalMessages) * 100) : 0;

  ok(res, { contacts, messages, campaigns, leads, revenue, wallet, rates: { deliveryRate: Number(deliveryRate.toFixed(1)), readRate: Number(readRate.toFixed(1)) } });
}));

router.get('/messages/timeseries', asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days || 30)));
  const rows = await many(
    `SELECT TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
            COALESCE(SUM(CASE WHEN m.direction='outbound' THEN 1 ELSE 0 END),0)::int AS outbound,
            COALESCE(SUM(CASE WHEN m.direction='inbound' THEN 1 ELSE 0 END),0)::int AS inbound
       FROM generate_series(CURRENT_DATE - ($2::int - 1), CURRENT_DATE, '1 day') d(day)
       LEFT JOIN messages m ON DATE(m.created_at) = d.day AND m.org_id = $1
       GROUP BY d.day ORDER BY d.day`,
    [req.user!.orgId, days]
  );
  ok(res, { series: rows });
}));

router.get('/campaigns/performance', asyncHandler(async (req, res) => {
  const rows = await many(
    `SELECT id, name, status, total, sent, delivered, read_count, failed,
            CASE WHEN sent > 0 THEN ROUND((read_count::numeric / sent) * 100, 1) ELSE 0 END AS read_rate, created_at
       FROM campaigns WHERE org_id=$1 ORDER BY created_at DESC LIMIT 20`,
    [req.user!.orgId]
  );
  ok(res, { campaigns: rows });
}));

router.get('/contacts/timeseries', asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days || 30)));
  const rows = await many(
    `SELECT TO_CHAR(d.day,'YYYY-MM-DD') AS date, COUNT(c.id)::int AS count
       FROM generate_series(CURRENT_DATE - ($2::int - 1), CURRENT_DATE, '1 day') d(day)
       LEFT JOIN contacts c ON DATE(c.created_at) = d.day AND c.org_id = $1
       GROUP BY d.day ORDER BY d.day`,
    [req.user!.orgId, days]
  );
  ok(res, { series: rows });
}));

router.get('/leads/sources', asyncHandler(async (req, res) => {
  const rows = await many(
    `SELECT source, COUNT(*)::int AS count, COUNT(*) FILTER (WHERE status='won')::int AS won FROM leads WHERE org_id=$1 GROUP BY source ORDER BY count DESC`,
    [req.user!.orgId]
  );
  ok(res, { sources: rows });
}));

router.get('/wallet/spend', asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days || 30)));
  const rows = await many(
    `SELECT TO_CHAR(d.day,'YYYY-MM-DD') AS date,
            COALESCE(SUM(CASE WHEN w.type='debit' THEN w.amount ELSE 0 END),0)::numeric AS spend,
            COALESCE(SUM(CASE WHEN w.type='credit' THEN w.amount ELSE 0 END),0)::numeric AS topup
       FROM generate_series(CURRENT_DATE - ($2::int - 1), CURRENT_DATE, '1 day') d(day)
       LEFT JOIN wallet_transactions w ON DATE(w.created_at)=d.day AND w.org_id=$1
       GROUP BY d.day ORDER BY d.day`,
    [req.user!.orgId, days]
  );
  ok(res, { series: rows });
}));

export default router;
