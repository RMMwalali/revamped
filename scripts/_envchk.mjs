import { pool } from './db.mjs';
console.log('DB host:', (process.env.DATABASE_URL || '').replace(/\/\/[^@]*@/, '//@'));
try {
  const r = await pool.query('SELECT 1 AS ok');
  console.log('active file .env pool OK');
} catch (e) {
  console.log('active file .env pool ERR:', e.message.split('\n')[0]);
}
try { await pool.end(); } catch {}
process.exit(0);