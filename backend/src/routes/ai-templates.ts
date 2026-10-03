import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db/pool';
import { ApiError, asyncHandler, ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { openai } from '../services/openai';

const router = Router();
router.use(requireAuth);

router.post('/generate', asyncHandler(async (req, res) => {
  const body = z.object({
    requirement: z.string().min(10).max(1000),
    category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).default('MARKETING'),
    language: z.enum(['en', 'hi', 'hinglish']).default('hinglish'),
  }).parse(req.body);

  if (!openai) throw ApiError.badRequest('OpenAI not configured');

  const org = await one<any>(`SELECT name FROM organizations WHERE id = $1`, [req.user!.orgId]);

  const prompt = `Create Meta WhatsApp Business template. Requirement: "${body.requirement}". Category: ${body.category}. Language: ${body.language}. Business: ${org?.name || 'Business'}.

Rules: name lowercase+underscores. Body uses {{1}} {{2}}. Under 1024 chars.

Return JSON: {"name":"tpl_name","language":"en","header":{"type":"NONE","text":""},"body":"...","footer":"","buttons":[],"variables":[{"position":1,"example":"sample","description":"what"}]}`;

  try {
    const r = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Generate WhatsApp templates. Return JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4, response_format: { type: 'json_object' }, max_tokens: 800,
    });

    const parsed = JSON.parse(r.choices[0]?.message?.content || '{}');
    if (!parsed.body) throw new Error('No body generated');

    const saved = await one(
      `INSERT INTO ai_templates (org_id, requirement, category, language, generated_name, generated_body, generated_header, generated_footer, generated_buttons, variables)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb) RETURNING *`,
      [req.user!.orgId, body.requirement, body.category, body.language, parsed.name || 'tpl', parsed.body, parsed.header?.text || null, parsed.footer || null, JSON.stringify(parsed.buttons || []), JSON.stringify(parsed.variables || [])]
    );
    ok(res, { template: parsed, saved }, 201);
  } catch (e: any) {
    throw ApiError.badRequest(`Generation failed: ${e.message}`);
  }
}));

router.get('/generated', asyncHandler(async (req, res) => {
  const rows = await many(`SELECT * FROM ai_templates WHERE org_id = $1 ORDER BY created_at DESC LIMIT 100`, [req.user!.orgId]);
  ok(res, { templates: rows });
}));

router.post('/generated/:id/save', asyncHandler(async (req, res) => {
  const ai = await one<any>(`SELECT * FROM ai_templates WHERE id = $1 AND org_id = $2`, [req.params.id, req.user!.orgId]);
  if (!ai) throw ApiError.notFound();
  const template = await one(
    `INSERT INTO templates (org_id, name, category, language, header_type, header_text, body, footer, buttons, variables, meta_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,'DRAFT') RETURNING *`,
    [req.user!.orgId, ai.generated_name, ai.category, ai.language, ai.generated_header ? 'TEXT' : null, ai.generated_header, ai.generated_body, ai.generated_footer, JSON.stringify(ai.generated_buttons || []), []]
  );
  await query(`UPDATE ai_templates SET saved_as_template_id = $2 WHERE id = $1`, [ai.id, (template as any).id]);
  ok(res, { template }, 201);
}));

export default router;
