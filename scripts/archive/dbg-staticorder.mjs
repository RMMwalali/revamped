import { readFile } from 'node:fs/promises';
import('./cms.mjs').then(async () => {});
const { default: x } = await import('node:util').catch(() => ({}));
void x;
// inline: reuse parseInsightCards via dynamic import of cms (not exported) -> reimplement quickly
const h = await readFile('dist/_bisect-ins-home.html', 'utf8');
const stat = h.split(/(<script[\s\S]*?<\/script>)/gi).filter((_, i) => i % 2 === 0).join('');
const re = /href="\/insight\/([a-z0-9-]+)"/g;
let m;
const slugs = [];
while ((m = re.exec(stat))) slugs.push(m[1]);
console.log('static insight hrefs in order:', slugs.join(','));
process.exit(0);
