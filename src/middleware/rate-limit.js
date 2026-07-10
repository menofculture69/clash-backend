import rateLimit from 'express-rate-limit';

import { env } from '../config/env.js';

export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.GLOBAL_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many authentication attempts. Please try again later.'
  }
});
