import { env } from '../config/env';
import { logger } from '../lib/logger';
import { many } from '../db/pool';
import { openai } from './openai';

export const personalizer = {
  /** Generate personalized message for a contact based on template + their history */
  async personalize(template: string, contact: any): Promise<string> {
    if (!openai) {
      // Fallback: basic variable replacement
      return template
        .replace(/\{\{name\}\}/g, contact.name || 'ji')
        .replace(/\{\{phone\}\}/g, contact.phone)
        .replace(/\{\{city\}\}/g, contact.attributes?.city || '');
    }

    try {
      const r = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          { role: 'system', content: 'You personalize WhatsApp marketing messages for Indian businesses. Keep the same core message but make it feel 1:1. Return ONLY the message text, under 60 words.' },
          { role: 'user', content: `Base message: ${template}\n\nCustomer:\n- Name: ${contact.name || 'Unknown'}\n- Phone: ${contact.phone}\n- Tags: ${(contact.tags || []).join(', ') || 'none'}\n- Total spent: ₹${contact.total_spent || 0}\n- Loyalty points: ${contact.loyalty_points || 0}\n- Attributes: ${JSON.stringify(contact.attributes || {})}\n\nPersonalize the message for this specific customer.` },
        ],
        temperature: 0.7, max_tokens: 200,
      });
      return r.choices[0]?.message?.content?.trim() || template;
    } catch (e: any) {
      logger.warn('personalize failed', e.message);
      return template.replace(/\{\{name\}\}/g, contact.name || 'ji');
    }
  },

  /** Batch personalize for a list of contacts */
  async personalizeBatch(template: string, contacts: any[]): Promise<{ contactId: string; message: string }[]> {
    const results: { contactId: string; message: string }[] = [];
    for (const c of contacts) {
      const msg = await this.personalize(template, c);
      results.push({ contactId: c.id, message: msg });
      await new Promise((r) => setTimeout(r, 100)); // rate limit
    }
    return results;
  },
};
