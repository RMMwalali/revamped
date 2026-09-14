import fs from 'node:fs';
const slug = 'adidas-display-wall';
const html = fs.readFileSync(`dist/project/${slug}/index.html`, 'utf8');
const pushes = [...html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)];
for (let i = 0; i < pushes.length; i++) {
  let s;
  try { s = JSON.parse('"' + pushes[i][1] + '"'); } catch { continue; }
  // print pushes that look like content-bearing (project data or sections)
  const first = s.slice(0, 60).replace(/\n/g, '\\n');
  console.log(`--- push ${i} len=${s.length} | ${JSON.stringify(first)}`);
}
console.log('\n=== decode pushes 22..26 for adidas (content) ===');
for (const i of [22, 23, 24, 25, 26]) {
  let s;
  try { s = JSON.parse('"' + pushes[i][1] + '"'); } catch { console.log(`push ${i}: FINAL`); continue; }
  console.log(`\n===== push ${i} =====`);
  console.log(s);
}