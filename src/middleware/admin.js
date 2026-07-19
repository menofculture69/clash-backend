import crypto from 'crypto';

import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export function requireAdmin(req, _res, next) {
  const supplied = req.get('x-admin-key') ?? '';
  const expected = env.ADMIN_API_KEY ?? '';
  const valid = supplied.length === expected.length && expected.length > 0 &&
    crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!valid) {
    return next(new AppError('Admin access is required.', 401, true));
  }
  return next();
}
