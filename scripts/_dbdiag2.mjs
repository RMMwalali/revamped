import pg from 'pg';

const urls = {
  local_super: process.env.PGLOCAL || 'postgresql://postgres:eH1iY9L16Y0OXvJ_CNJHQ9Q7@127.0.0.1:5432/stillcraft',
  local_app: 'postgresql://stillcraft_app:-qQ_fYEZTqFA5OQGj4eLFhsX@127.0.0.1:5432/stillcraft',
};

for (const [label, url] of Object.entries(urls)) {
  const p = new pg.Pool({ connectionString: url, max: 1 });
  try {
    const r = await p.query('SELECT id, email, password_hash FROM admins');
    console.log(`[${label}] OK`);
    for (const row of r.rows) {
      console.log('  ', row.id, row.email, 'hashlen', row.password_hash ? row.password_hash.length : 0);
    }
  } catch (e) {
    console.log(`[${label}] ERR ${e.message.split('\n')[0]}`);
  } finally {
    try { await p.end(); } catch {}
  }
}
process.exit(0);