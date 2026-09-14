import fs from 'node:fs';
import { execSync } from 'node:child_process';
const disk = fs.readFileSync('dist/projects/index.html', 'utf8');
const pris = execSync('git show HEAD:dist/projects/index.html', { maxBuffer: 1e9 }).toString('utf8');
function scripts(html, tag) {
  const out = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m, i) => ({ src: '#' + i, code: m[1] }));
  return out.filter((s) => s.code.includes(tag));
}
const D = scripts(disk, 'get you accurate');
const P = scripts(pris, 'get you accurate');
console.log('disk matches', D.length, 'pristine matches', P.length);
if (D.length && P.length) {
  const d = D[0].code, p = P[0].code;
  console.log('disk script#', D[0].src, 'len', d.length, 'pristine script#', P[0].src, 'len', p.length);
  console.log('D head:', JSON.stringify(d.slice(0, 160)));
  console.log('P head:', JSON.stringify(p.slice(0, 160)));
  console.log('D tail:', JSON.stringify(d.slice(-80)));
  console.log('P tail:', JSON.stringify(p.slice(-80)));
  const d2 = D[1] ? D[1].code : '(none)', p2 = P[1] ? P[1].code : '(none)';
  console.log('D[1] len', d2.length, 'P[1] len', p2.length, 'D[1].starts', JSON.stringify(d2.slice(0, 60)));
  console.log('P[1].starts', JSON.stringify(p2.slice(0, 60)));
}