import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db/pool';
import { ApiError, asyncHandler, ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { dealAI } from '../services/deal-ai';
import { nba } from '../services/nba';

const router = Router();
router.use(requireAuth);

router.post('/analyze/:conversationId', asyncHandler(async (req, res) => {
  const signal = await dealAI.analyze(req.user!.orgId, req.params.conversationId);
  if (!signal) throw ApiError.badRequest('AI not configured or not enough messages');
  ok(res, { signal });
}));

router.get('/hot', asyncHandler(async (req, res) => {
  const rows = await many(
    `SELECT c.id, c.deal_score, c.deal_stage, c.deal_reason, c.last_message, c.last_message_at,
            ct.name AS contact_name, ct.phone AS contact_phone
       FROM conversations c JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.org_id = $1 AND c.deal_score >= 60
      ORDER BY c.deal_score DESC LIMIT 30`,
    [req.user!.orgId]
  );
  ok(res, { hot: rows });
}));

router.get('/pipeline', asyncHandler(async (req, res) => {
  const rows = await many(
    `SELECT c.id, c.deal_score, c.pipeline_stage, c.pipeline_value, c.expected_close_date,
            c.deal_stage, c.last_message_at,
            ct.name AS contact_name, ct.phone AS contact_phone
       FROM conversations c JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.org_id = $1
      ORDER BY c.deal_score DESC NULLS LAST, c.last_message_at DESC`,
    [req.user!.orgId]
  );
  ok(res, { deals: rows });
}));

router.patch('/pipeline/:conversationId', asyncHandler(async (req, res) => {
  const body = z.object({
    pipeline_stage: z.enum(['new', 'qualified', 'demo_done', 'proposal_sent', 'negotiating', 'payment_pending', 'won', 'lost']).optional(),
    pipeline_value: z.number().nullable().optional(),
    expected_close_date: z.string().nullable().optional(),
  }).parse(req.body);

  const fields: string[] = []; const values: any[] = []; let i = 1;
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue;
    fields.push(`${k} = $${i++}`); values.push(v);
  }
  if (!fields.length) throw ApiError.badRequest('Nothing to update');
  values.push(req.params.conversationId, req.user!.orgId);
  const row = await one(`UPDATE conversations SET ${fields.join(', ')} WHERE id = $${i} AND org_id = $${i + 1} RETURNING *`, values);
  if (!row) throw ApiError.notFound();
  ok(res, { deal: row });
}));

router.post('/nba/:conversationId', asyncHandler(async (req, res) => {
  const suggestion = await nba.suggest(req.user!.orgId, req.params.conversationId);
  if (!suggestion) throw ApiError.badRequest('Could not generate suggestion');
  ok(res, { suggestion });
}));

router.post('/nba/accept/:id', asyncHandler(async (req, res) => {
  await query(`UPDATE nba_suggestions SET accepted = TRUE WHERE id = $1 AND org_id = $2`, [req.params.id, req.user!.orgId]);
  ok(res, { accepted: true });
}));

export default router;
