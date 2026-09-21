import {readFile} from 'node:fs/promises';
import {getCMS, applyStructuredCMS} from './cms.mjs';
const raw = await readFile('dist/index.html', 'utf8');
const h4 = (h) => [...h.matchAll(/<h4[^>]*class="css-hj2ayb"[^>]*>([^<]{0,40})/g)].map(x => x[1]).join(' | ');
const cms = await getCMS();
for (const sec of ['hero', 'highlights', 'logos', 'stats', 'testimonials', 'cities', 'articles', 'insights', 'team', 'projects']) {
  const solo = {[sec]: cms[sec]};
  const out = await applyStructuredCMS(raw, solo, '/');
  const changed = h4(out) !== h4(raw) ? '  <-- CHANGED' : '';
  console.log(sec, '=>', h4(out), changed);
}
await (await import('./db.mjs')).pool.end();
