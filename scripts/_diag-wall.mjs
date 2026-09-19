import { pool } from './db.mjs';

const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
console.log('tables:', r.rows.map(x => x.table_name).join(', '));

try {
  const c = await pool.query("SELECT key, length(value)::int AS n, left(value, 500) AS v FROM cms_sections WHERE key = 'logos'");
  console.log('logos rows:', c.rows.length);
  for (const row of c.rows) console.log('  n=', row.n, 'value=', JSON.stringify(row.v));
} catch (e) { console.log('logos ERR', e.message); }

await pool.end();