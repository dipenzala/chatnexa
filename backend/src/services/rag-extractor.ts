import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import axios from 'axios';
import { logger } from '../lib/logger';

export const ragExtractor = {
  async extractFromPdf(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (e: any) {
      logger.warn('PDF extract failed:', e.message);
      throw new Error('Could not read PDF file');
    }
  },

  async extractFromDocx(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (e: any) {
      logger.warn('DOCX extract failed:', e.message);
      throw new Error('Could not read DOCX file');
    }
  },

  async extractFromUrl(url: string): Promise<string> {
    try {
      const resp = await axios.get(url, { timeout: 20000, maxContentLength: 5 * 1024 * 1024 });
      const html = String(resp.data);
      // Strip HTML tags, scripts, styles
      const cleaned = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
      return cleaned.slice(0, 50000);
    } catch (e: any) {
      logger.warn('URL extract failed:', e.message);
      throw new Error('Could not fetch URL content');
    }
  },

  async extractFromTxt(buffer: Buffer): Promise<string> {
    return buffer.toString('utf8');
  },

  async extract(buffer: Buffer, mime: string, filename: string): Promise<string> {
    const lower = (filename || '').toLowerCase();
    if (mime.includes('pdf') || lower.endsWith('.pdf')) return this.extractFromPdf(buffer);
    if (mime.includes('word') || lower.endsWith('.docx') || lower.endsWith('.doc')) return this.extractFromDocx(buffer);
    if (mime.includes('text') || lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.csv')) return this.extractFromTxt(buffer);
    throw new Error(`Unsupported file type: ${mime || filename}`);
  },
};
