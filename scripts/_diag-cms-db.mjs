import { pool } from './db.mjs';
const r = await pool.query('SELECT section, data FROM cms_sections');
for (const row of r.rows) {
  console.log(row.section, JSON.stringify(row.data));
}
await pool.end();