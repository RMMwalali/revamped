import fs from 'node:fs';
import { execSync } from 'node:child_process';
const pris = execSync('git show HEAD:dist/projects/index.html', { maxBuffer: 1e9 }).toString('utf8');
const disk = fs.readFileSync('dist/projects/index.html', 'utf8');
function ids(html, src) {
  const idRe = /self\.__next_f\.push\(\[1,"?([0-9]+):/g;
  const out = [...html.matchAll(idRe)].map((m) => m[1]);
  console.log(src, 'push ids:', out.join(','));
  return out;
}
const a = ids(pris, 'PRISTINE');
const b = ids(disk, 'DISK   ');
console.log('missing in disk:', a.filter((x) => !b.includes(x)));
console.log('extra in disk:', b.filter((x) => !a.includes(x)));
console.log('first 11 of disk:', b.slice(0, 11).join(','));