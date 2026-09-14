import pg from 'pg';
import bcrypt from 'bcryptjs';

const url = 'postgresql://postgres:eH1iY9L16Y0OXvJ_CNJHQ9Q7@127.0.0.1:5432/stillcraft';
const p = new pg.Pool({ connectionString: url, max: 1 });
const hash = await bcrypt.hash('$tillKr@ft13', 12);
await p.query(
  `INSERT INTO admins (email, password_hash) VALUES ($1, $2)
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
  ['super@stillcraftevents.co.ke', hash]
);
const chk = await p.query('SELECT email FROM admins WHERE email = $1', ['super@stillcraftevents.co.ke']);
console.log('local admin updated:', chk.rows[0].email);
await p.end();
process.exit(0);