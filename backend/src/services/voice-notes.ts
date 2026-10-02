import { openai } from './openai';
import { storage } from './cloudinary';
import { logger } from '../lib/logger';
import fs from 'fs';

export const voiceNotes = {
  /** Generate voice note from text using OpenAI TTS */
  async generate(text: string, voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy'): Promise<{ url: string; duration: number }> {
    if (!openai) throw new Error('OpenAI not configured');
    if (!storage.enabled) throw new Error('Cloudinary not configured for media storage');

    try {
      const resp = await openai.audio.speech.create({
        model: 'tts-1',
        voice,
        input: text,
        response_format: 'mp3',
      });

      const buffer = Buffer.from(await resp.arrayBuffer());
      const uploaded = await storage.upload(buffer, 'chatnexa/voice-notes', 'video');
      // Rough duration estimate: ~150 words/min = 2.5 words/sec
      const words = text.split(/\s+/).length;
      const duration = Math.max(2, Math.round(words / 2.5));

      return { url: uploaded.url, duration };
    } catch (e: any) {
      logger.error('voice generation failed:', e.message);
      throw new Error('Voice generation failed: ' + e.message);
    }
  },
};
