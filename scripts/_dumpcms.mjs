import { pool } from './db.mjs';
const r = await pool.query('SELECT section, data FROM cms_sections');
for (const row of r.rows) {
  console.log('==== ' + row.section + ' ====');
  console.log(JSON.stringify(row.data, null, 1).slice(0, 4000));
  console.log();
}
await pool.end();