import { env } from '../config/env';
import { logger } from '../lib/logger';
import { one, query } from '../db/pool';
import { openai } from './openai';
import { dealAI } from './deal-ai';

export const nba = {
  async suggest(orgId: string, conversationId: string) {
    if (!openai) return null;
    const signal = await dealAI.analyze(orgId, conversationId);
    if (!signal) return null;

    const conv = await one<any>(
      `SELECT c.*, ct.name AS contact_name FROM conversations c
         JOIN contacts ct ON ct.id = c.contact_id WHERE c.id = $1`,
      [conversationId]
    );
    if (!conv) return null;

    const prompt = `You are an expert Indian WhatsApp sales coach.
Given this customer state, suggest the single BEST next action.

Customer: ${conv.contact_name || 'Customer'}
Deal score: ${signal.score}/100
Stage: ${signal.stage}
Objections: ${signal.objections.join(', ') || 'none'}
Sentiment: ${signal.sentiment}
Urgency: ${signal.urgency}
Reason: ${signal.reason}

Return JSON only:
{
  "action": "send_offer|ask_qualifying_question|schedule_call|send_payment_link|share_testimonial|create_urgency|follow_up_later|close_now",
  "title": "3-5 word action label",
  "message": "Ready-to-send WhatsApp message in Hinglish/English, under 60 words",
  "reasoning": "One line why",
  "confidence": 0-100
}`;

    try {
      const r = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          { role: 'system', content: 'You are a sales coach. Return valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
        max_tokens: 400,
      });
      const parsed = JSON.parse(r.choices[0]?.message?.content || '{}');
      if (!parsed.message) return null;

      const row = await one(
        `INSERT INTO nba_suggestions (org_id, conversation_id, action, title, message, confidence, reasoning)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [orgId, conversationId, parsed.action || 'follow_up_later', parsed.title || 'Next step', parsed.message, parsed.confidence || 60, parsed.reasoning || '']
      );
      return row;
    } catch (e: any) {
      logger.warn('NBA failed', e.message);
      return null;
    }
  },
};
