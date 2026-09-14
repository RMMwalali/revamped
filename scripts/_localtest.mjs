import pg from 'pg';
import bcrypt from 'bcryptjs';

const url = 'postgresql://stillcraft_app:-qQ_fYEZTqFA5OQGj4eLFhsX@127.0.0.1:5432/stillcraft';
const p = new pg.Pool({ connectionString: url, max: 1 });
try {
  const r = await p.query('SELECT id, email, password_hash FROM admins WHERE email = $1', ['super@stillcraftevents.co.ke']);
  const row = r.rows[0];
  if (!row) { console.log('local: NO ROW'); }
  else {
    const ok = await bcrypt.compare('$tillKr@ft13', row.password_hash);
    console.log('local: row exists, email=' + row.email + ', hashlen=' + row.password_hash.length + ', PASSWORD MATCH=' + ok);
  }
} catch (e) {
  console.log('local ERR:', e.message.split('\n')[0]);
} finally { try { await p.end(); } catch {} }
process.exit(0);