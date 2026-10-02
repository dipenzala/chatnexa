import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db/pool';
import { ApiError, asyncHandler, ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { ai } from '../services/openai';

const router = Router();
router.use(requireAuth);

router.get('/knowledge', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, title, content, source_url, created_at, (embedding IS NOT NULL) AS indexed FROM knowledge_base WHERE org_id=$1 ORDER BY created_at DESC LIMIT 500`,
    [req.user!.orgId]
  );
  ok(res, { knowledge: rows });
}));

router.post('/knowledge', asyncHandler(async (req, res) => {
  const { title, content, sourceUrl } = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(20000),
    sourceUrl: z.string().url().optional(),
  }).parse(req.body);
  const row = await ai.addKnowledge(req.user!.orgId, title, content, sourceUrl);
  ok(res, { item: row }, 201);
}));

router.post('/knowledge/search', asyncHandler(async (req, res) => {
  const { question, k } = z.object({ question: z.string().min(1), k: z.number().min(1).max(20).default(5) }).parse(req.body);
  const results = await ai.retrieve(req.user!.orgId, question, k);
  ok(res, { results });
}));

router.delete('/knowledge/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM knowledge_base WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  ok(res);
}));

router.post('/test-reply', asyncHandler(async (req, res) => {
  const { message, history } = z.object({
    message: z.string().min(1).max(2000),
    history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).default([]),
  }).parse(req.body);

  const org = await one<any>(`SELECT ai_system_prompt, ai_enabled FROM organizations WHERE id=$1`, [req.user!.orgId]);
  if (!org?.ai_enabled) throw ApiError.badRequest('AI is disabled for this workspace');
  if (!ai.enabled) throw ApiError.badRequest('OPENAI_API_KEY is not configured');

  const result = await ai.generateReply({ orgId: req.user!.orgId, systemPrompt: org.ai_system_prompt || 'You are a helpful assistant.', history, userMessage: message });
  if (!result) throw ApiError.badRequest('AI failed to generate a reply');
  ok(res, result);
}));

router.post('/transcribe', asyncHandler(async (req, res) => {
  const { base64, filename, language } = z.object({
    base64: z.string(), filename: z.string().default('audio.ogg'), language: z.string().optional(),
  }).parse(req.body);
  if (!ai.enabled) throw ApiError.badRequest('OpenAI is not configured');
  const buffer = Buffer.from(base64.replace(/^data:.*?;base64,/, ''), 'base64');
  if (buffer.length > 25 * 1024 * 1024) throw ApiError.badRequest('Audio too large');
  const text = await ai.transcribe(buffer, filename, language);
  if (!text) throw ApiError.badRequest('Transcription failed');
  ok(res, { text });
}));

router.get('/usage', asyncHandler(async (req, res) => {
  const usage = await one(
    `SELECT COUNT(*) FILTER (WHERE ai_generated)::int AS ai_messages, COUNT(*)::int AS total_messages, COALESCE(SUM(cost),0)::numeric AS total_cost
       FROM messages WHERE org_id=$1 AND created_at > NOW() - INTERVAL '30 days'`,
    [req.user!.orgId]
  );
  const kb = await one<{ count: string }>(`SELECT COUNT(*)::int AS count FROM knowledge_base WHERE org_id=$1`, [req.user!.orgId]);
  ok(res, { usage, knowledgeItems: Number(kb?.count || 0), aiConfigured: ai.enabled });
}));

export default router;
