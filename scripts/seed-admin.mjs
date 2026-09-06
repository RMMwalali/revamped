// Create (or reset password for) an admin: node scripts/seed-admin.mjs <email> <password>
import bcrypt from 'bcryptjs';
import { pool } from './db.mjs';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('usage: node scripts/seed-admin.mjs <email> <password>');
  process.exit(1);
}
const hash = await bcrypt.hash(password, 12);
await pool.query(
  `INSERT INTO admins (email, password_hash) VALUES ($1, $2)
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
  [email.toLowerCase(), hash]
);
console.log('admin OK:', email.toLowerCase());
await pool.end();
