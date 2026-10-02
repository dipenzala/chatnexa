import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db/pool';
import { ApiError, asyncHandler, ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { aiGrowth } from '../services/ai-growth';
import { seoTools } from '../services/seo-tools';
import { personalizer } from '../services/personalizer';

const router = Router();
router.use(requireAuth);

/* ============================================================
   UPSELL
============================================================ */
router.post('/upsell/suggest/:contactId', asyncHandler(async (req, res) => {
  const s = await aiGrowth.suggestUpsell(req.user!.orgId, req.params.contactId);
  if (!s) throw ApiError.badRequest('Could not generate suggestion');
  ok(res, { suggestion: s });
}));

router.get('/upsell/list', asyncHandler(async (req, res) => {
  const rows = await many(
    `SELECT u.*, c.name AS contact_name, c.phone AS contact_phone
       FROM upsell_suggestions u JOIN contacts c ON c.id = u.contact_id
      WHERE u.org_id = $1 AND u.accepted = FALSE
      ORDER BY u.created_at DESC LIMIT 50`,
    [req.user!.orgId]
  );
  ok(res, { upsells: rows });
}));

router.post('/upsell/accept/:id', asyncHandler(async (req, res) => {
  await query(`UPDATE upsell_suggestions SET accepted=TRUE WHERE id=$1 AND org_id=$2`, [req.params.id, req.user!.orgId]);
  ok(res, { accepted: true });
}));

/* ============================================================
   CHURN
============================================================ */
router.post('/churn/analyze', asyncHandler(async (req, res) => {
  const count = await aiGrowth.predictChurn(req.user!.orgId);
  ok(res, { analyzed: count });
}));

router.get('/churn/at-risk', asyncHandler(async (req, res) => {
  const rows = await many(
    `SELECT cp.*, c.name AS contact_name, c.phone AS contact_phone
       FROM churn_predictions cp JOIN contacts c ON c.id = cp.contact_id
      WHERE cp.org_id = $1 AND cp.risk_score >= 40
      ORDER BY cp.risk_score DESC LIMIT 100`,
    [req.user!.orgId]
  );
  ok(res, { atRisk: rows });
}));

/* ============================================================
   FORECAST
============================================================ */
router.post('/forecast/generate', asyncHandler(async (req, res) => {
  const f = await aiGrowth.forecastRevenue(req.user!.orgId);
  ok(res, { forecast: f });
}));

router.get('/forecast/latest', asyncHandler(async (req, res) => {
  const f = await one(
    `SELECT * FROM revenue_forecasts WHERE org_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [req.user!.orgId]
  );
  ok(res, { forecast: f });
}));

/* ============================================================
   SEO TOOLS
============================================================ */
router.post('/seo/whatsapp-bio', asyncHandler(async (req, res) => {
  const body = z.object({
    businessName: z.string().min(2), category: z.string().min(2),
    usp: z.string().min(3), city: z.string().min(2), phone: z.string().min(8),
  }).parse(req.body);
  const result = await seoTools.whatsappBio(req.user!.orgId, body);
  ok(res, result, 201);
}));

router.post('/seo/product-description', asyncHandler(async (req, res) => {
  const body = z.object({
    productName: z.string(), category: z.string(), price: z.string(),
    features: z.string(), targetAudience: z.string(),
  }).parse(req.body);
  const result = await seoTools.productDescription(req.user!.orgId, body);
  ok(res, result, 201);
}));

router.post('/seo/hashtags', asyncHandler(async (req, res) => {
  const body = z.object({
    topic: z.string(), platform: z.string().default('instagram'), count: z.number().min(5).max(50).default(20),
  }).parse(req.body);
  const result = await seoTools.hashtags(req.user!.orgId, body);
  ok(res, result, 201);
}));

router.post('/seo/ad-copy', asyncHandler(async (req, res) => {
  const body = z.object({
    product: z.string(), audience: z.string(), goal: z.string(), budget: z.string(),
  }).parse(req.body);
  const result = await seoTools.adCopy(req.user!.orgId, body);
  ok(res, result, 201);
}));

router.post('/seo/google-business', asyncHandler(async (req, res) => {
  const body = z.object({
    businessName: z.string(), category: z.string(), city: z.string(), services: z.string(),
  }).parse(req.body);
  const result = await seoTools.googleBusiness(req.user!.orgId, body);
  ok(res, result, 201);
}));

router.get('/seo/history', asyncHandler(async (req, res) => {
  const rows = await many(
    `SELECT id, content_type, prompt, created_at, LEFT(output, 200) AS preview FROM seo_content WHERE org_id=$1 ORDER BY created_at DESC LIMIT 50`,
    [req.user!.orgId]
  );
  ok(res, { history: rows });
}));

/* ============================================================
   BULK PERSONALIZATION
============================================================ */
router.post('/personalize/preview', asyncHandler(async (req, res) => {
  const { template, contactId } = z.object({
    template: z.string().min(5).max(1000),
    contactId: z.string().uuid(),
  }).parse(req.body);

  const contact = await one<any>(`SELECT * FROM contacts WHERE id=$1 AND org_id=$2`, [contactId, req.user!.orgId]);
  if (!contact) throw ApiError.notFound();
  const message = await personalizer.personalize(template, contact);
  ok(res, { message, contact: { name: contact.name, phone: contact.phone } });
}));

router.post('/personalize/bulk', asyncHandler(async (req, res) => {
  const { template, tags, limit } = z.object({
    template: z.string().min(5).max(1000),
    tags: z.array(z.string()).optional(),
    limit: z.number().min(1).max(50).default(10),
  }).parse(req.body);

  const where = ['org_id = $1', 'opt_in = TRUE', 'blocked = FALSE'];
  const params: any[] = [req.user!.orgId];
  if (tags?.length) { where.push(`tags && $2::text[]`); params.push(tags); }

  const contacts = await many<any>(
    `SELECT * FROM contacts WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ${limit}`,
    params
  );

  const results = await personalizer.personalizeBatch(template, contacts);
  ok(res, { results, total: contacts.length });
}));

export default router;
