import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db/pool';
import { ApiError, asyncHandler, ok, pageParams } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { whatsapp, credsFromOrg } from '../services/whatsapp';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const { limit, offset, page } = pageParams(req);
  const status = String(req.query.status || '');
  const where = ['org_id = $1']; const params: any[] = [req.user!.orgId];
  if (status) { where.push(`meta_status = $2`); params.push(status); }

  const { rows } = await query(
    `SELECT * FROM templates WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const total = await one<{ count: string }>(`SELECT COUNT(*)::int AS count FROM templates WHERE ${where.join(' AND ')}`, params);
  ok(res, { templates: rows, pagination: { page, limit, total: Number(total?.count || 0) } });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/),
    category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).default('MARKETING'),
    language: z.string().default('en'),
    headerType: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional(),
    headerText: z.string().optional(),
    headerMediaUrl: z.string().url().optional(),
    body: z.string().min(1).max(1024),
    footer: z.string().max(60).optional(),
    buttons: z.array(z.object({ type: z.string(), text: z.string(), url: z.string().optional(), phone_number: z.string().optional() })).optional(),
    submitToMeta: z.boolean().optional(),
  }).parse(req.body);

  const variables = Array.from(new Set(body.body.match(/\{\{\d+\}\}/g) || []));
  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);

  let metaId: string | null = null; let metaStatus = 'DRAFT';

  if (body.submitToMeta && org.wa_business_id) {
    const creds = credsFromOrg(org);
    if (!creds) throw ApiError.badRequest('Connect WhatsApp first');

    const components: any[] = [];
    if (body.headerType) components.push(body.headerType === 'TEXT'
      ? { type: 'HEADER', format: 'TEXT', text: body.headerText || '' }
      : { type: 'HEADER', format: body.headerType, example: { header_handle: [body.headerMediaUrl] } });
    components.push({ type: 'BODY', text: body.body, ...(variables.length ? { example: { body_text: [variables.map((_, i) => `sample${i + 1}`)] } } : {}) });
    if (body.footer) components.push({ type: 'FOOTER', text: body.footer });
    if (body.buttons?.length) components.push({ type: 'BUTTONS', buttons: body.buttons.map((b) => ({ type: b.type || 'QUICK_REPLY', text: b.text, ...(b.url ? { url: b.url } : {}), ...(b.phone_number ? { phone_number: b.phone_number } : {}) })) });

    const created = await whatsapp.createTemplate(creds, org.wa_business_id, { name: body.name, language: body.language, category: body.category, components });
    metaId = created?.id ?? null;
    metaStatus = created?.status ?? 'PENDING';
  }

  const template = await one(
    `INSERT INTO templates (org_id, name, category, language, header_type, header_text, header_media_url, body, footer, buttons, variables, meta_template_id, meta_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [req.user!.orgId, body.name, body.category, body.language, body.headerType ?? null, body.headerText ?? null, body.headerMediaUrl ?? null, body.body, body.footer ?? null, JSON.stringify(body.buttons ?? []), variables, metaId, metaStatus]
  );
  ok(res, { template }, 201);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const t = await one(`SELECT * FROM templates WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  if (!t) throw ApiError.notFound();
  ok(res, { template: t });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const body = z.object({
    body: z.string().min(1).max(1024).optional(),
    footer: z.string().max(60).optional(),
    headerText: z.string().optional(),
    category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).optional(),
  }).parse(req.body);

  const fields: string[] = []; const values: any[] = []; let i = 1;
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue;
    const col = k === 'headerText' ? 'header_text' : k;
    fields.push(`${col} = $${i++}`); values.push(v);
  }
  if (!fields.length) throw ApiError.badRequest('Nothing to update');
  values.push(req.params.id, req.user!.orgId);
  const t = await one(`UPDATE templates SET ${fields.join(', ')} WHERE id=$${i} AND org_id=$${i + 1} RETURNING *`, values);
  if (!t) throw ApiError.notFound();
  ok(res, { template: t });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const t = await one<any>(`SELECT * FROM templates WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  if (!t) throw ApiError.notFound();

  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  const creds = credsFromOrg(org);
  if (creds && org.wa_business_id && t.name) {
    try {
      await (await import('axios')).default.delete(`https://graph.facebook.com/v19.0/${org.wa_business_id}/message_templates`, {
        params: { name: t.name }, headers: { Authorization: `Bearer ${creds.accessToken}` },
      });
    } catch { /* ignore */ }
  }
  await query(`DELETE FROM templates WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  ok(res);
}));

export default router;
