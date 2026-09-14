import bcrypt from 'bcryptjs';
import { pool } from './db.mjs';

const email = 'super@stillcraftevents.co.ke';
const password = '$tillKr@ft13';
const hash = await bcrypt.hash(password, 12);
await pool.query(
  `INSERT INTO admins (email, password_hash) VALUES ($1, $2)
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
  [email, hash]
);
const chk = await pool.query('SELECT password_hash FROM admins WHERE email = $1', [email]);
const ok = await bcrypt.compare(password, chk.rows[0].password_hash);
console.log('SUPABASE reseeded, bcrypt match:', ok);
await pool.end();
process.exit(ok ? 0 : 1);