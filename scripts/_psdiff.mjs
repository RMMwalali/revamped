import fs from 'node:fs';
import { execSync } from 'node:child_process';
const res = await fetch('http://127.0.0.1:3000/projects', { headers: { 'user-agent': 'test' } });
const served = await res.text();
const pris = execSync('git show HEAD:dist/projects/index.html', { maxBuffer: 1e9 }).toString('utf8');

function scripts(html) {
  return [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}
const sS = scripts(served);
const sP = scripts(pris);
const S = sS.find((c) => c.includes('Let’s get you accurate numbers'));
const P = sP.find((c) => c.includes('Let’s get you accurate numbers'));
console.log('served script len', S.length, 'pristine len', P.length);
if (!S) { console.log('S absent'); process.exit(0); }
if (!P) { console.log('P absent'); process.exit(0); }
// find first differing byte
let diff = -1;
for (let i = 0; i < Math.min(S.length, P.length); i++) if (S[i] !== P[i]) { diff = i; break; }
console.log('first diff at', diff);
if (diff >= 0) {
  console.log('S:', JSON.stringify(S.slice(diff - 120, diff + 120)));
  console.log('P:', JSON.stringify(P.slice(diff - 120, diff + 120)));
}
console.log('S tail:', JSON.stringify(S.slice(-160)));