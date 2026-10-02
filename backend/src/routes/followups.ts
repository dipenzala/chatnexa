import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db/pool';
import { ApiError, asyncHandler, ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/sequences', asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT * FROM followup_sequences WHERE org_id = $1 ORDER BY created_at DESC`, [req.user!.orgId]);
  ok(res, { sequences: rows });
}));

router.post('/sequences', asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(80),
    trigger_stage: z.enum(['cold', 'warm', 'hot', 'closing']).default('warm'),
    steps: z.array(z.object({ delay_hours: z.number().min(1), prompt: z.string().min(1) })).min(1).max(6),
  }).parse(req.body);

  const row = await one(
    `INSERT INTO followup_sequences (org_id, name, trigger_stage, steps) VALUES ($1,$2,$3,$4::jsonb) RETURNING *`,
    [req.user!.orgId, body.name, body.trigger_stage, JSON.stringify(body.steps)]
  );
  ok(res, { sequence: row }, 201);
}));

router.post('/sequences/:id/toggle', asyncHandler(async (req, res) => {
  const seq = await one<any>(`SELECT * FROM followup_sequences WHERE id = $1 AND org_id = $2`, [req.params.id, req.user!.orgId]);
  if (!seq) throw ApiError.notFound();
  const row = await one(`UPDATE followup_sequences SET is_active = NOT is_active WHERE id = $1 RETURNING *`, [req.params.id]);
  ok(res, { sequence: row });
}));

router.delete('/sequences/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM followup_sequences WHERE id = $1 AND org_id = $2`, [req.params.id, req.user!.orgId]);
  ok(res);
}));

router.get('/queue', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT fq.*, ct.name AS contact_name, ct.phone AS contact_phone, c.deal_score
       FROM followup_queue fq
       JOIN conversations c ON c.id = fq.conversation_id
       JOIN contacts ct ON ct.id = c.contact_id
      WHERE fq.org_id = $1 AND fq.status IN ('pending','sent')
      ORDER BY fq.scheduled_at ASC LIMIT 100`,
    [req.user!.orgId]
  );
  ok(res, { queue: rows });
}));

/** Manual schedule — used when agent clicks "Schedule follow-up" */
router.post('/schedule/:conversationId', asyncHandler(async (req, res) => {
  const { sequenceId } = z.object({ sequenceId: z.string().uuid() }).parse(req.body);
  const conv = await one<any>(`SELECT * FROM conversations WHERE id = $1 AND org_id = $2`, [req.params.conversationId, req.user!.orgId]);
  if (!conv) throw ApiError.notFound('Conversation not found');

  const seq = await one<any>(`SELECT * FROM followup_sequences WHERE id = $1 AND org_id = $2`, [sequenceId, req.user!.orgId]);
  if (!seq) throw ApiError.notFound('Sequence not found');

  const firstStep = (seq.steps as any[])[0];
  const delayMs = (firstStep?.delay_hours || 24) * 3600 * 1000;
  const row = await one(
    `INSERT INTO followup_queue (org_id, conversation_id, sequence_id, step_index, scheduled_at)
     VALUES ($1,$2,$3,0,NOW() + ($4 || ' milliseconds')::interval) RETURNING *`,
    [req.user!.orgId, conv.id, seq.id, delayMs]
  );
  ok(res, { queued: row }, 201);
}));

export default router;
