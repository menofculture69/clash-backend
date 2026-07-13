import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { pool } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function ensureDatabaseSchema() {
  const schemaPath = path.resolve(__dirname, '../../sql/schema.sql');
  const sql = await readFile(schemaPath, 'utf8');
  await pool.query(sql);
}
