import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { decrypt } from '../lib/crypto';

export interface WaCreds { phoneNumberId: string; accessToken: string }

export function credsFromOrg(org: any): WaCreds | null {
  if (!org?.wa_phone_number_id || !org?.wa_access_token) return null;
  return { phoneNumberId: org.wa_phone_number_id, accessToken: decrypt(org.wa_access_token) || org.wa_access_token };
}

function client(c: WaCreds): AxiosInstance {
  return axios.create({
    baseURL: `${env.META_GRAPH_URL}/${env.META_API_VERSION}`,
    headers: { Authorization: `Bearer ${c.accessToken}`, 'Content-Type': 'application/json' },
    timeout: 25_000,
  });
}

export function normalizePhone(raw: string, cc = '91'): string {
  let p = String(raw || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (!p) return '';
  if (p.length === 10) p = cc + p;
  if (p.startsWith('0')) p = cc + p.replace(/^0+/, '');
  return p;
}

export const whatsapp = {
  async sendText(c: WaCreds, to: string, body: string, previewUrl = false) {
    const { data } = await client(c).post(`/${c.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp', recipient_type: 'individual',
      to: normalizePhone(to), type: 'text', text: { preview_url: previewUrl, body },
    });
    return data?.messages?.[0]?.id as string;
  },
  async sendTemplate(c: WaCreds, to: string, name: string, lang = 'en', bodyParams: string[] = [], headerParams: string[] = []) {
    const components: any[] = [];
    if (headerParams.length) components.push({ type: 'header', parameters: headerParams.map((t) => ({ type: 'text', text: t })) });
    if (bodyParams.length) components.push({ type: 'body', parameters: bodyParams.map((t) => ({ type: 'text', text: t })) });
    const { data } = await client(c).post(`/${c.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp', to: normalizePhone(to), type: 'template',
      template: { name, language: { code: lang }, ...(components.length ? { components } : {}) },
    });
    return data?.messages?.[0]?.id as string;
  },
  async sendMedia(c: WaCreds, to: string, type: 'image'|'video'|'document'|'audio', url: string, caption?: string, filename?: string) {
    const media: any = { link: url };
    if (caption && type !== 'audio') media.caption = caption;
    if (type === 'document' && filename) media.filename = filename;
    const { data } = await client(c).post(`/${c.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp', to: normalizePhone(to), type, [type]: media,
    });
    return data?.messages?.[0]?.id as string;
  },
  async sendButtons(c: WaCreds, to: string, body: string, buttons: { id: string; title: string }[]) {
    const { data } = await client(c).post(`/${c.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp', to: normalizePhone(to), type: 'interactive',
      interactive: {
        type: 'button', body: { text: body },
        action: { buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) },
      },
    });
    return data?.messages?.[0]?.id as string;
  },
  async markRead(c: WaCreds, id: string) {
    try { await client(c).post(`/${c.phoneNumberId}/messages`, { messaging_product: 'whatsapp', status: 'read', message_id: id }); }
    catch (e: any) { logger.warn('markRead failed', e.message); }
  },
  async downloadMedia(c: WaCreds, mediaId: string) {
    const meta = await client(c).get(`/${mediaId}`);
    const bin = await axios.get(meta.data?.url, { headers: { Authorization: `Bearer ${c.accessToken}` }, responseType: 'arraybuffer', timeout: 60_000 });
    return { buffer: Buffer.from(bin.data), mime: meta.data?.mime_type || 'application/octet-stream' };
  },
  async uploadMedia(c: WaCreds, buffer: Buffer, mime: string, filename = 'file') {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('file', buffer, { filename, contentType: mime });
    const { data } = await client(c).post(`/${c.phoneNumberId}/media`, form, { headers: { ...form.getHeaders() } });
    return data?.id as string;
  },
  async createTemplate(c: WaCreds, wabaId: string, payload: any) {
    const { data } = await client(c).post(`/${wabaId}/message_templates`, payload);
    return data;
  },
  async listTemplates(c: WaCreds, wabaId: string) {
    const { data } = await client(c).get(`/${wabaId}/message_templates`, { params: { limit: 200, fields: 'id,name,status,category,language,components' } });
    return data?.data || [];
  },
  async getPhoneNumber(c: WaCreds) {
    const { data } = await client(c).get(`/${c.phoneNumberId}`, { params: { fields: 'display_phone_number,verified_name,quality_rating' } });
    return data;
  },
};
