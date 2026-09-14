import { pool } from './db.mjs';
import bcrypt from 'bcryptjs';

try {
  const r = await pool.query("SELECT id, email, password_hash FROM admins WHERE email = $1", ['super@stillcraftevents.co.ke']);
  const row = r.rows[0];
  console.log('SUPABASE row found:', !!row, row ? 'email=' + row.email : '', row ? 'hashlen=' + row.password_hash.length : '');
  if (row) {
    const ok = await bcrypt.compare('$tillKr@ft13', row.password_hash);
    console.log('SUPABASE bcrypt match:', ok);
    const ok2 = await bcrypt.compare('@ft13', row.password_hash);
    console.log('  (probing "\\049ft13":', ok2, ')');
  }
  const s = await pool.query('SELECT count(*) FROM sessions');
  console.log('sessions count:', s.rows[0].count);
} catch (e) {
  console.log('ERR:', e.message);
}
try { await pool.end(); } catch {}
process.exit(0);