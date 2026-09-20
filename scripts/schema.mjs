// Create tables for auth, content overrides, brand settings. Idempotent.
import { pool } from './db.mjs';

await pool.query(`
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS content_overrides (
  id SERIAL PRIMARY KEY,
  page TEXT NOT NULL,
  el_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('text','image','media')),
  value TEXT NOT NULL,
  orig_html TEXT,
  idx INTEGER NOT NULL DEFAULT 0,
  tag TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (page, el_id)
);
CREATE TABLE IF NOT EXISTS cms_sections (
  section TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS brand_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT PRIMARY KEY,
  fails INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);
`);
console.log('schema OK');

// Seed default brand (StillCraft Events client theme). Only fills keys that are absent.
const defaults = {
  site_name: 'StillCraft Events',
  tagline: 'Step into the Spotlight',
  logo_src: '',
  primary_color: '#1B2A4A',
  accent_color: '#C9A24B',
  hero_video_src: 'https://res.cloudinary.com/dtnbwgpca/video/upload/v1789445868/skillcraft/Stillcraft_hero_video_zbgcov.mp4',
};
for (const [k, v] of Object.entries(defaults)) {
  await pool.query(
    'INSERT INTO brand_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
    [k, v]
  );
}
console.log('brand defaults seeded');
await pool.end();
