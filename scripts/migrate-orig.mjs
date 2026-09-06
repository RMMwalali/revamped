import { pool } from './db.mjs';
await pool.query('ALTER TABLE content_overrides ADD COLUMN IF NOT EXISTS orig_html TEXT');
console.log('migration OK');
await pool.end();
