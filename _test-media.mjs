const BASE = 'http://localhost:3010';
const cookieJar = {};

async function req(path, opts = {}, cookies = {}) {
  const headers = { ...(opts.headers || {}) };
  if (Object.keys(cookies).length) headers.Cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  const res = await fetch(BASE + path, { ...opts, headers, redirect: 'manual' });
  const setc = res.headers.get('set-cookie') || '';
  const m = /sc_admin=([^;]+)/.exec(setc);
  if (m) cookieJar.sc_admin = m[1];
  return { status: res.status, body: await res.text().catch(() => ''), setc };
}

const r1 = await req('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'super@stillcraftevents.co.ke', password: 'test1234' }) });
console.log('login', r1.status, r1.body.slice(0, 80));

const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(100, 0)], 128);
const fd = new FormData();
fd.append('image', new Blob([mp4], { type: 'video/mp4' }), 'clip.mp4');
const r2 = await req('/api/upload', { method: 'POST', body: fd }, cookieJar);
console.log('upload', r2.status, r2.body.slice(0, 120));

const src = JSON.parse(r2.body).src;
const save = await req('/api/content', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ page: '/about', items: [{ el_id: 'amed001', kind: 'media', value: src, orig: 'https://player.vimeo.com/progressive_redirect/playback/1099706996/rendition/1080p/file.mp4%20%281080p%29.mp4?loc=external&amp;oauth2_token_id=1795368298&amp;signature=d7b5c545266281f4086bf0338d3fa6032ac3c58bb71d0a005ebf5459f3906ff7', orig_html: 'https://player.vimeo.com/progressive_redirect/playback/1099706996/rendition/1080p/file.mp4%20%281080p%29.mp4?loc=external&amp;oauth2_token_id=1795368298&amp;signature=d7b5c545266281f4086bf0338d3fa6032ac3c58bb71d0a005ebf5459f3906ff7', idx: 0, tag: 'VIDEO' }] })
}, cookieJar);
console.log('save', save.status, save.body.slice(0, 80));

const page = await req('/about');
console.log('about has new src?', page.status, page.body.includes(src));
console.log('about still has old?', page.body.includes('player.vimeo.com/progressive_redirect/playback/1099706996') ? 'YES(needs-flight-or-static-check)' : 'no');

const content = await req('/api/content?page=/about');
console.log('content api', content.status, content.body.slice(0, 120));

const { pool } = await import('./scripts/db.mjs');
const q = await pool.query("select page,el_id,kind,value from content_overrides where page='/about'");
console.log('direct db rows:', JSON.stringify(q.rows));
await pool.end();

await req('/api/logout', { method: 'POST' }, cookieJar);