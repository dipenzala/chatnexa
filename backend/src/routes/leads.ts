import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db/pool';
import { ApiError, asyncHandler, ok, pageParams } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { leadScoreQueue } from '../queues';
import { normalizePhone } from '../services/whatsapp';

const router = Router();
router.use(requireAuth);

router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await one(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status='new')::int AS new,
            COUNT(*) FILTER (WHERE status='qualified')::int AS qualified,
            COUNT(*) FILTER (WHERE status='won')::int AS won,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS last_7d,
            COALESCE(AVG(score),0)::int AS avg_score
       FROM leads WHERE org_id=$1`,
    [req.user!.orgId]
  );
  ok(res, { stats });
}));

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = pageParams(req);
  const status = String(req.query.status || '');
  const source = String(req.query.source || '');
  const search = String(req.query.search || '').trim();

  const where = ['org_id = $1']; const params: any[] = [req.user!.orgId]; let i = 2;
  if (status) { where.push(`status = $${i++}`); params.push(status); }
  if (source) { where.push(`source = $${i++}`); params.push(source); }
  if (search) { where.push(`(name ILIKE $${i} OR phone ILIKE $${i} OR email ILIKE $${i})`); params.push(`%${search}%`); i++; }

  const { rows } = await query(
    `SELECT * FROM leads WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
    [...params, limit, offset]
  );
  const total = await one<{ count: string }>(`SELECT COUNT(*)::int AS count FROM leads WHERE ${where.join(' AND ')}`, params);
  ok(res, { leads: rows, pagination: { page, limit, total: Number(total?.count || 0) } });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().optional(),
    phone: z.string().min(8),
    email: z.string().email().optional().or(z.literal('')),
    city: z.string().optional(),
    source: z.string().default('manual'),
    formName: z.string().optional(),
    payload: z.record(z.any()).optional(),
    notes: z.string().optional(),
  }).parse(req.body);

  const phone = normalizePhone(body.phone);
  const lead = await one(
    `INSERT INTO leads (org_id, source, name, phone, email, city, form_name, payload, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user!.orgId, body.source, body.name ?? null, phone, body.email || null, body.city ?? null, body.formName ?? null, JSON.stringify(body.payload ?? {}), body.notes ?? null]
  );
  leadScoreQueue.add('score', { leadId: (lead as any).id, orgId: req.user!.orgId, payload: body.payload ?? {} }).catch(() => {});
  ok(res, { lead }, 201);
}));

router.post('/:id/convert', asyncHandler(async (req, res) => {
  const lead = await one<any>(`SELECT * FROM leads WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  if (!lead) throw ApiError.notFound();
  if (lead.contact_id) throw ApiError.badRequest('Lead already converted');

  let contact = await one<any>(`SELECT * FROM contacts WHERE org_id=$1 AND phone=$2`, [req.user!.orgId, lead.phone]);
  if (!contact) {
    contact = await one(
      `INSERT INTO contacts (org_id, phone, name, email, source, tags, attributes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user!.orgId, lead.phone, lead.name ?? '', lead.email, 'lead', ['lead'], JSON.stringify({ city: lead.city, form: lead.form_name, leadId: lead.id })]
    );
  }
  const conv = await one<any>(
    `INSERT INTO conversations (org_id, contact_id, last_message, last_message_at) VALUES ($1,$2,$3,NOW())
     ON CONFLICT (org_id, contact_id) DO UPDATE SET last_message_at=NOW() RETURNING *`,
    [req.user!.orgId, contact.id, `Lead from ${lead.source}`]
  );
  await query(`UPDATE leads SET contact_id=$2, status='contacted' WHERE id=$1`, [lead.id, contact.id]);
  ok(res, { contact, conversation: conv });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const body = z.object({
    status: z.enum(['new', 'contacted', 'qualified', 'won', 'lost']).optional(),
    notes: z.string().optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    score: z.number().min(0).max(100).optional(),
  }).parse(req.body);

  const fields: string[] = []; const values: any[] = []; let i = 1;
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue;
    fields.push(`${k} = $${i++}`); values.push(v);
  }
  if (!fields.length) throw ApiError.badRequest('Nothing to update');
  values.push(req.params.id, req.user!.orgId);
  const lead = await one(`UPDATE leads SET ${fields.join(', ')} WHERE id=$${i} AND org_id=$${i + 1} RETURNING *`, values);
  if (!lead) throw ApiError.notFound();
  ok(res, { lead });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM leads WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  ok(res);
}));

export default router;
