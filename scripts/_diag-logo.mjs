import { pool } from './db.mjs';

const r = await pool.query("SELECT data FROM cms_sections WHERE section = 'logos'");
if (!r.rows.length) { console.log('no logos row'); await pool.end(); process.exit(0); }
const data = r.rows[0].data;
console.log('logos data:', JSON.stringify(data, null, 2).slice(0, 2500));
await pool.end();