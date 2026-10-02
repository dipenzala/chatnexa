import { Worker, Job } from 'bullmq';
import { createBullConnection } from '../redis/client';
import { QUEUE_NAMES } from '../queues';
import { logger } from '../lib/logger';
import { one, query, many } from '../db/pool';
import { whatsapp, credsFromOrg } from '../services/whatsapp';
import { ai } from '../services/openai';
import { billing } from '../services/billing';
import { emitToOrg } from '../services/socket';
import { mailer } from '../services/mailer';
import { dealAI } from '../services/deal-ai';

const workers: Worker[] = [];

/** Helper: attach error handlers that throttle ECONNRESET noise */
function attachHandlers(w: Worker) {
  let lastErr = 0;
  w.on('failed', (job, err) => {
    if (err.message?.includes('ECONNRESET')) return;
    logger.error(`[${w.name}] job ${job?.id} failed: ${err.message}`);
  });
  w.on('error', (err) => {
    // ECONNRESET from Upstash idle-kill is normal — throttle and downgrade
    if (err.message?.includes('ECONNRESET') || err.message?.includes('EPIPE')) {
      const now = Date.now();
      if (now - lastErr > 60000) {
        logger.warn(`[${w.name}] redis idle-reset (auto-reconnecting)`);
        lastErr = now;
      }
      return;
    }
    logger.error(`[${w.name}] error: ${err.message}`);
  });
}

/** Fresh connection per worker — BullMQ needs blocking-safe conns */
function workerOptions(concurrency: number, limiter?: { max: number; duration: number }) {
  return {
    connection: createBullConnection(),
    concurrency,
    ...(limiter ? { limiter } : {}),
  };
}

/* ------------------------------------------------------------------
   CAMPAIGN
------------------------------------------------------------------ */
const campaignWorker = new Worker(QUEUE_NAMES.CAMPAIGN, async (job: Job) => {
  const { campaignId, orgId } = job.data as { campaignId: string; orgId: string };
  const campaign = await one<any>(`SELECT * FROM campaigns WHERE id = $1 AND org_id = $2`, [campaignId, orgId]);
  if (!campaign) throw new Error('campaign not found');
  if (['paused', 'completed'].includes(campaign.status)) return;

  const org = await one<any>(`SELECT * FROM organizations WHERE id = $1`, [orgId]);
  const creds = credsFromOrg(org);
  if (!creds) throw new Error('WhatsApp not connected');
  const template = campaign.template_id ? await one<any>(`SELECT * FROM templates WHERE id = $1`, [campaign.template_id]) : null;
  await query(`UPDATE campaigns SET status='running', started_at=COALESCE(started_at,NOW()) WHERE id=$1`, [campaignId]);

  for (;;) {
    const { rows: recipients } = await query<any>(
      `SELECT cr.id, cr.contact_id, c.phone, c.name, c.attributes
         FROM campaign_recipients cr JOIN contacts c ON c.id = cr.contact_id
        WHERE cr.campaign_id = $1 AND cr.status = 'pending' AND c.blocked = FALSE
        ORDER BY cr.id LIMIT 25`,
      [campaignId]
    );
    if (!recipients.length) break;
    const state = await one<{ status: string }>(`SELECT status FROM campaigns WHERE id = $1`, [campaignId]);
    if (state?.status === 'paused') return;

    for (const r of recipients) {
      try {
        const varDefs = (campaign.variables || {}) as Record<string, string>;
        const vars: string[] = [];
        for (const k of Object.keys(varDefs).sort()) {
          vars.push(varDefs[k].replace(/\{\{\s*(\w+)\s*\}\}/g, (_: string, key: string) =>
            key === 'name' ? (r.name || 'Customer') : key === 'phone' ? r.phone : String(r.attributes?.[key] ?? '')
          ));
        }
        const charged = await billing.charge(orgId, template?.category || 'MARKETING', `Campaign: ${campaign.name}`, campaignId);
        if (!charged) { await query(`UPDATE campaigns SET status='paused' WHERE id=$1`, [campaignId]); return; }
        const waId = await whatsapp.sendTemplate(creds, r.phone, campaign.template_name || template?.name || '', campaign.language || 'en', vars);
        await query(`UPDATE campaign_recipients SET status='sent', wa_message_id=$2, sent_at=NOW() WHERE id=$1`, [r.id, waId]);
        await query(`UPDATE campaigns SET sent = sent + 1 WHERE id = $1`, [campaignId]);
        await new Promise((r) => setTimeout(r, 45));
      } catch (e: any) {
        await query(`UPDATE campaign_recipients SET status='failed', error=$2 WHERE id=$1`, [r.id, (e.message || '').slice(0, 400)]);
        await query(`UPDATE campaigns SET failed = failed + 1 WHERE id = $1`, [campaignId]);
      }
    }
  }
  await query(`UPDATE campaigns SET status='completed', completed_at=NOW() WHERE id=$1`, [campaignId]);
  emitToOrg(orgId, 'campaign:completed', { campaignId });
}, workerOptions(3));
workers.push(campaignWorker);
attachHandlers(campaignWorker);

/* ------------------------------------------------------------------
   AI auto-reply
------------------------------------------------------------------ */
const aiWorker = new Worker(QUEUE_NAMES.AI_REPLY, async (job: Job) => {
  const { orgId, contactId, conversationId, inboundText } = job.data;
  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [orgId]);
  if (!org || !org.ai_enabled) return;
  const conv = await one<any>(`SELECT * FROM conversations WHERE id=$1`, [conversationId]);
  if (!conv || !conv.ai_enabled) return;
  const creds = credsFromOrg(org);
  if (!creds) return;
  const contact = await one<any>(`SELECT * FROM contacts WHERE id=$1`, [contactId]);
  const { rows: historyRows } = await query<any>(
    `SELECT direction, body FROM messages WHERE conversation_id=$1 AND body IS NOT NULL ORDER BY created_at DESC LIMIT 10`,
    [conversationId]
  );
  const history = historyRows.reverse().map((m: any) => ({ role: m.direction === 'inbound' ? 'user' : 'assistant', content: m.body }) as const);
  const result = await ai.generateReply({ orgId, systemPrompt: org.ai_system_prompt || 'You are a helpful assistant.', history: history.slice(0, -1) as any, userMessage: inboundText });
  if (!result) return;
  const charged = await billing.charge(orgId, 'SERVICE', 'AI auto-reply');
  if (!charged) return;
  let waId: string | null = null;
  try { waId = await whatsapp.sendText(creds, contact.phone, result.text); }
  catch { return; }
  const { rows } = await query<any>(
    `INSERT INTO messages (org_id, conversation_id, contact_id, direction, wa_message_id, type, body, status, ai_generated)
     VALUES ($1,$2,$3,'outbound',$4,'text',$5,'sent',TRUE) RETURNING *`,
    [orgId, conversationId, contactId, waId, result.text]
  );
  await query(`UPDATE conversations SET last_message=$2, last_message_at=NOW() WHERE id=$1`, [conversationId, result.text]);
  emitToOrg(orgId, 'message:new', { message: rows[0], conversationId });
}, workerOptions(5));
workers.push(aiWorker);
attachHandlers(aiWorker);

/* ------------------------------------------------------------------
   Transcribe
------------------------------------------------------------------ */
const transcribeWorker = new Worker(QUEUE_NAMES.TRANSCRIBE, async (job: Job) => {
  const { orgId, messageId, bufferBase64, filename } = job.data;
  const text = await ai.transcribe(Buffer.from(bufferBase64, 'base64'), filename);
  if (!text) return;
  await query(`UPDATE messages SET body = COALESCE(body,'') || $2 WHERE id=$1`, [messageId, `\n[transcript] ${text}`]);
  emitToOrg(orgId, 'message:transcribed', { messageId, text });
}, workerOptions(3));
workers.push(transcribeWorker);
attachHandlers(transcribeWorker);

/* ------------------------------------------------------------------
   Email
------------------------------------------------------------------ */
const emailWorker = new Worker(QUEUE_NAMES.EMAIL, async (job: Job) => {
  const { to, subject, html } = job.data;
  await mailer.send(to, subject, html);
}, workerOptions(10));
workers.push(emailWorker);
attachHandlers(emailWorker);

/* ------------------------------------------------------------------
   Lead score
------------------------------------------------------------------ */
const leadScoreWorker = new Worker(QUEUE_NAMES.LEAD_SCORE, async (job: Job) => {
  const { leadId, orgId, payload } = job.data;
  const score = await ai.scoreLead(payload);
  await query(`UPDATE leads SET score=$2 WHERE id=$1`, [leadId, score]);
  emitToOrg(orgId, 'lead:scored', { leadId, score });
}, workerOptions(5));
workers.push(leadScoreWorker);
attachHandlers(leadScoreWorker);

/* ------------------------------------------------------------------
   IVR
------------------------------------------------------------------ */
const ivrWorker = new Worker(QUEUE_NAMES.IVR, async (job: Job) => {
  const { callId, orgId, recordingUrl } = job.data;
  if (recordingUrl && ai.enabled) {
    try {
      const axios = (await import('axios')).default;
      const bin = await axios.get(recordingUrl, { responseType: 'arraybuffer', timeout: 60_000 });
      const text = await ai.transcribe(Buffer.from(bin.data), 'ivr.mp3');
      if (text) { await query(`UPDATE ivr_calls SET transcript=$2 WHERE id=$1`, [callId, text]); emitToOrg(orgId, 'ivr:transcribed', { callId, text }); }
    } catch {}
  }
}, workerOptions(2));
workers.push(ivrWorker);
attachHandlers(ivrWorker);

/* ------------------------------------------------------------------
   Deal analyze
------------------------------------------------------------------ */
const dealWorker = new Worker(QUEUE_NAMES.DEAL_ANALYZE, async (job: Job) => {
  const { orgId, conversationId } = job.data;
  const signal = await dealAI.analyze(orgId, conversationId);
  if (signal) emitToOrg(orgId, 'deal:updated', { conversationId, signal });
}, workerOptions(3));
workers.push(dealWorker);
attachHandlers(dealWorker);

/* ------------------------------------------------------------------
   Follow-up runner
------------------------------------------------------------------ */
const followupWorker = new Worker(QUEUE_NAMES.FOLLOWUP_RUNNER, async () => {
  const due = await many<any>(
    `SELECT fq.*, c.contact_id, ct.phone, ct.name AS contact_name, fq.sequence_id
       FROM followup_queue fq
       JOIN conversations c ON c.id = fq.conversation_id
       JOIN contacts ct ON ct.id = c.contact_id
      WHERE fq.status = 'pending' AND fq.scheduled_at <= NOW()
      LIMIT 20`
  );
  for (const row of due) {
    try {
      const recent = await one<{ id: string }>(
        `SELECT id FROM messages WHERE conversation_id = $1 AND direction='inbound' AND created_at > $2 LIMIT 1`,
        [row.conversation_id, row.created_at]
      );
      if (recent) { await query(`UPDATE followup_queue SET status='cancelled_by_reply' WHERE id=$1`, [row.id]); continue; }

      const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [row.org_id]);
      const creds = credsFromOrg(org);
      if (!creds) continue;

      const seq = await one<any>(`SELECT * FROM followup_sequences WHERE id=$1`, [row.sequence_id]);
      const step = (seq?.steps?.[row.step_index] || {}) as any;
      const prompt = step.prompt || 'Send a warm, short follow-up.';

      const lastMsgs = await many<any>(
        `SELECT direction, body FROM messages WHERE conversation_id=$1 AND body IS NOT NULL ORDER BY created_at DESC LIMIT 5`,
        [row.conversation_id]
      );
      const ctx = lastMsgs.reverse().map((m) => `${m.direction === 'inbound' ? 'Customer' : 'Business'}: ${m.body}`).join('\n');

      let msgText = `Hi ${row.contact_name || 'there'}, just checking in — any questions?`;
      if (ai.enabled) {
        try {
          const r = await (await import('../services/openai')).openai!.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: `You write WhatsApp follow-ups for an Indian business. Reply in Hinglish or English, under 50 words, warm, non-spammy. Return only the message.` },
              { role: 'user', content: `Task: ${prompt}\n\nRecent conversation:\n${ctx}` },
            ],
            temperature: 0.6, max_tokens: 200,
          });
          msgText = r.choices[0]?.message?.content?.trim() || msgText;
        } catch {}
      }

      const waId = await whatsapp.sendText(creds, row.phone, msgText);
      const { rows: ins } = await query<any>(
        `INSERT INTO messages (org_id, conversation_id, contact_id, direction, wa_message_id, type, body, status, ai_generated)
         VALUES ($1,$2,$3,'outbound',$4,'text',$5,'sent',TRUE) RETURNING id`,
        [row.org_id, row.conversation_id, row.contact_id, waId, msgText]
      );
      await query(`UPDATE followup_queue SET status='sent', sent_message_id=$2 WHERE id=$1`, [row.id, ins[0].id]);
      await query(`UPDATE conversations SET last_message=$2, last_message_at=NOW() WHERE id=$1`, [row.conversation_id, msgText.slice(0, 200)]);
      emitToOrg(row.org_id, 'message:new', { conversationId: row.conversation_id });
    } catch (e: any) {
      logger.warn('followup step failed', e.message);
      await query(`UPDATE followup_queue SET status='failed' WHERE id=$1`, [row.id]);
    }
  }
}, workerOptions(1));
workers.push(followupWorker);
attachHandlers(followupWorker);

logger.info(`✅ ${workers.length} BullMQ workers running`);

export async function closeWorkers() {
  await Promise.all(workers.map((w) => w.close()));
}
