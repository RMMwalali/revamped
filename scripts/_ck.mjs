import fs from 'node:fs';
for (const f of ['dist/projects/index.html', 'dist/_afterflight.html']) {
  const b = fs.readFileSync(f, 'utf8');
  const scripts = [...b.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const foot = scripts.find((c) => c.includes('get you accurate numbers'));
  console.log(f, 'len', b.length, 'scripts', scripts.length, 'footer', foot ? foot.length : 'MISS', 'marker3', (b.match(/"3:\[\[/g) || []).length);
}