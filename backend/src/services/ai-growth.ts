import { env } from '../config/env';
import { logger } from '../lib/logger';
import { many, one, query } from '../db/pool';
import { openai } from './openai';

export const aiGrowth = {
  /** Generate upsell suggestion for a contact */
  async suggestUpsell(orgId: string, contactId: string) {
    if (!openai) return null;
    const contact = await one<any>(`SELECT * FROM contacts WHERE id=$1 AND org_id=$2`, [contactId, orgId]);
    if (!contact) return null;

    const recentMessages = await many<{ direction: string; body: string }>(
      `SELECT direction, body FROM messages WHERE contact_id=$1 AND body IS NOT NULL ORDER BY created_at DESC LIMIT 15`,
      [contactId]
    );

    const history = recentMessages.reverse().map((m) => `${m.direction === 'inbound' ? 'Customer' : 'Business'}: ${m.body}`).join('\n');

    try {
      const r = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          { role: 'system', content: 'You are a WhatsApp sales assistant for an Indian business. Suggest the next best product to upsell. Return JSON only.' },
          { role: 'user', content: `Customer: ${contact.name || contact.phone}\nLoyalty points: ${contact.loyalty_points || 0}\nTotal spent: ₹${contact.total_spent || 0}\n\nRecent conversation:\n${history || '(no messages)'}\n\nReturn JSON: {"product_name": "short product/category name", "message": "warm WhatsApp message under 50 words", "confidence": 0-100}` },
        ],
        temperature: 0.5, response_format: { type: 'json_object' }, max_tokens: 300,
      });

      const parsed = JSON.parse(r.choices[0]?.message?.content || '{}');
      if (!parsed.message) return null;

      return await one(
        `INSERT INTO upsell_suggestions (org_id, contact_id, product_name, message, confidence)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [orgId, contactId, parsed.product_name || '', parsed.message, parsed.confidence || 60]
      );
    } catch (e: any) { logger.warn('upsell failed', e.message); return null; }
  },

  /** Predict churn for all contacts (run periodically) */
  async predictChurn(orgId: string): Promise<number> {
    const contacts = await many<any>(
      `SELECT c.id, c.name, c.phone, c.created_at,
              (SELECT MAX(created_at) FROM messages WHERE contact_id = c.id) AS last_msg_at,
              (SELECT COUNT(*) FROM messages WHERE contact_id = c.id AND created_at > NOW() - INTERVAL '30 days') AS msg_count_30d,
              (SELECT COUNT(*) FROM messages WHERE contact_id = c.id AND direction = 'inbound' AND created_at > NOW() - INTERVAL '30 days') AS inbound_30d
         FROM contacts c
        WHERE c.org_id = $1 AND c.created_at < NOW() - INTERVAL '30 days'
        LIMIT 500`,
      [orgId]
    );

    let count = 0;
    for (const c of contacts) {
      const daysSince = c.last_msg_at ? Math.floor((Date.now() - new Date(c.last_msg_at).getTime()) / 86400_000) : 999;
      const inbound = Number(c.inbound_30d || 0);

      // Simple heuristic — can be replaced by AI later
      let risk = 0;
      if (daysSince > 60) risk += 50;
      else if (daysSince > 30) risk += 30;
      else if (daysSince > 14) risk += 15;
      if (inbound === 0) risk += 30;
      else if (inbound <= 2) risk += 15;
      risk = Math.min(100, risk);

      const reason = risk >= 70 ? 'No activity for 30+ days'
        : risk >= 40 ? 'Reduced engagement recently'
        : 'Active customer';

      await query(
        `INSERT INTO churn_predictions (org_id, contact_id, risk_score, reason, last_order_at, days_since_last_order)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (org_id, contact_id) DO UPDATE SET
           risk_score = EXCLUDED.risk_score,
           reason = EXCLUDED.reason,
           days_since_last_order = EXCLUDED.days_since_last_order,
           created_at = NOW()`,
        [orgId, c.id, risk, reason, c.last_msg_at, daysSince]
      );
      count++;
    }
    return count;
  },

  /** Forecast revenue for next 30 days */
  async forecastRevenue(orgId: string) {
    const past = await one<{ revenue: string; orders: string }>(
      `SELECT
         COALESCE(SUM(pipeline_value), 0) AS revenue,
         COUNT(*) AS orders
       FROM conversations
        WHERE org_id = $1 AND pipeline_stage IN ('negotiating', 'payment_pending')`,
      [orgId]
    );

    const won = await one<{ revenue: string; orders: string }>(
      `SELECT
         COALESCE(SUM(pipeline_value), 0) AS revenue,
         COUNT(*) AS orders
       FROM conversations
        WHERE org_id = $1 AND pipeline_stage = 'won'
          AND deal_updated_at > NOW() - INTERVAL '30 days'`,
      [orgId]
    );

    const pipelineValue = Number(past?.revenue || 0);
    const wonValue = Number(won?.revenue || 0);
    const dealCount = Number(past?.orders || 0);

    // Simple forecast: pipeline × 0.4 + recent won × 0.3
    const predicted = pipelineValue * 0.4 + wonValue * 0.3;
    const confidence = Math.min(95, 50 + dealCount * 3);

    const now = new Date();
    const periodEnd = new Date(Date.now() + 30 * 86400_000);

    return await one(
      `INSERT INTO revenue_forecasts (org_id, period_start, period_end, predicted_revenue, confidence, pipeline_value, deal_count, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        orgId,
        now.toISOString().slice(0, 10),
        periodEnd.toISOString().slice(0, 10),
        predicted.toFixed(2),
        confidence,
        pipelineValue,
        dealCount,
        `Based on ${dealCount} active deals`,
      ]
    );
  },
};
