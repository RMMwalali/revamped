import fs from 'node:fs';
const html = fs.readFileSync('dist/project/adidas-display-wall/index.html', 'utf8');
const pushes = [...html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)];
for (const i of [9, 18, 21, 25, 29, 30]) {
  let s;
  try { s = JSON.parse('"' + pushes[i][1] + '"'); } catch { console.log(`push ${i}: PARSE FAIL`); continue; }
  console.log(`\n===== push ${i} =====`);
  console.log(s);
}