import axios from 'axios';
import { logger } from '../lib/logger';
const PRIVATE = [/^localhost$/i, /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^169\.254\./, /^::1$/, /^fc00:/i, /^fe80:/i, /metadata\.google/i];
function safeUrl(url: string): boolean {
  try { const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    return !PRIVATE.some((p) => p.test(u.hostname));
  } catch { return false; }
}
export const ragExtractor = {
  async extractFromPdf(buffer: Buffer): Promise<string> {
    try { const p: any = await import('pdf-parse'); const m = p.default || p; const d = await m(buffer); return (d?.text || '').toString(); }
    catch (e: any) { logger.warn('PDF fail:', e.message); throw new Error('Could not read PDF'); }
  },
  async extractFromDocx(buffer: Buffer): Promise<string> {
    try { const m: any = await import('mammoth'); const md = m.default || m; const r = await md.extractRawText({ buffer }); return r?.value || ''; }
    catch (e: any) { logger.warn('DOCX fail:', e.message); throw new Error('Could not read DOCX'); }
  },
  async extractFromUrl(url: string): Promise<string> {
    if (!safeUrl(url)) throw new Error('URL not allowed');
    const resp = await axios.get(url, { timeout: 20000, maxContentLength: 5 * 1024 * 1024, maxRedirects: 3 });
    return String(resp.data).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50000);
  },
  async extractFromTxt(buffer: Buffer): Promise<string> { return buffer.toString('utf8'); },
  async extract(buffer: Buffer, mime: string, filename: string): Promise<string> {
    const l = (filename || '').toLowerCase();
    if (mime.includes('pdf') || l.endsWith('.pdf')) return this.extractFromPdf(buffer);
    if (mime.includes('word') || l.endsWith('.docx') || l.endsWith('.doc')) return this.extractFromDocx(buffer);
    if (mime.includes('text') || l.endsWith('.txt') || l.endsWith('.md') || l.endsWith('.csv')) return this.extractFromTxt(buffer);
    throw new Error(`Unsupported: ${mime || filename}`);
  },
};
