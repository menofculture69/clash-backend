import { pool } from '../config/database.js';
import { AppError, UnauthorizedError } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/jwt.js';
export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing bearer token.'));
  }
  try {
    req.auth = verifyAccessToken(header.slice(7));
    const result = await pool.query(
      `select u.banned_until, u.ban_reason, u.banned_at,
              s.id as active_session_id
       from app_users u
       left join app_sessions s on s.id = $2 and s.user_id = u.id
         and s.revoked_at is null and s.expires_at > now()
       where u.id = $1`,
      [req.auth.sub, req.auth.sessionId]
    );
    const user = result.rows[0];
    if (!user?.active_session_id) {
      return next(new UnauthorizedError('Session is invalid or expired.'));
    }
    const banned = user?.banned_at && (!user.banned_until || new Date(user.banned_until).getTime() > Date.now());
    if (banned) {
      return next(new AppError(
        user.banned_until ? 'Account is temporarily banned.' : 'Account is permanently banned.',
        403,
        true,
        { ban: { bannedUntil: user.banned_until, banReason: user.ban_reason || '' } }
      ));
    }
    return next();
  } catch {
    return next(new UnauthorizedError('Invalid access token.'));
  }
}

export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next();
  }

  try {
    const auth = verifyAccessToken(header.slice(7));
    const result = await pool.query(
      `select s.id as active_session_id
       from app_users u
       left join app_sessions s on s.id = $2 and s.user_id = u.id
         and s.revoked_at is null and s.expires_at > now()
       where u.id = $1`,
      [auth.sub, auth.sessionId]
    );
    if (result.rows[0]?.active_session_id) {
      req.auth = auth;
    }
  } catch {
    // Public reads should still work when a saved local account has a stale
    // access token. Mutations continue to use requireAuth.
  }

  return next();
}
