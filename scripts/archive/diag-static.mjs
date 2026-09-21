import fs from 'node:fs';
const html = fs.readFileSync('dist/project/adidas-display-wall/index.html', 'utf8');
// static plane (no scripts)
const staticHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const keys = [
  '<title>', '<meta name="description"', '<meta name="application-name"',
  'participants', 'industry', 'event type', 'location',
  'Adidas', 'adidas', 'Budapest', 'Sportswear', 'one five-metre', 'One five-metre'
];
for (const k of keys) {
  let i = staticHtml.indexOf(k);
  console.log(`\n--- "${k}" @${i} ---`);
  if (i >= 0) console.log(staticHtml.slice(Math.max(0, i - 120), i + 260).replace(/\s+/g, ' '));
}
// full metadata push 15 decoded
const p = [...html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)];
for (const i of [15, 16]) {
  let s;
  try { s = JSON.parse('"' + p[i][1] + '"'); } catch { console.log(`push ${i}: fail`); continue; }
  console.log(`\n===== push ${i} decoded =====\n${s}`);
}