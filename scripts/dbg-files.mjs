import { readFile } from 'node:fs/promises';
for (const f of ['dist/_bisect-v3-hide.html', 'dist/index.html', 'dist/_bisect-v1-reorder.html', 'dist/_bisect-v2-title.html']) {
  const h = await readFile(f, 'utf8');
  const stat = h.split(/(<script[\s\S]*?<\/script>)/gi).filter((_, i) => i % 2 === 0).join('');
  const links = stat.match(/href="\/insight\//g) || [];
  const slugs = stat.match(/iventions-london-hub/g) || [];
  console.log(f, 'static-links:', links.length, 'hub-hits:', slugs.length, 'bytes:', h.length);
}
process.exit(0);
