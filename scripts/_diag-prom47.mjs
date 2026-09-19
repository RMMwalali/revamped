import fs from 'fs';
const h = fs.readFileSync('dist/index.html', 'utf8');
// locate flight payload (raw esc markers '\\n')
const base = h.indexOf('self.__next_f.push([1,');
console.log('payload at', base);
const start = h.indexOf('\\n', base) + 2;
// print first ~4000 chars decoded
console.log(h.slice(start, start + 4000).replace(/\\n/g, '\n').replace(/\\"/g, '"'));
console.log('\n\n----- REFS to rows 3d-45 (raw) -----');
for (let i = 0x3a; i <= 0x48; i++) {
  const id = i.toString(16);
  let c = -1, n = 0; while ((c = h.indexOf('"$' + id + '"', c + 1)) >= 0) n++;
  if (n) console.log('$' + id, n);
}
// find references of form ",\\"$41\\"" etc via escaped representation
console.log('\\"$41\\" escaped:', (h.match(/\\"\$41\\"/g) || []).length);
console.log('\\"$40\\" escaped:', (h.match(/\\"\$40\\"/g) || []).length);