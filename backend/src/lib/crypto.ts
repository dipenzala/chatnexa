import crypto from 'crypto';
import { env } from '../config/env';

const KEY = crypto.createHash('sha256').update(env.JWT_SECRET).digest();

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
}

export function decrypt(payload: string): string {
  try {
    const [ivB64, tagB64, dataB64] = payload.split('.');
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64'));
    d.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([d.update(Buffer.from(dataB64, 'base64')), d.final()]).toString('utf8');
  } catch { return ''; }
}

export const randomKey = (prefix = 'cnx') => `${prefix}_${crypto.randomBytes(24).toString('hex')}`;
