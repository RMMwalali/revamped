// Migrate existing DBs to the structured mini-CMS:
// - cms_sections table for Insider dashboard sections
// - content_overrides.kind accepts 'media' (edit bar already sends it)
// - brand hero_video_src default (Cloudinary hero link)
import { pool } from './db.mjs';

await pool.query(`
CREATE TABLE IF NOT EXISTS cms_sections (
  section TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
)`);
await pool.query('ALTER TABLE content_overrides ADD COLUMN IF NOT EXISTS orig_html TEXT');
await pool.query('ALTER TABLE content_overrides ADD COLUMN IF NOT EXISTS idx INTEGER NOT NULL DEFAULT 0');
await pool.query("ALTER TABLE content_overrides ADD COLUMN IF NOT EXISTS tag TEXT NOT NULL DEFAULT ''");
// Widen the kind check (constraint name follows the PG default convention).
await pool.query('ALTER TABLE content_overrides DROP CONSTRAINT IF EXISTS content_overrides_kind_check');
await pool.query(
  "ALTER TABLE content_overrides ADD CONSTRAINT content_overrides_kind_check CHECK (kind IN ('text','image','media'))"
);
await pool.query(
  'INSERT INTO brand_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
  ['hero_video_src', 'https://res.cloudinary.com/dtnbwgpca/video/upload/v1789445868/skillcraft/Stillcraft_hero_video_zbgcov.mp4']
);
console.log('cms migration OK');
await pool.end();
