import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
for (const ref of ['"$3d"','"$c"','"$e"','"$1"']) {
  const q = '\\' + ref.slice(0, 1) + ref.slice(1).replace(/\$/g, '\\$');
  let idx = -1; const hs = [];
  while ((idx = h.indexOf(ref, idx + 1)) >= 0) hs.push(idx);
  console.log(ref, hs);
  for (const x of hs.slice(0, 3)) console.log('   ctx', JSON.stringify(h.slice(x - 160, x + 120)));
}
console.log('--- root rows region (raw) ---');
console.log(JSON.stringify(h.slice(h.indexOf('\\n1:') - 60, h.indexOf('\\n4:') + 120)).slice(0, 2500));