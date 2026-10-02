import { Router } from 'express';
import { z } from 'zod';
import { many, one, query, tx } from '../db/pool';
import { ApiError, asyncHandler, ok, pageParams } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { enqueueCampaign, campaignQueue } from '../queues';
import { billing } from '../services/billing';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = pageParams(req);
  const status = String(req.query.status || '');
  const where = ['org_id = $1']; const params: any[] = [req.user!.orgId];
  if (status) { where.push(`status = $2`); params.push(status); }

  const { rows } = await query(
    `SELECT * FROM campaigns WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const total = await one<{ count: string }>(`SELECT COUNT(*)::int AS count FROM campaigns WHERE ${where.join(' AND ')}`, params);
  ok(res, { campaigns: rows, pagination: { page, limit, total: Number(total?.count || 0) } });
}));

router.post('/estimate', asyncHandler(async (req, res) => {
  const { templateId, audience } = z.object({
    templateId: z.string().uuid(),
    audience: z.object({ tags: z.array(z.string()).optional(), all: z.boolean().optional() }).default({}),
  }).parse(req.body);

  const template = await one<any>(`SELECT * FROM templates WHERE id=$1 AND org_id=$2`, [templateId, req.user!.orgId]);
  if (!template) throw ApiError.notFound('Template not found');

  const where = ['org_id = $1', 'opt_in = TRUE', 'blocked = FALSE']; const params: any[] = [req.user!.orgId];
  if (audience.tags?.length) { where.push(`tags && $2::text[]`); params.push(audience.tags); }
  const count = await one<{ count: string }>(`SELECT COUNT(*)::int AS count FROM contacts WHERE ${where.join(' AND ')}`, params);
  const n = Number(count?.count || 0);
  const unit = billing.priceFor(template.category);
  ok(res, { recipients: n, unitPrice: unit, estimatedCost: Number((n * unit).toFixed(2)), walletBalance: await billing.balance(req.user!.orgId) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(120),
    templateId: z.string().uuid(),
    variables: z.record(z.string()).default({}),
    audience: z.object({
      tags: z.array(z.string()).optional(),
      contactIds: z.array(z.string().uuid()).optional(),
      all: z.boolean().optional(),
    }).default({}),
    scheduledAt: z.string().datetime().optional(),
    sendNow: z.boolean().default(true),
  }).parse(req.body);

  const template = await one<any>(`SELECT * FROM templates WHERE id=$1 AND org_id=$2`, [body.templateId, req.user!.orgId]);
  if (!template) throw ApiError.notFound('Template not found');

  let contactIds: string[] = body.audience.contactIds ?? [];
  if (!contactIds.length) {
    const where = ['org_id = $1', 'opt_in = TRUE', 'blocked = FALSE']; const params: any[] = [req.user!.orgId];
    if (body.audience.tags?.length) { where.push(`tags && $2::text[]`); params.push(body.audience.tags); }
    const rows = await many<{ id: string }>(`SELECT id FROM contacts WHERE ${where.join(' AND ')}`, params);
    contactIds = rows.map((r) => r.id);
  }
  if (!contactIds.length) throw ApiError.badRequest('No contacts match this audience');

  const campaign = await tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO campaigns (org_id, name, template_id, template_name, language, variables, audience, status, scheduled_at, total, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.user!.orgId, body.name, template.id, template.name, template.language, JSON.stringify(body.variables), JSON.stringify(body.audience), body.scheduledAt ? 'scheduled' : 'draft', body.scheduledAt ?? null, contactIds.length, req.user!.id]
    );

    const CHUNK = 500;
    for (let i = 0; i < contactIds.length; i += CHUNK) {
      const slice = contactIds.slice(i, i + CHUNK);
      const values = slice.map((_, idx) => `($1,$2,$${idx + 3})`).join(',');
      await c.query(`INSERT INTO campaign_recipients (campaign_id, org_id, contact_id) VALUES ${values} ON CONFLICT DO NOTHING`, [rows[0].id, req.user!.orgId, ...slice]);
    }
    return rows[0];
  });

  const balance = await billing.balance(req.user!.orgId);
  const estimated = contactIds.length * billing.priceFor(template.category);

  if (body.sendNow && !body.scheduledAt) {
    if (balance < estimated) throw ApiError.badRequest(`Insufficient wallet balance. Need ₹${estimated.toFixed(2)}, have ₹${balance.toFixed(2)}.`);
    await enqueueCampaign(campaign.id, req.user!.orgId);
  } else if (body.scheduledAt) {
    const delay = Math.max(0, new Date(body.scheduledAt).getTime() - Date.now());
    await enqueueCampaign(campaign.id, req.user!.orgId, delay);
  }

  ok(res, { campaign, estimatedCost: Number(estimated.toFixed(2)), walletBalance: balance }, 201);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const c = await one(`SELECT * FROM campaigns WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  if (!c) throw ApiError.notFound();
  const { rows: recipients } = await query(
    `SELECT cr.*, ct.phone, ct.name FROM campaign_recipients cr JOIN contacts ct ON ct.id = cr.contact_id WHERE cr.campaign_id=$1 ORDER BY cr.status, ct.name LIMIT 500`,
    [req.params.id]
  );
  ok(res, { campaign: c, recipients });
}));

router.post('/:id/start', asyncHandler(async (req, res) => {
  const c = await one<any>(`SELECT * FROM campaigns WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  if (!c) throw ApiError.notFound();
  if (c.status === 'running') throw ApiError.badRequest('Campaign already running');
  await query(`UPDATE campaigns SET status='running' WHERE id=$1`, [c.id]);
  await enqueueCampaign(c.id, req.user!.orgId);
  ok(res, { started: true });
}));

router.post('/:id/pause', asyncHandler(async (req, res) => {
  await query(`UPDATE campaigns SET status='paused' WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  ok(res, { paused: true });
}));

router.post('/:id/resume', asyncHandler(async (req, res) => {
  const c = await one<any>(`SELECT * FROM campaigns WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  if (!c) throw ApiError.notFound();
  await query(`UPDATE campaigns SET status='running' WHERE id=$1`, [c.id]);
  await enqueueCampaign(c.id, req.user!.orgId);
  ok(res, { resumed: true });
}));

router.post('/:id/cancel', asyncHandler(async (req, res) => {
  await query(`UPDATE campaigns SET status='failed', completed_at=NOW() WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  const job = await campaignQueue.getJob(`campaign:${req.params.id}`);
  if (job) await job.remove().catch(() => {});
  ok(res, { cancelled: true });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM campaigns WHERE id=$1 AND org_id=$2 AND status IN ('draft','failed','completed')`, [req.params.id, req.user!.orgId]);
  if (!r.rowCount) throw ApiError.badRequest('Only draft, failed or completed campaigns can be deleted');
  ok(res);
}));

export default router;
