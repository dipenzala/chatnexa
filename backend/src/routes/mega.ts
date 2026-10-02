import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db/pool';
import { ApiError, asyncHandler, ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { ragExtractor } from '../services/rag-extractor';
import { keywordReply } from '../services/keyword-reply';
import { sentiment } from '../services/sentiment';
import { sendTime } from '../services/send-time';
import { voiceNotes } from '../services/voice-notes';
import { journey } from '../services/journey';
import { contactMerge } from '../services/contact-merge';
import { gstInvoice } from '../services/gst-invoice';
import { ai } from '../services/openai';
import { storage } from '../services/cloudinary';

const router = Router();
router.use(requireAuth);

/* ============================================================
   1. RAG FILE UPLOAD
============================================================ */
router.post('/rag/upload', asyncHandler(async (req, res) => {
  const { base64, filename, mime } = z.object({
    base64: z.string().min(10),
    filename: z.string().min(1),
    mime: z.string().default('application/octet-stream'),
  }).parse(req.body);

  const buffer = Buffer.from(base64.replace(/^data:.*?;base64,/, ''), 'base64');
  if (buffer.length > 10 * 1024 * 1024) throw ApiError.badRequest('File too large (max 10MB)');

  const text = await ragExtractor.extract(buffer, mime, filename);
  if (!text || text.length < 20) throw ApiError.badRequest('File has no readable text content');

  // Split into chunks of ~1000 words and add to knowledge base
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 50);
  const chunks: string[] = [];
  let current = '';
  for (const p of paragraphs) {
    if ((current + '\n\n' + p).length > 4000) {
      if (current) chunks.push(current);
      current = p;
    } else {
      current = current ? current + '\n\n' + p : p;
    }
  }
  if (current) chunks.push(current);

  if (!chunks.length) chunks.push(text.slice(0, 4000));

  const inserted: any[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const title = `${filename} — Part ${i + 1}`;
    try {
      const item = await ai.addKnowledge(req.user!.orgId, title, chunks[i], undefined);
      // Mark source metadata
      await query(
        `UPDATE knowledge_base SET source_type = 'file', source_filename = $2, word_count = $3 WHERE id = $1`,
        [(item as any).id, filename, chunks[i].split(/\s+/).length]
      );
      inserted.push(item);
    } catch (e: any) {
      // Skip individual failures
    }
  }

  ok(res, { chunks: inserted.length, totalWords: text.split(/\s+/).length, filename }, 201);
}));

router.post('/rag/upload-url', asyncHandler(async (req, res) => {
  const { url } = z.object({ url: z.string().url() }).parse(req.body);
  const text = await ragExtractor.extractFromUrl(url);
  if (!text || text.length < 50) throw ApiError.badRequest('URL has no readable content');

  const chunks = text.match(/[\s\S]{1,3000}/g) || [];
  let inserted = 0;
  for (let i = 0; i < Math.min(chunks.length, 20); i++) {
    try {
      const item = await ai.addKnowledge(req.user!.orgId, `${url.slice(0, 60)} — Part ${i + 1}`, chunks[i], url);
      await query(`UPDATE knowledge_base SET source_type='url', source_filename=$2 WHERE id=$1`, [(item as any).id, url]);
      inserted++;
    } catch {}
  }
  ok(res, { chunks: inserted, totalWords: text.split(/\s+/).length, url }, 201);
}));

/* ============================================================
   2. KEYWORD AUTO-REPLY
============================================================ */
router.get('/keywords', asyncHandler(async (req, res) => {
  const rows = await many(`SELECT * FROM keyword_replies WHERE org_id=$1 ORDER BY priority DESC, created_at DESC`, [req.user!.orgId]);
  ok(res, { keywords: rows });
}));

router.post('/keywords', asyncHandler(async (req, res) => {
  const body = z.object({
    keyword: z.string().min(1).max(100),
    match_type: z.enum(['contains', 'exact', 'starts_with']).default('contains'),
    reply_text: z.string().min(1).max(2000),
    priority: z.number().min(0).max(100).default(0),
  }).parse(req.body);

  const row = await one(
    `INSERT INTO keyword_replies (org_id, keyword, match_type, reply_text, priority) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user!.orgId, body.keyword, body.match_type, body.reply_text, body.priority]
  );
  ok(res, { keyword: row }, 201);
}));

router.patch('/keywords/:id', asyncHandler(async (req, res) => {
  const body = z.object({
    keyword: z.string().optional(),
    match_type: z.enum(['contains', 'exact', 'starts_with']).optional(),
    reply_text: z.string().optional(),
    is_active: z.boolean().optional(),
    priority: z.number().optional(),
  }).parse(req.body);

  const fields: string[] = []; const values: any[] = []; let i = 1;
  for (const [k, v] of Object.entries(body)) { if (v === undefined) continue; fields.push(`${k}=$${i++}`); values.push(v); }
  if (!fields.length) throw ApiError.badRequest('Nothing to update');
  values.push(req.params.id, req.user!.orgId);
  const row = await one(`UPDATE keyword_replies SET ${fields.join(', ')} WHERE id=$${i} AND org_id=$${i + 1} RETURNING *`, values);
  ok(res, { keyword: row });
}));

router.delete('/keywords/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM keyword_replies WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  ok(res);
}));

/* ============================================================
   3. SENTIMENT ALERTS
============================================================ */
router.get('/sentiment/alerts', asyncHandler(async (req, res) => {
  const rows = await many(
    `SELECT sa.*, c.name AS contact_name, c.phone AS contact_phone
       FROM sentiment_alerts sa JOIN contacts c ON c.id = sa.contact_id
      WHERE sa.org_id=$1 AND sa.resolved=FALSE ORDER BY sa.created_at DESC LIMIT 50`,
    [req.user!.orgId]
  );
  ok(res, { alerts: rows });
}));

router.post('/sentiment/alerts/:id/resolve', asyncHandler(async (req, res) => {
  await query(`UPDATE sentiment_alerts SET resolved=TRUE WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  ok(res, { resolved: true });
}));

/* ============================================================
   4. A/B TESTING
============================================================ */
router.get('/ab-tests', asyncHandler(async (req, res) => {
  const rows = await many(`SELECT * FROM ab_tests WHERE org_id=$1 ORDER BY created_at DESC`, [req.user!.orgId]);
  ok(res, { tests: rows });
}));

router.post('/ab-tests', asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1),
    template_a: z.string().min(1),
    template_b: z.string().min(1),
    split_pct: z.number().min(10).max(90).default(50),
    audience: z.object({ tags: z.array(z.string()).optional() }).default({}),
  }).parse(req.body);

  const row = await one(
    `INSERT INTO ab_tests (org_id, name, template_a, template_b, split_pct, audience, status)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,'draft') RETURNING *`,
    [req.user!.orgId, body.name, body.template_a, body.template_b, body.split_pct, JSON.stringify(body.audience)]
  );
  ok(res, { test: row }, 201);
}));

router.post('/ab-tests/:id/start', asyncHandler(async (req, res) => {
  await query(`UPDATE ab_tests SET status='running' WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  ok(res, { started: true });
}));

router.get('/ab-tests/:id/results', asyncHandler(async (req, res) => {
  const test = await one<any>(`SELECT * FROM ab_tests WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  if (!test) throw ApiError.notFound();

  const a = test.variant_a as any;
  const b = test.variant_b as any;
  const aRate = a.sent > 0 ? (a.read / a.sent) * 100 : 0;
  const bRate = b.sent > 0 ? (b.read / b.sent) * 100 : 0;

  ok(res, {
    test,
    results: {
      variant_a: { ...a, read_rate: Number(aRate.toFixed(1)) },
      variant_b: { ...b, read_rate: Number(bRate.toFixed(1)) },
      winner: a.sent > 10 && b.sent > 10 ? (aRate > bRate ? 'A' : 'B') : null,
    },
  });
}));

/* ============================================================
   5. SAVED REPLIES
============================================================ */
router.get('/saved-replies', asyncHandler(async (req, res) => {
  const rows = await many(`SELECT * FROM saved_replies WHERE org_id=$1 ORDER BY uses DESC, created_at DESC`, [req.user!.orgId]);
  ok(res, { replies: rows });
}));

router.post('/saved-replies', asyncHandler(async (req, res) => {
  const body = z.object({
    title: z.string().min(1).max(80),
    body: z.string().min(1).max(2000),
    shortcut: z.string().max(20).optional(),
    category: z.string().default('general'),
  }).parse(req.body);

  const row = await one(
    `INSERT INTO saved_replies (org_id, title, body, shortcut, category, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user!.orgId, body.title, body.body, body.shortcut || null, body.category, req.user!.id]
  );
  ok(res, { reply: row }, 201);
}));

router.post('/saved-replies/:id/use', asyncHandler(async (req, res) => {
  await query(`UPDATE saved_replies SET uses = uses + 1 WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  ok(res, { counted: true });
}));

router.delete('/saved-replies/:id', asyncHandler(async (req, res) => {
  await query(`DELETE FROM saved_replies WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  ok(res);
}));

/* ============================================================
   6. SMART SEND TIME
============================================================ */
router.post('/send-time/preview', asyncHandler(async (req, res) => {
  const { contactIds } = z.object({ contactIds: z.array(z.string().uuid()).min(1).max(5000) }).parse(req.body);
  const groups = await sendTime.groupByHour(req.user!.orgId, contactIds);
  ok(res, { groups });
}));

/* ============================================================
   7. VOICE NOTES
============================================================ */
router.post('/voice-notes/generate', asyncHandler(async (req, res) => {
  const body = z.object({
    text: z.string().min(1).max(1000),
    voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).default('alloy'),
  }).parse(req.body);

  const result = await voiceNotes.generate(body.text, body.voice);
  const row = await one(
    `INSERT INTO voice_notes (org_id, text_content, audio_url, voice, duration_seconds) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user!.orgId, body.text, result.url, body.voice, result.duration]
  );
  ok(res, { voiceNote: row, url: result.url }, 201);
}));

router.get('/voice-notes', asyncHandler(async (req, res) => {
  const rows = await many(`SELECT * FROM voice_notes WHERE org_id=$1 ORDER BY created_at DESC LIMIT 50`, [req.user!.orgId]);
  ok(res, { voiceNotes: rows });
}));

/* ============================================================
   8. JOURNEY TIMELINE
============================================================ */
router.get('/journey/:contactId', asyncHandler(async (req, res) => {
  const events = await journey.timeline(req.user!.orgId, req.params.contactId, 200);
  ok(res, { events });
}));

/* ============================================================
   9. CONTACT MERGE
============================================================ */
router.get('/contacts/duplicates', asyncHandler(async (req, res) => {
  const result = await contactMerge.findDuplicates(req.user!.orgId);
  ok(res, { duplicates: result.rows });
}));

router.post('/contacts/merge', asyncHandler(async (req, res) => {
  const { primaryId, mergedIds } = z.object({
    primaryId: z.string().uuid(),
    mergedIds: z.array(z.string().uuid()).min(1).max(50),
  }).parse(req.body);

  const result = await contactMerge.merge(req.user!.orgId, primaryId, mergedIds);
  ok(res, result);
}));

/* ============================================================
   10. STATUS BROADCAST
============================================================ */
router.post('/status/broadcast', asyncHandler(async (req, res) => {
  const body = z.object({
    content: z.string().optional(),
    mediaUrl: z.string().url().optional(),
    mediaType: z.enum(['image', 'video', 'text']).default('text'),
    tags: z.array(z.string()).optional(),
  }).parse(req.body);

  const row = await one(
    `INSERT INTO status_broadcasts (org_id, content, media_url, media_type, audience_tags)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user!.orgId, body.content || null, body.mediaUrl || null, body.mediaType, body.tags || []]
  );

  ok(res, {
    broadcast: row,
    note: 'WhatsApp Status API integration coming — draft saved for now.',
  }, 201);
}));

router.get('/status/broadcasts', asyncHandler(async (req, res) => {
  const rows = await many(`SELECT * FROM status_broadcasts WHERE org_id=$1 ORDER BY created_at DESC LIMIT 20`, [req.user!.orgId]);
  ok(res, { broadcasts: rows });
}));

/* ============================================================
   11. GST INVOICES
============================================================ */
router.post('/gst-invoices', asyncHandler(async (req, res) => {
  const body = z.object({
    contactId: z.string().uuid(),
    amount: z.number().positive(),
    taxPct: z.number().min(0).max(28).optional(),
    description: z.string().optional(),
  }).parse(req.body);

  const invoice = await gstInvoice.generate(req.user!.orgId, body);
  ok(res, { invoice }, 201);
}));

router.get('/gst-invoices', asyncHandler(async (req, res) => {
  const rows = await many(
    `SELECT gi.*, c.name AS contact_name FROM gst_invoices gi LEFT JOIN contacts c ON c.id = gi.contact_id
      WHERE gi.org_id=$1 ORDER BY gi.created_at DESC LIMIT 100`,
    [req.user!.orgId]
  );
  ok(res, { invoices: rows });
}));

/* ============================================================
   12. WHATSAPP FORMS
============================================================ */
router.get('/forms', asyncHandler(async (req, res) => {
  const rows = await many(`SELECT * FROM wa_forms WHERE org_id=$1 ORDER BY created_at DESC`, [req.user!.orgId]);
  ok(res, { forms: rows });
}));

router.post('/forms', asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(1),
    fields: z.array(z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      type: z.enum(['text', 'number', 'email', 'phone', 'select']).default('text'),
      required: z.boolean().default(false),
      options: z.array(z.string()).optional(),
    })).min(1).max(20),
    submit_message: z.string().optional(),
    auto_create_lead: z.boolean().default(true),
  }).parse(req.body);

  const row = await one(
    `INSERT INTO wa_forms (org_id, name, fields, submit_message, auto_create_lead) VALUES ($1,$2,$3::jsonb,$4,$5) RETURNING *`,
    [req.user!.orgId, body.name, JSON.stringify(body.fields), body.submit_message || 'Thanks!', body.auto_create_lead]
  );
  ok(res, { form: row }, 201);
}));

router.post('/forms/:id/submit', asyncHandler(async (req, res) => {
  const { data, phone, contactId } = z.object({
    data: z.record(z.any()),
    phone: z.string().optional(),
    contactId: z.string().uuid().optional(),
  }).parse(req.body);

  const form = await one<any>(`SELECT * FROM wa_forms WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  if (!form) throw ApiError.notFound();

  const resp = await one(
    `INSERT INTO wa_form_responses (form_id, org_id, contact_id, phone, data) VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *`,
    [form.id, req.user!.orgId, contactId || null, phone || null, JSON.stringify(data)]
  );

  await query(`UPDATE wa_forms SET submissions = submissions + 1 WHERE id=$1`, [form.id]);

  if (form.auto_create_lead && (data.phone || phone)) {
    const p = data.phone || phone;
    await query(
      `INSERT INTO leads (org_id, source, name, phone, email, payload) VALUES ($1,'whatsapp_form',$2,$3,$4,$5::jsonb)`,
      [req.user!.orgId, data.name || null, p, data.email || null, JSON.stringify({ form: form.name, ...data })]
    );
  }

  ok(res, { response: resp, message: form.submit_message }, 201);
}));

/* ============================================================
   13. OUTBOUND CALLS (Exotel)
============================================================ */
router.post('/calls/outbound', asyncHandler(async (req, res) => {
  const body = z.object({
    phone: z.string().min(10),
    contactId: z.string().uuid().optional(),
    purpose: z.string().optional(),
    scheduledAt: z.string().datetime().optional(),
  }).parse(req.body);

  const row = await one(
    `INSERT INTO outbound_calls (org_id, contact_id, phone, purpose, scheduled_at, status)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user!.orgId, body.contactId || null, body.phone, body.purpose || null, body.scheduledAt || null, body.scheduledAt ? 'queued' : 'queued']
  );

  ok(res, {
    call: row,
    note: 'Exotel integration requires API keys in .env. Call queued.',
  }, 201);
}));

router.get('/calls/outbound', asyncHandler(async (req, res) => {
  const rows = await many(`SELECT * FROM outbound_calls WHERE org_id=$1 ORDER BY created_at DESC LIMIT 100`, [req.user!.orgId]);
  ok(res, { calls: rows });
}));

/* ============================================================
   14. HINDI UI TOGGLE
============================================================ */
router.post('/settings/language', asyncHandler(async (req, res) => {
  const { language } = z.object({ language: z.enum(['en', 'hi']) }).parse(req.body);
  await query(`UPDATE users SET ui_language = $1 WHERE id = $2`, [language, req.user!.id]);
  ok(res, { language });
}));

/* ============================================================
   15. UPI QR CODE
============================================================ */
router.post('/upi/qr', asyncHandler(async (req, res) => {
  const { upiId, amount, name, note } = z.object({
    upiId: z.string().min(3),
    amount: z.number().positive(),
    name: z.string().min(1),
    note: z.string().optional(),
  }).parse(req.body);

  const QRCode = await import('qrcode');
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount.toFixed(2)}&cu=INR${note ? `&tn=${encodeURIComponent(note)}` : ''}`;

  const dataUrl = await QRCode.toDataURL(upiUrl, { width: 400, margin: 2 });
  ok(res, { qr: dataUrl, upiUrl });
}));

/* ============================================================
   16. BROADCAST PREVIEW
============================================================ */
router.post('/broadcast/preview', asyncHandler(async (req, res) => {
  const { templateId, contactId, variables } = z.object({
    templateId: z.string().uuid(),
    contactId: z.string().uuid(),
    variables: z.record(z.string()).default({}),
  }).parse(req.body);

  const template = await one<any>(`SELECT * FROM templates WHERE id=$1 AND org_id=$2`, [templateId, req.user!.orgId]);
  const contact = await one<any>(`SELECT * FROM contacts WHERE id=$1 AND org_id=$2`, [contactId, req.user!.orgId]);
  if (!template || !contact) throw ApiError.notFound();

  // Render body with variables
  let body = template.body as string;
  const vars: string[] = [];
  Object.keys(variables).sort().forEach((k) => vars.push(variables[k]));
  (template.variables as string[]).forEach((v, i) => {
    body = body.replace(new RegExp(v.replace(/[{}]/g, '\\$&'), 'g'), vars[i] ?? v);
  });

  ok(res, {
    preview: {
      header: template.header_text,
      body,
      footer: template.footer,
      buttons: template.buttons,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      contact_name: contact.name,
    },
  });
}));

/* ============================================================
   17. AGENT PERFORMANCE
============================================================ */
router.get('/team/performance', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role,
            COALESCE(SUM(am.messages_sent), 0)::int AS messages_sent,
            COALESCE(SUM(am.deals_closed), 0)::int AS deals_closed,
            COALESCE(SUM(am.deals_value), 0)::numeric AS deals_value,
            COALESCE(AVG(am.avg_response_seconds), 0)::int AS avg_response_seconds
       FROM users u
       LEFT JOIN agent_metrics am ON am.user_id = u.id
      WHERE u.org_id = $1
      GROUP BY u.id, u.name, u.email, u.role
      ORDER BY deals_value DESC`,
    [req.user!.orgId]
  );
  ok(res, { performance: rows });
}));

/* ============================================================
   18. GREEN TICK HELPER
============================================================ */
router.get('/green-tick/status', asyncHandler(async (req, res) => {
  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  const checklist = [
    { item: 'Meta Business Manager account created', done: !!org.wa_business_id, help: 'business.facebook.com pe account banao' },
    { item: 'Phone number verified with Meta', done: !!org.wa_phone_number_id, help: 'Meta dashboard me phone number verify karo' },
    { item: 'Business name matches legal documents', done: false, help: 'GST/Incorporation certificate ka naam use karo' },
    { item: 'Facebook Business Page connected', done: !!org.meta_page_id, help: 'Page banao aur WABA se connect karo' },
    { item: 'Business website live (recommended)', done: false, help: 'Company website ho to better' },
    { item: 'Display name follows Meta guidelines', done: false, help: 'No generic names like "Sales" ya "Support"' },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  ok(res, { checklist, progress: Math.round((doneCount / checklist.length) * 100) });
}));

/* ============================================================
   19. HINGLISH COPY ASSISTANT
============================================================ */
router.post('/copy/rewrite', asyncHandler(async (req, res) => {
  const { text, tone, language } = z.object({
    text: z.string().min(5).max(1000),
    tone: z.enum(['professional', 'friendly', 'urgent', 'casual']).default('friendly'),
    language: z.enum(['hinglish', 'hindi', 'english']).default('hinglish'),
  }).parse(req.body);

  if (!ai.enabled) throw ApiError.badRequest('OpenAI not configured');

  const openai = (await import('../services/openai')).openai!;
  const r = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: `You rewrite WhatsApp messages for Indian businesses. Tone: ${tone}. Language: ${language}. Return JSON: {"rewritten": "final message", "variations": ["alt1", "alt2"]}` },
      { role: 'user', content: text },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
    max_tokens: 400,
  });

  const parsed = JSON.parse(r.choices[0]?.message?.content || '{}');
  ok(res, { rewritten: parsed.rewritten, variations: parsed.variations || [] });
}));

export default router;
