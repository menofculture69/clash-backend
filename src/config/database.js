import { Pool } from 'pg';

import { env } from './env.js';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Production database traffic must validate the server certificate.
  ssl: env.isProduction ? { rejectUnauthorized: true } : undefined,
});
