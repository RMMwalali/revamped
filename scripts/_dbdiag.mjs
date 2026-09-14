import { pool } from './db.mjs';

async function tryQuery(label, q) {
  try {
    const r = await pool.query(q);
    console.log(`[${label}] OK rows=${r.rows.length}`);
    return r.rows;
  } catch (e) {
    console.log(`[${label}] ERR ${e.message}`);
    return null;
  }
}

console.log('Using DATABASE_URL host: ' + (process.env.DATABASE_URL || '').replace(/\/\/.*@/, '//@'));
const admins = await tryQuery('admins', 'SELECT id, email FROM admins');
if (admins && admins.length) console.log('  emails:', admins.map((r) => r.email).join(', '));
else if (admins) console.log('  admins table empty');
await tryQuery('sessions', 'SELECT count(*) FROM sessions');
await tryQuery('brand_settings', 'SELECT key FROM brand_settings LIMIT 10');
try { await pool.end(); } catch {}
process.exit(0);