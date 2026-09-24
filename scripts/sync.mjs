// Sync admin-editable DB content between environments.
// Local edits (edit bar) write to the LOCAL database only; production reads
// its own database. After editing locally, push the rows to production:
//
//   node scripts/sync.mjs export backup.json        # from local DB (.env)
//   DB_URL="<supabase pooled string>" node scripts/sync.mjs import backup.json
//
// Only content_overrides + brand_settings are synced. Admins/sessions are
// per-environment: create logins with
//   DB_URL="<target>" node scripts/seed-admin.mjs <email> <password>
// Uploaded images live in dist/assets/custom/ — commit + push them so the
// static CDN serves the files the synced DB rows point at.
import { readFile, writeFile } from 'node:fs/promises';
import { pool } from './db.mjs';

const cmd = process.argv[2];
const file = process.argv[3];

if (cmd === 'export') {
  const overrides = await pool.query(
    'SELECT page, el_id, kind, value, orig_html, idx, tag FROM content_overrides ORDER BY page, el_id'
  ).catch((e) => { console.error('export failed (content_overrides):', e.message); process.exit(1); });
  const brand = await pool.query('SELECT key, value FROM brand_settings').catch((e) => {
    console.error('export failed (brand_settings):', e.message); process.exit(1);
  });
  const out = JSON.stringify(
    { exported_at: new Date().toISOString(), overrides: overrides.rows, brand: brand.rows }, null, 1);
  if (file) await writeFile(file, out, 'utf8');
  else process.stdout.write(out + '\n');
  console.error(`exported ${overrides.rows.length} override(s), ${brand.rows.length} brand key(s)` +
    (file ? ` -> ${file}` : ''));
  await pool.end();
} else if (cmd === 'import') {
  if (!file) { console.error('usage: node scripts/sync.mjs import <file>'); process.exit(1); }
  let data;
  try { data = JSON.parse(await readFile(file, 'utf8')); }
  catch (e) { console.error('cannot read', file + ':', e.message); process.exit(1); }
  let n = 0;
  for (const it of data.overrides || []) {
    if (!it || typeof it.el_id !== 'string' || !['text', 'image'].includes(it.kind)) continue;
    await pool.query(
      `INSERT INTO content_overrides (page, el_id, kind, value, orig_html, idx, tag, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (page, el_id) DO UPDATE SET kind = EXCLUDED.kind, value = EXCLUDED.value,
         orig_html = EXCLUDED.orig_html, idx = EXCLUDED.idx, tag = EXCLUDED.tag, updated_at = now()`,
      [String(it.page || '/'), it.el_id.slice(0, 200), it.kind, String(it.value || '').slice(0, 50000),
        typeof it.orig_html === 'string' ? it.orig_html.slice(0, 50000) : null,
        Math.max(0, Math.min(99, parseInt(it.idx, 10) || 0)),
        typeof it.tag === 'string' ? it.tag.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) : '']
    );
    n++;
  }
  let b = 0;
  for (const row of data.brand || []) {
    if (!row || typeof row.key !== 'string' || typeof row.value !== 'string') continue;
    await pool.query(
      'INSERT INTO brand_settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
      [row.key.slice(0, 100), row.value.slice(0, 500)]
    );
    b++;
  }
  console.log(`imported ${n} override(s), ${b} brand key(s) from ${file}`);
  await pool.end();
} else {
  console.error('usage: node scripts/sync.mjs export [file] | import <file>');
  process.exit(1);
}
