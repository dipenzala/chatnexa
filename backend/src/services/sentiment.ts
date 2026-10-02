import { one, query } from '../db/pool';
import { openai } from './openai';
import { env } from '../config/env';
import { emitToOrg } from './socket';
import { logger } from '../lib/logger';

export const sentiment = {
  /** Analyze a single message — fast heuristic + optional AI */
  async analyze(text: string): Promise<{ score: number; label: 'positive' | 'neutral' | 'negative'; severity?: 'low' | 'medium' | 'high' }> {
    if (!text) return { score: 0, label: 'neutral' };

    const lower = text.toLowerCase();

    // Fast heuristics
    const negativeWords = ['worst', 'bad', 'useless', 'bakwas', 'faltu', 'dhoka', 'fraud', 'cheat', 'refund', 'cancel', 'angry', 'worst', 'terrible', 'never', 'pathetic', 'bekar'];
    const strongNegative = ['fraud', 'cheat', 'dhoka', 'scam', 'police', 'legal', 'court', 'consumer'];
    const positiveWords = ['thank', 'shukriya', 'great', 'awesome', 'love', 'perfect', 'best', 'mast', 'badhiya', 'shandar'];

    let score = 0;
    let negativeHits = 0;
    let strongHits = 0;

    for (const w of negativeWords) if (lower.includes(w)) { score -= 10; negativeHits++; }
    for (const w of strongNegative) if (lower.includes(w)) { score -= 30; strongHits++; }
    for (const w of positiveWords) if (lower.includes(w)) { score += 10; }

    // Caps
    score = Math.max(-100, Math.min(100, score));

    const label = score >= 15 ? 'positive' : score <= -15 ? 'negative' : 'neutral';
    let severity: 'low' | 'medium' | 'high' | undefined;
    if (score <= -50 || strongHits > 0) severity = 'high';
    else if (score <= -25 || negativeHits >= 2) severity = 'medium';
    else if (score <= -15) severity = 'low';

    return { score, label, severity };
  },

  /** Analyze and log alert if needed */
  async processMessage(orgId: string, conversationId: string, contactId: string, messageId: string, text: string) {
    try {
      const result = await this.analyze(text);

      // Update message with sentiment
      await query(
        `UPDATE messages SET sentiment = $2, emotion_score = $3 WHERE id = $1`,
        [messageId, result.label, result.score]
      );

      // Create alert for negative
      if (result.label === 'negative' && result.severity) {
        const alert = await one(
          `INSERT INTO sentiment_alerts (org_id, conversation_id, contact_id, severity, reason, message_id)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [orgId, conversationId, contactId, result.severity, text.slice(0, 200), messageId]
        );
        emitToOrg(orgId, 'sentiment:alert', { alert });
      }

      return result;
    } catch (e: any) {
      logger.warn('sentiment process failed:', e.message);
      return null;
    }
  },
};
