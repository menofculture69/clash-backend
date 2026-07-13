import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export function requireAdmin(req, _res, next) {
  if (!env.ADMIN_API_KEY || req.get('x-admin-key') !== env.ADMIN_API_KEY) {
    return next(new AppError('Admin access is required.', 401, true));
  }
  return next();
}
