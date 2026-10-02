import { env } from '../config/env';
import { logger } from '../lib/logger';
import { one, query, many } from '../db/pool';
import { whatsapp, credsFromOrg } from './whatsapp';
import { openai } from './openai';

/* ============================================================
   CLIENT LOVE — Birthday, Festival, Review, Referral
============================================================ */

const INDIAN_FESTIVALS = [
  { name: 'Diwali', month: 10, day: 20 },
  { name: 'Holi', month: 3, day: 14 },
  { name: 'Raksha Bandhan', month: 8, day: 19 },
  { name: 'Navratri', month: 10, day: 3 },
  { name: 'Christmas', month: 12, day: 25 },
  { name: 'Eid', month: 4, day: 10 },
  { name: 'Ganesh Chaturthi', month: 9, day: 7 },
  { name: 'Karwa Chauth', month: 10, day: 20 },
];

export const clientLove = {
  /** Called daily — sends birthday wishes */
  async runBirthdays(): Promise<number> {
    const orgs = await many<any>(`SELECT * FROM organizations WHERE ai_enabled = TRUE`);
    let sent = 0;

    for (const org of orgs) {
      if (!org.notify_birthdays) continue;
      const creds = credsFromOrg(org);
      if (!creds) continue;

      const contacts = await many<any>(
        `SELECT c.* FROM contacts c
          WHERE c.org_id = $1
            AND c.opt_in = TRUE
            AND c.blocked = FALSE
            AND c.birthday IS NOT NULL
            AND EXTRACT(MONTH FROM c.birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
            AND EXTRACT(DAY FROM c.birthday) = EXTRACT(DAY FROM CURRENT_DATE)
            AND NOT EXISTS (
              SELECT 1 FROM greeting_log g
              WHERE g.contact_id = c.id
                AND g.greeting_type = 'birthday'
                AND DATE(g.sent_at) = CURRENT_DATE
            )`,
        [org.id]
      );

      for (const contact of contacts) {
        try {
          const msg = await this.generateGreeting('birthday', contact, org);
          const waId = await whatsapp.sendText(creds, contact.phone, msg);

          await query(
            `INSERT INTO greeting_log (org_id, contact_id, greeting_type, message, wa_message_id)
             VALUES ($1,$2,'birthday',$3,$4)`,
            [org.id, contact.id, msg, waId]
          );
          sent++;
          await new Promise((r) => setTimeout(r, 100));
        } catch (e: any) { logger.warn('birthday send failed', e.message); }
      }
    }
    return sent;
  },

  /** Called daily — sends festival greetings */
  async runFestivals(): Promise<number> {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const festival = INDIAN_FESTIVALS.find((f) => f.month === month && f.day === day);
    if (!festival) return 0;

    const orgs = await many<any>(`SELECT * FROM organizations WHERE ai_enabled = TRUE`);
    let sent = 0;

    for (const org of orgs) {
      const creds = credsFromOrg(org);
      if (!creds) continue;

      const contacts = await many<any>(
        `SELECT c.* FROM contacts c
          WHERE c.org_id = $1 AND c.opt_in = TRUE AND c.blocked = FALSE
            AND NOT EXISTS (
              SELECT 1 FROM greeting_log g
              WHERE g.contact_id = c.id AND g.greeting_type = 'festival'
                AND g.festival_name = $2 AND DATE(g.sent_at) = CURRENT_DATE
            )
          LIMIT 500`,
        [org.id, festival.name]
      );

      for (const contact of contacts) {
        try {
          const msg = await this.generateGreeting('festival', contact, org, festival.name);
          const waId = await whatsapp.sendText(creds, contact.phone, msg);

          await query(
            `INSERT INTO greeting_log (org_id, contact_id, greeting_type, festival_name, message, wa_message_id)
             VALUES ($1,$2,'festival',$3,$4,$5)`,
            [org.id, contact.id, festival.name, msg, waId]
          );
          sent++;
          await new Promise((r) => setTimeout(r, 100));
        } catch (e: any) { logger.warn('festival send failed', e.message); }
      }
    }
    return sent;
  },

  /** AI-generated greeting */
  async generateGreeting(type: 'birthday' | 'anniversary' | 'festival', contact: any, org: any, festivalName?: string): Promise<string> {
    const name = contact.name || 'ji';
    const bizName = org.name || 'our team';

    if (!openai) {
      if (type === 'birthday') return `🎂 Happy Birthday, ${name}! ${bizName} ki taraf se aapko bahut bahut shubhkamnaayein. Aapka din shubh ho! 🎉`;
      if (type === 'anniversary') return `💍 Happy Anniversary, ${name}! ${bizName} ki taraf se aap dono ko bahut pyaar aur shubhkamnaayein.`;
      return `✨ ${festivalName} ki hardik shubhkamnaayein, ${name}! ${bizName} parivaar ki taraf se. 🎊`;
    }

    try {
      const r = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          { role: 'system', content: 'You write warm, short WhatsApp greetings for Indian businesses. Use Hinglish/English. Under 40 words. Include 1-2 emojis.' },
          { role: 'user', content: `Type: ${type}${festivalName ? ` (${festivalName})` : ''}\nCustomer: ${name}\nBusiness: ${bizName}\n\nWrite a warm greeting.` },
        ],
        temperature: 0.8, max_tokens: 100,
      });
      return r.choices[0]?.message?.content?.trim() || `Hi ${name}, best wishes from ${bizName}!`;
    } catch {
      return `Hi ${name}, best wishes from ${bizName}! 🎉`;
    }
  },

  /** Generate + save referral code for a contact */
  async createReferralCode(orgId: string, contactId: string): Promise<string> {
    const contact = await one<any>(`SELECT * FROM contacts WHERE id=$1 AND org_id=$2`, [contactId, orgId]);
    if (!contact) throw new Error('Contact not found');

    if (contact.referral_code) return contact.referral_code;

    const code = `REF${contact.phone.slice(-6)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    await query(`UPDATE contacts SET referral_code=$2 WHERE id=$1`, [contactId, code]);
    return code;
  },

  /** Track referral signup */
  async trackReferral(orgId: string, referralCode: string, referredContactId: string) {
    const referrer = await one<any>(`SELECT * FROM contacts WHERE org_id=$1 AND referral_code=$2`, [orgId, referralCode]);
    if (!referrer) return null;

    const ref = await one(
      `INSERT INTO referrals (org_id, referrer_contact_id, referred_contact_id, referral_code)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [orgId, referrer.id, referredContactId, referralCode]
    );

    // Give referrer loyalty points
    await query(`UPDATE contacts SET loyalty_points = loyalty_points + 100 WHERE id=$1`, [referrer.id]);
    return ref;
  },

  /** Request Google review */
  async requestReview(orgId: string, contactId: string): Promise<boolean> {
    const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [orgId]);
    const contact = await one<any>(`SELECT * FROM contacts WHERE id=$1`, [orgId]);
    if (!org || !contact || !org.google_review_url) return false;
    if (contact.last_review_requested_at && Date.now() - new Date(contact.last_review_requested_at).getTime() < 90 * 86400_000) return false;

    const creds = credsFromOrg(org);
    if (!creds) return false;

    const msg = `Hi ${contact.name || 'ji'} 🙏\n\nHope aapko hamari service pasand aayi. Ek chhota sa favour — Google pe 2 min ka review likh denge? Bahut help hoga.\n\n${org.google_review_url}`;

    try {
      await whatsapp.sendText(creds, contact.phone, msg);
      await query(`UPDATE contacts SET last_review_requested_at=NOW() WHERE id=$1`, [contactId]);
      return true;
    } catch { return false; }
  },
};
