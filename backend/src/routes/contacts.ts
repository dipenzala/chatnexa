import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db/pool';
import { ApiError, asyncHandler, ok, pageParams } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { normalizePhone } from '../services/whatsapp';

const router = Router();
router.use(requireAuth);

// IMPORTANT: specific routes BEFORE /:id
router.get('/meta/tags', asyncHandler(async (req, res) => {
  const rows = await many<{ tag: string }>(`SELECT DISTINCT unnest(tags) AS tag FROM contacts WHERE org_id=$1 ORDER BY tag`, [req.user!.orgId]);
  ok(res, { tags: rows.map((r) => r.tag) });
}));

router.get('/meta/stats', asyncHandler(async (req, res) => {
  const stats = await one(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE opt_in)::int AS opted_in,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS new_30d,
            COUNT(*) FILTER (WHERE blocked)::int AS blocked
       FROM contacts WHERE org_id=$1`,
    [req.user!.orgId]
  );
  ok(res, { stats });
}));

router.post('/import', asyncHandler(async (req, res) => {
  const { contacts, tags } = z.object({
    contacts: z.array(z.object({
      phone: z.string(),
      name: z.string().optional(),
      email: z.string().optional(),
      attributes: z.record(z.any()).optional(),
    })).min(1).max(10000),
    tags: z.array(z.string()).optional(),
  }).parse(req.body);

  let inserted = 0, updated = 0, skipped = 0;
  for (const c of contacts) {
    const phone = normalizePhone(c.phone);
    if (!phone || phone.length < 10) { skipped++; continue; }
    const existing = await one<{ id: string }>(`SELECT id FROM contacts WHERE org_id=$1 AND phone=$2`, [req.user!.orgId, phone]);
    if (existing) {
      await query(
        `UPDATE contacts SET name=COALESCE(NULLIF($2,''),name), email=COALESCE(NULLIF($3,''),email),
           tags = (SELECT ARRAY(SELECT DISTINCT unnest(tags || $4::text[]))),
           attributes = attributes || $5::jsonb WHERE id=$1`,
        [existing.id, c.name ?? '', c.email ?? '', tags ?? [], JSON.stringify(c.attributes ?? {})]
      );
      updated++;
    } else {
      await query(
        `INSERT INTO contacts (org_id, phone, name, email, tags, attributes, source) VALUES ($1,$2,$3,$4,$5,$6,'import')`,
        [req.user!.orgId, phone, c.name ?? '', c.email || null, tags ?? [], JSON.stringify(c.attributes ?? {})]
      );
      inserted++;
    }
  }
  ok(res, { inserted, updated, skipped, total: contacts.length });
}));

router.post('/bulk-delete', asyncHandler(async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.string().uuid()).min(1).max(1000) }).parse(req.body);
  const r = await query(`DELETE FROM contacts WHERE id = ANY($1::uuid[]) AND org_id=$2`, [ids, req.user!.orgId]);
  ok(res, { deleted: r.rowCount });
}));

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = pageParams(req);
  const search = String(req.query.search || '').trim();
  const tag = String(req.query.tag || '').trim();

  const where: string[] = ['org_id = $1']; const params: any[] = [req.user!.orgId]; let i = 2;
  if (search) { where.push(`(phone ILIKE $${i} OR name ILIKE $${i} OR email ILIKE $${i})`); params.push(`%${search}%`); i++; }
  if (tag) { where.push(`$${i} = ANY(tags)`); params.push(tag); i++; }
  const clause = where.join(' AND ');

  const { rows } = await query(`SELECT * FROM contacts WHERE ${clause} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`, [...params, limit, offset]);
  const total = await one<{ count: string }>(`SELECT COUNT(*)::int AS count FROM contacts WHERE ${clause}`, params);
  ok(res, { contacts: rows, pagination: { page, limit, total: Number(total?.count || 0) } });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = z.object({
    phone: z.string().min(8),
    name: z.string().max(120).optional(),
    email: z.string().email().optional().or(z.literal('')),
    tags: z.array(z.string()).optional(),
    attributes: z.record(z.any()).optional(),
    source: z.string().optional(),
    opt_in: z.boolean().optional(),
  }).parse(req.body);

  const phone = normalizePhone(body.phone);
  if (!phone || phone.length < 10) throw ApiError.badRequest('Invalid phone number');

  const existing = await one(`SELECT id FROM contacts WHERE org_id=$1 AND phone=$2`, [req.user!.orgId, phone]);
  if (existing) throw ApiError.conflict('Contact with this phone already exists');

  const contact = await one(
    `INSERT INTO contacts (org_id, phone, name, email, tags, attributes, source, opt_in)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.user!.orgId, phone, body.name ?? '', body.email || null, body.tags ?? [], JSON.stringify(body.attributes ?? {}), body.source ?? 'manual', body.opt_in ?? true]
  );
  ok(res, { contact }, 201);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const contact = await one(`SELECT * FROM contacts WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  if (!contact) throw ApiError.notFound('Contact not found');
  const { rows: messages } = await query(`SELECT * FROM messages WHERE contact_id=$1 AND org_id=$2 ORDER BY created_at DESC LIMIT 100`, [req.params.id, req.user!.orgId]);
  const { rows: leads } = await query(`SELECT * FROM leads WHERE contact_id=$1 ORDER BY created_at DESC`, [req.params.id]);
  const { rows: payments } = await query(`SELECT * FROM payments WHERE contact_id=$1 ORDER BY created_at DESC`, [req.params.id]);
  ok(res, { contact, messages, leads, payments });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().max(120).optional(),
    email: z.string().email().optional().or(z.literal('')),
    tags: z.array(z.string()).optional(),
    attributes: z.record(z.any()).optional(),
    opt_in: z.boolean().optional(),
    blocked: z.boolean().optional(),
  }).parse(req.body);

  const fields: string[] = []; const values: any[] = []; let i = 1;
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue;
    fields.push(`${k} = $${i++}`);
    values.push(k === 'attributes' ? JSON.stringify(v) : v);
  }
  if (!fields.length) throw ApiError.badRequest('Nothing to update');
  values.push(req.params.id, req.user!.orgId);

  const contact = await one(`UPDATE contacts SET ${fields.join(', ')} WHERE id=$${i} AND org_id=$${i + 1} RETURNING *`, values);
  if (!contact) throw ApiError.notFound('Contact not found');
  ok(res, { contact });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const r = await query(`DELETE FROM contacts WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  if (!r.rowCount) throw ApiError.notFound();
  ok(res);
}));

export default router;
