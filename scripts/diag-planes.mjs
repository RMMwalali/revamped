import fs from 'node:fs';
const html = fs.readFileSync('dist/project/adidas-display-wall/index.html', 'utf8');
const raw = html.match(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"/g) || [];
const pushes = raw.map((s) => {
  const inner = s.match(/^self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)$/)[1];
  return JSON.parse('"' + inner + '"');
});
const want = new Set(['0','15','16','18','21','22','23','24','25','26','29','30']);
pushes.forEach((p, i) => {
  if (!want.has(String(i))) return;
  const origin = p.split('\n').find((r) => !r.startsWith('0:{"$'));
  const seg = p.length > 2600 ? p.slice(0, 2600) + '  ...[TRUNC]' : p;
  console.log(`\n===== push ${i} (${p.length} chars) =====\n${seg}`);
});