import { pool } from '../config/database.js';

const mutatingMethods = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export function auditAdminMutation(req, res, next) {
  if (!mutatingMethods.has(req.method)) return next();

  const startedAt = Date.now();
  res.once('finish', () => {
    pool.query(
      `insert into admin_audit_logs
        (method, path, status_code, ip_address, user_agent, duration_ms)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        req.method,
        req.originalUrl.slice(0, 500),
        res.statusCode,
        req.ip?.slice(0, 64) ?? null,
        req.get('user-agent')?.slice(0, 500) ?? null,
        Date.now() - startedAt,
      ],
    ).catch(() => {
      // Auditing must not expose database failures or crash a completed response.
    });
  });
  return next();
}
