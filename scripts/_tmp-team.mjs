import { pool } from './db.mjs';
pool.query('SELECT data FROM cms_sections WHERE section=$1', ['team']).then((r) => {
  const d = r.rows[0].data;
  const items = d.items || [];
  items.forEach((it, i) => console.log(i + ': ' + (it.name || '') + ' | ' + (it.role || '') + ' | bio(' + (it.bio || '').length + ') | ' + (it.bio || '').slice(0, 70)));
  process.exit(0);
}).catch((e) => { console.error(e.message); process.exit(1); });