import { UnauthorizedError } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/jwt.js';
export function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing bearer token.'));
  }
  try {
    req.auth = verifyAccessToken(header.slice(7));
    return next();
  } catch {
    return next(new UnauthorizedError('Invalid access token.'));
  }
}