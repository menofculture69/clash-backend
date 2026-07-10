import { pool } from '../config/database.js';

export class SessionRepository {
  async createSession(input) {
    const result = await pool.query(
      `
      insert into app_sessions (user_id, refresh_token_hash, device_info, expires_at)
      values ($1, $2, $3, $4)
      returning id, user_id, refresh_token_hash, device_info, expires_at, revoked_at
      `,
      [input.userId, input.refreshTokenHash, input.deviceInfo ?? null, input.expiresAt]
    );
    return result.rows[0];
  }

  async getById(sessionId) {
    const result = await pool.query(
      `select id, user_id, refresh_token_hash, device_info, expires_at, revoked_at from app_sessions where id = $1`,
      [sessionId]
    );
    return result.rows[0] ?? null;
  }

  async rotateRefreshToken(sessionId, refreshTokenHash, expiresAt) {
    await pool.query(
      `update app_sessions set refresh_token_hash = $2, expires_at = $3, revoked_at = null, last_used_at = now() where id = $1`,
      [sessionId, refreshTokenHash, expiresAt]
    );
  }

  async touchSession(sessionId) {
    await pool.query(`update app_sessions set last_used_at = now() where id = $1`, [sessionId]);
  }

  async revokeSession(sessionId) {
    await pool.query(`update app_sessions set revoked_at = now() where id = $1`, [sessionId]);
  }
}

export const sessionRepository = new SessionRepository();