import { pool } from '../config/database.js';

export class AuditRepository {
  async logAuthEvent(input) {
    await pool.query(
      `
      insert into auth_audit_logs (player_tag, success, ip_address, device_info, reason)
      values ($1, $2, $3, $4, $5)
      `,
      [input.playerTag, input.success, input.ipAddress ?? null, input.deviceInfo ?? null, input.reason ?? null]
    );
  }
}

export const auditRepository = new AuditRepository();