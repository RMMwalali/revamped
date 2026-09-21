import {readFile} from 'node:fs/promises';
import {getCMS, applyStructuredCMS} from './cms.mjs';
let html = await readFile('dist/index.html', 'utf8');
const h4ctx = (h, tag) => {
  const ms = [...h.matchAll(/<h4[^>]*class="css-hj2ayb"[^>]*>([^<]{0,60})/g)];
  console.log(tag, 'count=', ms.length);
  for (const m of ms) {
    const a = h.lastIndexOf('<a ', m.index);
    console.log('   h4=', JSON.stringify(m[1]), 'prev-anchor-href=', JSON.stringify((h.slice(a, a + 120).match(/href="([^"]+)"/) || [])[1]));
  }
};
h4ctx(html, 'raw');
const cms = await getCMS().catch(() => null);
console.log('cms?', !!cms);
html = await applyStructuredCMS(html, cms, '/');
h4ctx(html, 'after-cms');
await (await import('./db.mjs')).pool.end();
