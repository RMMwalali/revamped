import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
// The flight payload rows are embedded escaped. Check the src index.html too which may be less escaped.
const src = fs.readFileSync('dist/index.html', 'utf8');
for (const [name, f] of [['served', h], ['src', src]]) {
  let i = -1;
  const hits = [];
  while ((i = f.indexOf('33:[' + '"]', i + 1)) >= 0) hits.push(i);
  // find row 32-45 defs
}
// In served, print raw char range around 296039 (row 41) with newlines unescaped for readability
const raw = h.slice(295900, 297800);
console.log(raw.replace(/\\\\/g, '\\').replace(/\\"/g, '"').replace(/\\n/g, '\n'));