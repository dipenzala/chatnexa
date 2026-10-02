import { env } from '../config/env';
import { logger } from '../lib/logger';
import { many, one, query } from '../db/pool';
import { openai } from './openai';

export interface DealSignal {
  score: number;
  signals: string[];
  stage: 'cold' | 'warm' | 'hot' | 'closing' | 'won' | 'lost';
  objections: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'low' | 'medium' | 'high';
  reason: string;
}

export const dealAI = {
  async analyze(orgId: string, conversationId: string): Promise<DealSignal | null> {
    if (!openai) return null;
    const msgs = await many<{ direction: string; body: string; created_at: string }>(
      `SELECT direction, body, created_at FROM messages
       WHERE conversation_id = $1 AND body IS NOT NULL AND body <> ''
       ORDER BY created_at DESC LIMIT 20`,
      [conversationId]
    );
    if (msgs.length < 2) return null;

    const transcript = msgs.reverse().map((m) =>
      `${m.direction === 'inbound' ? 'Customer' : 'Business'}: ${m.body}`
    ).join('\n');

    const prompt = `Analyze this WhatsApp business conversation and return JSON only.

Conversation:
${transcript}

Return JSON with this exact shape:
{
  "score": 0-100,
  "signals": ["asked_price","asked_timeline","asked_discount","ready_to_buy","comparing_competitor","stalling","ghosting","objection_price","objection_trust","objection_timing"],
  "stage": "cold|warm|hot|closing|won|lost",
  "objections": ["price","trust","timing","authority","need"],
  "sentiment": "positive|neutral|negative",
  "urgency": "low|medium|high",
  "reason": "one short line why this score"
}`;

    try {
      const r = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          { role: 'system', content: 'You are a sales analyst. Return valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
        max_tokens: 400,
      });
      const parsed = JSON.parse(r.choices[0]?.message?.content || '{}') as DealSignal;
      if (typeof parsed.score !== 'number') return null;

      await query(
        `UPDATE conversations
           SET deal_score=$2, deal_stage=$3, deal_signals=$4::jsonb, deal_reason=$5, deal_updated_at=NOW()
         WHERE id=$1`,
        [conversationId, parsed.score, parsed.stage || 'cold', JSON.stringify(parsed), parsed.reason || '']
      );
      return parsed;
    } catch (e: any) {
      logger.warn('deal analyze failed', e.message);
      return null;
    }
  },
};
