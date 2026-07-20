import rateLimit from 'express-rate-limit';

import { env } from '../config/env.js';

export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.GLOBAL_RATE_LIMIT_MAX,
  // Mobile screens issue several parallel reads and account switching repeats
  // them. Read-only traffic must not exhaust the shared IP mutation budget.
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' }
});

export const authRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: Math.max(env.AUTH_RATE_LIMIT_MAX, 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Please wait a few minutes before trying again.'
  }
});

export const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many admin requests. Please try again later.' }
});
