import { pool } from './db.mjs';
await pool.query('ALTER TABLE content_overrides ADD COLUMN IF NOT EXISTS idx INTEGER NOT NULL DEFAULT 0');
await pool.query('ALTER TABLE content_overrides ADD COLUMN IF NOT EXISTS tag TEXT NOT NULL DEFAULT ' + "''");
console.log('migration OK');
await pool.end();
