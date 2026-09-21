import { readFile } from 'node:fs/promises';
const h = await readFile('dist/index.html', 'utf8');
const stat = h.split(/(<script[\s\S]*?<\/script>)/gi).filter((_, i) => i % 2 === 0).join('');
// grid container styles_bottom__ivX84: list its direct children tags/classes
const gi = stat.indexOf('styles_bottom__ivX84');
const gstart = stat.lastIndexOf('<div', gi);
// crude: show sequence of top-level markers in following 12k chars
const seg = stat.slice(gstart, gstart + 12000);
const re = /<(div|a|section|p|h2|h3|button)\s[^>]{0,120}/g;
let m;
while ((m = re.exec(seg))) {
  const cls = (/class="([^"]{0,80})"/.exec(m[0]) || [])[1] || '';
  const href = (/href="([^"]{0,60})"/.exec(m[0]) || [])[1] || '';
  console.log(m[1], '|', cls.slice(0, 60), href ? ('-> ' + href) : '');
}
process.exit(0);
