// Shared Postgres pool. Only initialized when DATABASE_URL is set, so auth
// routes (which now use env-var credentials + signed tokens) work without
// a database. Content/CMS/leads modules also fall back to Blob storage
// when pool is null. Migration scripts (schema.mjs, seed-admin.mjs) still
// use this directly with a DATABASE_URL env var.
import pg from 'pg';

export const pool = process.env.DATABASE_URL
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      // Supabase requires SSL; local dev cluster has no certs.
      ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false },
      // Serverless functions share the pooler: keep per-instance connections tiny.
      max: Number(process.env.PGPOOL_MAX || 10),
    })
  : null;
