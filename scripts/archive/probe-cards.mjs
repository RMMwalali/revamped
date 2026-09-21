import { readFile } from 'node:fs/promises';
for (const f of ['dist/insights/index.html', 'dist/index.html']) {
  const h = await readFile(f, 'utf8');
  console.log('=====', f);
  // static (non-script) part only
  const stat = h.split(/(<script[\s\S]*?<\/script>)/gi).filter((_, i) => i % 2 === 0).join('');
  const re = /<a[^>]*href="\/insight\/([a-z0-9-]+)"[^>]*>/g;
  let m, n = 0;
  const slugs = [];
  while ((m = re.exec(stat))) { slugs.push(m[1]); n++; }
  console.log('static insight links:', n, slugs.slice(0, 8).join(','));
  const i = stat.indexOf('/insight/');
  console.log(JSON.stringify(stat.slice(Math.max(0, i - 700), i + 300)).slice(0, 1100));
}
process.exit(0);
