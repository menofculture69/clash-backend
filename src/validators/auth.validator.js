import { z } from 'zod';

export const loginSchema = z.object({
  playerTag: z.string().min(1),
  verifyToken: z.string().min(1),
  deviceInfo: z.string().max(255).optional()
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

export const avatarUpdateSchema = z.object({
  dataUrl: z.string()
    .max(2_700_000, 'Image must be smaller than 2 MB.')
    .regex(/^data:image\/(?:jpeg|jpg|png|webp);base64,/i, 'Only JPEG, PNG, and WebP images are allowed.')
});
