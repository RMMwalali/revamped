// Loads .env into process.env for local runs. The previous loader lived in
// db.mjs and went away with the Postgres migration, which left ADMIN_EMAIL,
// ADMIN_PASSWORD and APP_SECRET unset locally - so /insider login always
// answered "admin not configured" no matter what .env said.
//
// Import this before anything that reads process.env at module top level.
// Never overrides a variable that is already set, so Vercel's dashboard
// values always win, and it is a no-op when there is no .env file.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.cwd(), '.env');
if (existsSync(file)) {
  try {
    for (const raw of readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;
      // Take the remainder verbatim: bcrypt hashes are full of $ and /.
      let value = line.slice(eq + 1).trim();
      if (value.length > 1 && ((value[0] === '"' && value.endsWith('"')) || (value[0] === "'" && value.endsWith("'")))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch (e) {
    console.error('[env] could not read .env:', String((e && e.message) || e));
  }
}
