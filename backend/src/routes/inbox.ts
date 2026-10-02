import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db/pool';
import { ApiError, asyncHandler, ok, pageParams } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { whatsapp, credsFromOrg } from '../services/whatsapp';
import { billing } from '../services/billing';
import { emitToOrg } from '../services/socket';
import { ai } from '../services/openai';
import { nba } from '../services/nba';

const router = Router();
router.use(requireAuth);

router.get('/quick-replies', asyncHandler(async (req, res) => {
  const org = await one<any>(`SELECT settings FROM organizations WHERE id=$1`, [req.user!.orgId]);
  ok(res, { quickReplies: org?.settings?.quickReplies ?? [] });
}));

router.post('/quick-replies', asyncHandler(async (req, res) => {
  const { quickReplies } = z.object({ quickReplies: z.array(z.object({ title: z.string(), text: z.string() })).max(50) }).parse(req.body);
  await query(`UPDATE organizations SET settings = settings || $2::jsonb WHERE id=$1`, [req.user!.orgId, JSON.stringify({ quickReplies })]);
  ok(res, { quickReplies });
}));

router.get('/conversations', asyncHandler(async (req, res) => {
  const { limit, offset, page } = pageParams(req);
  const status = String(req.query.status || '');
  const search = String(req.query.search || '').trim();
  const where = ['c.org_id = $1']; const params: any[] = [req.user!.orgId]; let i = 2;
  if (status) { where.push(`c.status = $${i++}`); params.push(status); }
  if (search) { where.push(`(ct.name ILIKE $${i} OR ct.phone ILIKE $${i})`); params.push(`%${search}%`); i++; }

  const { rows } = await query(
    `SELECT c.*, ct.name AS contact_name, ct.phone AS contact_phone, ct.tags
       FROM conversations c JOIN contacts ct ON ct.id = c.contact_id
      WHERE ${where.join(' AND ')} ORDER BY c.last_message_at DESC LIMIT $${i} OFFSET $${i + 1}`,
    [...params, limit, offset]
  );
  const total = await one<{ count: string }>(`SELECT COUNT(*)::int AS count FROM conversations c JOIN contacts ct ON ct.id=c.contact_id WHERE ${where.join(' AND ')}`, params);
  ok(res, { conversations: rows, pagination: { page, limit, total: Number(total?.count || 0) } });
}));

router.post('/conversations', asyncHandler(async (req, res) => {
  const { contactId } = z.object({ contactId: z.string().uuid() }).parse(req.body);
  const contact = await one<any>(`SELECT * FROM contacts WHERE id=$1 AND org_id=$2`, [contactId, req.user!.orgId]);
  if (!contact) throw ApiError.notFound('Contact not found');
  let conv = await one<any>(`SELECT * FROM conversations WHERE org_id=$1 AND contact_id=$2`, [req.user!.orgId, contactId]);
  if (!conv) conv = await one(`INSERT INTO conversations (org_id, contact_id) VALUES ($1,$2) RETURNING *`, [req.user!.orgId, contactId]);
  ok(res, { conversation: conv, contact });
}));

router.get('/conversations/:id/messages', asyncHandler(async (req, res) => {
  const conv = await one<any>(
    `SELECT c.*, ct.name AS contact_name, ct.phone AS contact_phone, ct.id AS contact_id
       FROM conversations c JOIN contacts ct ON ct.id=c.contact_id WHERE c.id=$1 AND c.org_id=$2`,
    [req.params.id, req.user!.orgId]
  );
  if (!conv) throw ApiError.notFound();
  const limit = Math.min(300, Number(req.query.limit || 100));
  const { rows: messages } = await query(`SELECT * FROM messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT $2`, [req.params.id, limit]);
  await query(`UPDATE conversations SET unread_count=0 WHERE id=$1`, [req.params.id]);

  const lastNba = await one<any>(`SELECT * FROM nba_suggestions WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1`, [req.params.id]);
  ok(res, { conversation: conv, messages: messages.reverse(), nba: lastNba });
}));

router.post('/conversations/:id/messages', asyncHandler(async (req, res) => {
  const body = z.object({
    text: z.string().min(1).max(4096).optional(),
    type: z.enum(['text', 'image', 'video', 'document', 'audio', 'buttons']).default('text'),
    mediaUrl: z.string().url().optional(),
    caption: z.string().max(1024).optional(),
    buttons: z.array(z.object({ id: z.string(), title: z.string() })).optional(),
  }).parse(req.body);

  const conv = await one<any>(
    `SELECT c.*, ct.phone FROM conversations c JOIN contacts ct ON ct.id=c.contact_id WHERE c.id=$1 AND c.org_id=$2`,
    [req.params.id, req.user!.orgId]
  );
  if (!conv) throw ApiError.notFound();
  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  const creds = credsFromOrg(org);
  if (!creds) throw ApiError.badRequest('WhatsApp is not connected');

  const charged = await billing.charge(req.user!.orgId, 'SERVICE', `Agent reply to ${conv.phone}`);
  if (!charged) throw ApiError.badRequest('Insufficient wallet balance');

  let waId: string | null = null;
  try {
    if (body.type === 'text') waId = await whatsapp.sendText(creds, conv.phone, body.text!);
    else if (body.type === 'buttons' && body.buttons?.length) waId = await whatsapp.sendButtons(creds, conv.phone, body.text || 'Choose', body.buttons);
    else if (['image', 'video', 'audio', 'document'].includes(body.type)) waId = await whatsapp.sendMedia(creds, conv.phone, body.type as any, body.mediaUrl!, body.caption);
  } catch (e: any) { throw ApiError.badRequest(`Send failed: ${e.response?.data?.error?.message || e.message}`); }

  const message = await one(
    `INSERT INTO messages (org_id, conversation_id, contact_id, direction, wa_message_id, type, body, media_url, status)
     VALUES ($1,$2,$3,'outbound',$4,$5,$6,$7,'sent') RETURNING *`,
    [req.user!.orgId, conv.id, conv.contact_id, waId, body.type, body.text ?? body.caption ?? '', body.mediaUrl ?? null]
  );
  await query(`UPDATE conversations SET last_message=$2, last_message_at=NOW(), status='open' WHERE id=$1`, [conv.id, (body.text || body.caption || `[${body.type}]`).slice(0, 200)]);

  // Cancel pending follow-ups since agent replied manually
  await query(`UPDATE followup_queue SET status='cancelled_by_reply' WHERE conversation_id = $1 AND status = 'pending'`, [conv.id]);

  emitToOrg(req.user!.orgId, 'message:new', { message, conversationId: conv.id });
  ok(res, { message }, 201);
}));

router.patch('/conversations/:id', asyncHandler(async (req, res) => {
  const body = z.object({
    status: z.enum(['open', 'pending', 'closed']).optional(),
    ai_enabled: z.boolean().optional(),
    assigned_to: z.string().uuid().nullable().optional(),
  }).parse(req.body);
  const fields: string[] = []; const values: any[] = []; let i = 1;
  for (const [k, v] of Object.entries(body)) { if (v === undefined) continue; fields.push(`${k} = $${i++}`); values.push(v); }
  if (!fields.length) throw ApiError.badRequest('Nothing to update');
  values.push(req.params.id, req.user!.orgId);
  const conv = await one(`UPDATE conversations SET ${fields.join(', ')} WHERE id=$${i} AND org_id=$${i + 1} RETURNING *`, values);
  if (!conv) throw ApiError.notFound();
  emitToOrg(req.user!.orgId, 'conversation:updated', { conversation: conv });
  ok(res, { conversation: conv });
}));

router.post('/conversations/:id/summary', asyncHandler(async (req, res) => {
  const { rows } = await query<{ direction: string; body: string }>(
    `SELECT direction, body FROM messages WHERE conversation_id=$1 AND body IS NOT NULL ORDER BY created_at LIMIT 200`,
    [req.params.id]
  );
  if (!rows.length) throw ApiError.badRequest('No messages to summarize');
  const transcript = rows.map((m) => `${m.direction === 'inbound' ? 'Customer' : 'Agent'}: ${m.body}`).join('\n');
  const summary = await ai.summarizeConversation(transcript);
  if (!summary) throw ApiError.badRequest('AI is not configured');
  ok(res, { summary });
}));

router.post('/conversations/:id/nba', asyncHandler(async (req, res) => {
  const suggestion = await nba.suggest(req.user!.orgId, req.params.id);
  if (!suggestion) throw ApiError.badRequest('Could not generate NBA');
  ok(res, { suggestion });
}));

export default router;
