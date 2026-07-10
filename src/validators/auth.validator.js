import { z } from 'zod';

export const loginSchema = z.object({
  playerTag: z.string().min(1),
  verifyToken: z.string().min(1),
  deviceInfo: z.string().max(255).optional()
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});
