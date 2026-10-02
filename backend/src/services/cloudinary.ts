import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';
import { logger } from '../lib/logger';

const configured = !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
if (configured) {
  cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true });
}

export const storage = {
  get enabled() { return configured; },
  async upload(buffer: Buffer, folder = 'chatnexa', resourceType: 'auto'|'image'|'video'|'raw' = 'auto') {
    if (!configured) throw new Error('Cloudinary not configured');
    return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder, resource_type: resourceType }, (err, result) => {
        if (err || !result) return reject(err || new Error('upload failed'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      });
      stream.end(buffer);
    });
  },
  async destroy(publicId: string) {
    if (!configured) return;
    try { await cloudinary.uploader.destroy(publicId); }
    catch (e: any) { logger.warn('cloudinary destroy failed', e.message); }
  },
};
