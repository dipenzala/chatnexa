import OpenAI from 'openai';
import fs from 'fs';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { many, query } from '../db/pool';

export const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 45_000 }) : null;

export const ai = {
  get enabled() { return !!openai; },

  async embed(text: string): Promise<number[] | null> {
    if (!openai) return null;
    try {
      const r = await openai.embeddings.create({ model: env.OPENAI_EMBED_MODEL, input: text.slice(0, 8000) });
      return r.data[0].embedding;
    } catch (e: any) { logger.error('embed failed', e.message); return null; }
  },

  async addKnowledge(orgId: string, title: string, content: string, sourceUrl?: string) {
    const vec = await this.embed(`${title}\n${content}`);
    const literal = vec ? `[${vec.join(',')}]` : null;
    const r = await query(
      `INSERT INTO knowledge_base (org_id, title, content, source_url, embedding)
       VALUES ($1,$2,$3,$4,$5::vector) RETURNING id, title, created_at`,
      [orgId, title, content, sourceUrl ?? null, literal]
    );
    return r.rows[0];
  },

  async retrieve(orgId: string, question: string, k = 5) {
    const vec = await this.embed(question);
    if (!vec) return [];
    try {
      return await many(
        `SELECT id, title, content, similarity FROM match_knowledge($1, $2::vector, $3)`,
        [orgId, `[${vec.join(',')}]`, k]
      );
    } catch (e: any) { logger.warn('retrieve failed', e.message); return []; }
  },

  async generateReply(opts: { orgId: string; systemPrompt: string; history: { role: 'user'|'assistant'; content: string }[]; userMessage: string }) {
    if (!openai) return null;
    try {
      const ctx = await this.retrieve(opts.orgId, opts.userMessage, 4);
      const ctxBlock = ctx.length ? `\n\n--- KNOWLEDGE ---\n${ctx.map((c: any) => `• ${c.title}: ${c.content}`).join('\n')}\n--- END ---` : '';
      const messages: any[] = [
        { role: 'system', content: `${opts.systemPrompt}\n\nRules: Reply ONLY with the WhatsApp text. Never invent facts. If unknown, say a human will follow up. Max 2 short paragraphs. No markdown.${ctxBlock}` },
        ...opts.history.slice(-10),
        { role: 'user', content: opts.userMessage },
      ];
      const r = await openai.chat.completions.create({ model: env.OPENAI_MODEL, messages, temperature: 0.4, max_tokens: 400 });
      const text = r.choices[0]?.message?.content?.trim();
      return text ? { text, usedContext: ctx.length > 0 } : null;
    } catch (e: any) { logger.error('generateReply failed', e.message); return null; }
  },

  async transcribe(buffer: Buffer, filename = 'audio.ogg', language?: string): Promise<string | null> {
    if (!openai) return null;
    try {
      const tmp = `/tmp/${Date.now()}-${filename}`;
      fs.writeFileSync(tmp, buffer);
      const r = await openai.audio.transcriptions.create({ file: fs.createReadStream(tmp), model: 'whisper-1', ...(language ? { language } : {}) });
      fs.unlinkSync(tmp);
      return r.text;
    } catch (e: any) { logger.error('transcribe failed', e.message); return null; }
  },

  async summarizeConversation(t: string): Promise<string | null> {
    if (!openai) return null;
    try {
      const r = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          { role: 'system', content: 'Summarize this WhatsApp conversation in 3 bullets: customer intent, key details, next action. Be terse.' },
          { role: 'user', content: t.slice(0, 12000) },
        ],
        temperature: 0.3, max_tokens: 300,
      });
      return r.choices[0]?.message?.content ?? null;
    } catch (e: any) { logger.error('summarize failed', e.message); return null; }
  },

  async scoreLead(payload: any): Promise<number> {
    if (!openai) return 50;
    try {
      const r = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          { role: 'system', content: 'Return ONLY an integer 0-100 indicating how sales-ready this lead is.' },
          { role: 'user', content: JSON.stringify(payload).slice(0, 3000) },
        ],
        temperature: 0, max_tokens: 5,
      });
      const n = parseInt((r.choices[0]?.message?.content || '50').replace(/\D/g, ''), 10);
      return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 50;
    } catch { return 50; }
  },
};
