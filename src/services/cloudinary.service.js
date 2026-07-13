import crypto from 'crypto';

import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export class CloudinaryService {
  async uploadDataUrl({ dataUrl, folder = 'clash-companion' }) {
    if (!env.hasCloudinary) {
      throw new AppError('Cloudinary is not configured.', 503, true);
    }

    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      throw new AppError('A valid image data URL is required.', 400, true);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');
    const form = new FormData();
    form.set('file', dataUrl);
    form.set('api_key', env.CLOUDINARY_API_KEY);
    form.set('timestamp', String(timestamp));
    form.set('folder', folder);
    form.set('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: form
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AppError(
        payload.error?.message ?? 'Cloudinary upload failed.',
        response.status,
        true
      );
    }

    return {
      url: payload.secure_url,
      publicId: payload.public_id,
      width: payload.width,
      height: payload.height,
      bytes: payload.bytes,
      format: payload.format
    };
  }
}

export const cloudinaryService = new CloudinaryService();
