// Shared Postgres pool. Reads DATABASE_URL from .env (never log it).
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

function loadEnv() {
  const f = path.resolve('.env');
  if (!existsSync(f)) return;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL missing. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase requires SSL; local dev cluster has no certs.
  ssl: isLocal ? false : { rejectUnauthorized: false },
  // Serverless functions share the pooler: keep per-instance connections tiny.
  max: Number(process.env.PGPOOL_MAX || 10),
});
