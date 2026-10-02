import { Router, raw } from 'express';
import { one, query } from '../db/pool';
import { logger } from '../lib/logger';
import { ok, asyncHandler } from '../lib/http';
import { env } from '../config/env';
import { whatsapp, credsFromOrg, normalizePhone } from '../services/whatsapp';
import { emitToOrg } from '../services/socket';
import { aiReplyQueue, transcribeQueue, leadScoreQueue, ivrQueue, enqueueDealAnalyze } from '../queues';
import { payments } from '../services/razorpay';
import { billing } from '../services/billing';
import { ai } from '../services/openai';
import { keywordReply } from '../services/keyword-reply';
import { sentiment } from '../services/sentiment';
import { journey } from '../services/journey';

const router = Router();

router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode']; const token = req.query['hub.verify_token']; const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

router.post('/whatsapp', asyncHandler(async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;
        const org = await one<any>(`SELECT * FROM organizations WHERE wa_phone_number_id = $1`, [phoneNumberId]);
        if (!org) continue;
        const creds = credsFromOrg(org);
        for (const msg of value.messages || []) await handleInbound(org, creds, msg, value.contacts?.[0]);
        for (const st of value.statuses || []) await handleStatus(org, st);
      }
    }
  } catch (e: any) { logger.error('webhook error', e.stack || e.message); }
}));

async function handleInbound(org: any, creds: any, msg: any, contactInfo: any) {
  const from = normalizePhone(msg.from);
  const name = contactInfo?.profile?.name || '';
  let contact = await one<any>(`SELECT * FROM contacts WHERE org_id=$1 AND phone=$2`, [org.id, from]);
  if (!contact) contact = await one(`INSERT INTO contacts (org_id, phone, name, source, last_seen_at) VALUES ($1,$2,$3,'whatsapp',NOW()) RETURNING *`, [org.id, from, name]);
  else await query(`UPDATE contacts SET last_seen_at=NOW(), name=COALESCE(NULLIF(name,''),$2) WHERE id=$1`, [contact.id, name]);

  let conv = await one<any>(`SELECT * FROM conversations WHERE org_id=$1 AND contact_id=$2`, [org.id, contact.id]);
  if (!conv) conv = await one(`INSERT INTO conversations (org_id, contact_id) VALUES ($1,$2) RETURNING *`, [org.id, contact.id]);

  // Cancel pending follow-ups for this conversation
  await query(`UPDATE followup_queue SET status='cancelled_by_reply' WHERE conversation_id = $1 AND status = 'pending'`, [conv.id]);

  let text = ''; let type = msg.type || 'text'; let mediaUrl: string | null = null; let mediaBuffer: Buffer | null = null;

  if (type === 'text') text = msg.text?.body || '';
  else if (type === 'button') text = msg.button?.text || '';
  else if (type === 'interactive') text = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
  else if (['image', 'video', 'document', 'audio', 'voice'].includes(type)) {
    const mediaId = msg[type]?.id;
    if (msg[type]?.caption) text = msg[type].caption;
    if (mediaId && creds) {
      try {
        const dl = await whatsapp.downloadMedia(creds, mediaId);
        mediaBuffer = dl.buffer;
        const { storage } = await import('../services/cloudinary');
        if (storage.enabled) { const up = await storage.upload(dl.buffer, `chatnexa/${org.id}/inbound`); mediaUrl = up.url; }
      } catch {}
    }
  } else if (type === 'location') text = '📍 shared location';
  else if (type === 'sticker') text = '[sticker]';

  const message = await one<any>(
    `INSERT INTO messages (org_id, conversation_id, contact_id, direction, wa_message_id, type, body, media_url, status)
     VALUES ($1,$2,$3,'inbound',$4,$5,$6,$7,'received') RETURNING *`,
    [org.id, conv.id, contact.id, msg.id, type === 'voice' ? 'audio' : type, text, mediaUrl]
  );

  await query(`UPDATE conversations SET last_message=$2, last_message_at=NOW(), unread_count=unread_count+1, status='open' WHERE id=$1`, [conv.id, (text || `[${type}]`).slice(0, 200)]);
  if (creds && msg.id) whatsapp.markRead(creds, msg.id).catch(() => {});
  emitToOrg(org.id, 'message:new', { message, conversationId: conv.id });

  // Sentiment analysis (async)
  sentiment.processMessage(org.id, conv.id, contact.id, message.id, text).catch(() => {});

  // Journey log
  journey.log(org.id, contact.id, 'message', `Inbound: ${text.slice(0, 60)}`, text.slice(0, 200), message.id).catch(() => {});

  // Keyword auto-reply (check before AI)
  if (text && text.length > 1) {
    keywordReply.findMatch(org.id, text).then(async (match) => {
      if (match && creds) {
        try {
          await whatsapp.sendText(creds, contact.phone, match.reply_text);
        } catch {}
      } else if (org.ai_enabled && conv.ai_enabled && text.length > 1 && ai.enabled) {
        aiReplyQueue.add('reply', { orgId: org.id, contactId: contact.id, conversationId: conv.id, inboundText: text }).catch(() => {});
      }
    }).catch(() => {});
    return;
  }

  // Trigger deal analysis
  if (ai.enabled && text) enqueueDealAnalyze(org.id, conv.id).catch(() => {});

  if ((type === 'audio' || type === 'voice') && mediaBuffer && mediaBuffer.length < 25 * 1024 * 1024) {
    transcribeQueue.add('transcribe', { orgId: org.id, messageId: message.id, bufferBase64: mediaBuffer.toString('base64'), filename: 'voice.ogg' }).catch(() => {});
    return;
  }

  // AI reply handled above by keyword check
}

async function handleStatus(org: any, st: any) {
  const map: Record<string, string> = { sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' };
  const status = map[st.status];
  if (!status) return;
  await query(`UPDATE messages SET status=$3 WHERE wa_message_id=$1 AND org_id=$2`, [st.id, org.id, status]);
  await query(`UPDATE campaign_recipients SET status=$3 WHERE wa_message_id=$1 AND org_id=$2`, [st.id, org.id, status]);
  if (status === 'delivered') await query(`UPDATE campaigns SET delivered = delivered + 1 WHERE id IN (SELECT campaign_id FROM campaign_recipients WHERE wa_message_id=$1)`, [st.id]);
  else if (status === 'read') await query(`UPDATE campaigns SET read_count = read_count + 1 WHERE id IN (SELECT campaign_id FROM campaign_recipients WHERE wa_message_id=$1)`, [st.id]);
  else if (status === 'failed') await query(`UPDATE campaigns SET failed = failed + 1 WHERE id IN (SELECT campaign_id FROM campaign_recipients WHERE wa_message_id=$1)`, [st.id]);
  emitToOrg(org.id, 'message:status', { waMessageId: st.id, status });
}

router.get('/leads', (req, res) => {
  const mode = req.query['hub.mode']; const token = req.query['hub.verify_token']; const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

router.post('/leads', asyncHandler(async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    if (body.object !== 'page') return;
    for (const entry of body.entry || []) {
      const pageId = entry.id;
      const org = await one<any>(`SELECT * FROM organizations WHERE meta_page_id = $1`, [pageId]);
      if (!org) continue;
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue;
        const leadgenId = change.value?.leadgen_id;
        if (!leadgenId) continue;
        let fields: any = {};
        if (org.meta_page_token) {
          try {
            const axios = (await import('axios')).default;
            const { data } = await axios.get(`https://graph.facebook.com/v19.0/${leadgenId}`, { params: { access_token: org.meta_page_token, fields: 'field_data,form_id,ad_id,campaign_name' } });
            for (const f of data.field_data || []) fields[f.name] = f.values?.[0];
          } catch {}
        }
        const phone = normalizePhone(fields.phone_number || fields.phone || '');
        if (!phone) continue;
        const lead = await one<any>(
          `INSERT INTO leads (org_id, source, external_id, name, phone, email, city, form_name, payload)
           VALUES ($1,'meta_ads',$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [org.id, leadgenId, fields.full_name || null, phone, fields.email || null, fields.city || null, fields._form_id || null, JSON.stringify(fields)]
        );
        leadScoreQueue.add('score', { leadId: lead.id, orgId: org.id, payload: fields }).catch(() => {});
        emitToOrg(org.id, 'lead:new', { lead });
      }
    }
  } catch (e: any) { logger.error('lead webhook error', e.message); }
}));

router.post('/razorpay', asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  if (!signature) return res.sendStatus(400);
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
  let valid = false;
  try { valid = payments.verifyWebhookSignature(rawBody, signature); } catch {}
  if (!valid) return res.sendStatus(400);
  res.sendStatus(200);
  try {
    const event = JSON.parse(rawBody);
    if (event.event === 'payment_link.paid' || event.event === 'payment.captured') {
      const pl = event.payload?.payment_link?.entity; const pay = event.payload?.payment?.entity;
      const amount = (pl?.amount || pay?.amount || 0) / 100;
      const orgId = pl?.notes?.orgId || pay?.notes?.orgId;
      if (orgId) await billing.credit(orgId, amount, 'topup', `Razorpay ${pay?.id}`, pay?.id);
      await query(`UPDATE payments SET status='paid', razorpay_payment_id=$2, paid_at=NOW() WHERE razorpay_order_id=$1 OR short_url=$3`, [pl?.id ?? '', pay?.id ?? '', pl?.short_url ?? '']);
    }
  } catch (e: any) { logger.error('razorpay handler error', e.message); }
}));

router.post('/exotel/status', asyncHandler(async (req, res) => {
  res.sendStatus(200);
  try {
    const { CallSid, From, To, Status, RecordingUrl, ConversationDuration } = req.body;
    if (!To) return;
    const org = await one<any>(`SELECT * FROM organizations WHERE exotel_number = $1`, [normalizePhone(To)]);
    if (!org) return;
    const phone = normalizePhone(From);
    const contact = await one<any>(`SELECT * FROM contacts WHERE org_id=$1 AND phone=$2`, [org.id, phone]);
    const call = await one<any>(
      `INSERT INTO ivr_calls (org_id, contact_id, exotel_call_id, direction, from_number, to_number, duration_sec, recording_url, status)
       VALUES ($1,$2,$3,'inbound',$4,$5,$6,$7,$8) RETURNING *`,
      [org.id, contact?.id ?? null, CallSid, phone, normalizePhone(To), Number(ConversationDuration || 0), RecordingUrl ?? null, Status || 'completed']
    );
    if (RecordingUrl) ivrQueue.add('transcribe', { callId: call.id, orgId: org.id, RecordingUrl }).catch(() => {});
    emitToOrg(org.id, 'ivr:call', { call });
  } catch (e: any) { logger.error('exotel error', e.message); }
}));

router.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

export default router;
