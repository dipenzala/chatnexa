import axios from 'axios';
import { logger } from '../lib/logger';
import { decrypt } from '../lib/crypto';
import { one } from '../db/pool';
export const bsp = {
  get enabled() { return !!(process.env.BSP_API_KEY); },
  async getApiKey(orgId: string): Promise<string | null> {
    const org = await one<any>(`SELECT bsp_api_key_encrypted FROM organizations WHERE id = $1`, [orgId]);
    return org?.bsp_api_key_encrypted ? decrypt(org.bsp_api_key_encrypted) : null;
  },
  async sendText(orgId: string, phone: string, text: string) {
    const apiKey = await this.getApiKey(orgId);
    if (!apiKey) throw new Error('BSP not connected');
    const r = await axios.post('https://waba-v2.360dialog.io/messages',
      { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: text } },
      { headers: { 'D360-API-KEY': apiKey, 'Content-Type': 'application/json' }, timeout: 25000 });
    return r.data?.messages?.[0]?.id;
  },
  async sendTemplate(orgId: string, phone: string, name: string, language: string, bodyParams: string[] = []) {
    const apiKey = await this.getApiKey(orgId);
    if (!apiKey) throw new Error('BSP not connected');
    const components = bodyParams.length ? [{ type: 'body', parameters: bodyParams.map((t) => ({ type: 'text', text: t })) }] : [];
    const r = await axios.post('https://waba-v2.360dialog.io/messages',
      { messaging_product: 'whatsapp', to: phone, type: 'template', template: { name, language: { code: language }, ...(components.length ? { components } : {}) } },
      { headers: { 'D360-API-KEY': apiKey, 'Content-Type': 'application/json' }, timeout: 25000 });
    return r.data?.messages?.[0]?.id;
  },
  async createChannel(_o: any) { logger.warn('BSP not configured'); return null; },
  async getClient(_o: string) { return null; },
  async getBilling(_o: string, _f: string, _t: string) { return null; },
};
