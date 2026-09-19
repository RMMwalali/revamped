import { pool } from './db.mjs';
(async () => {
  const [rows] = await pool.query('SELECT section_key, data FROM cms_sections WHERE section_key=$1', ['testimonials']);
  const items = JSON.parse(rows[0].data).items || [];
  for (const it of items) {
    console.log(JSON.stringify({
      name: it.name,
      role: it.role,
      org: it.organization && it.organization.name,
      quote: it.testimonial,
      industry: it.cindustry, location: it.location
    }));
  }
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });