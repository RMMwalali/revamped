import { execSync } from 'node:child_process';
import fs from 'node:fs';
const pris = execSync('git show HEAD:dist/projects/index.html', { maxBuffer: 1e9 }).toString('utf8');
const all = [...pris.matchAll(/>71<\/div>/g)];
console.log('pristine FULL >71</div>:', all.length, all.map((m) => m.index));
// the footer "3:" push head marker
console.log('footer 3: marker count:', (pris.match(/"3:\[\[\\"\$\\",\\"\$L4/g) || []).length);
// find the exact fragment start that remains in disk: 't\\":\\"Let's' as raw
const frag = 't\\":\\"Let';
console.log('frag count in pristine:', (pris.match(/t\\":\\"Let/g) || []).length);
const fi = pris.indexOf(frag);
console.log('frag @', fi, JSON.stringify(pris.slice(fi - 80, fi + 40)));
// how many pushes' concatenated arg combined: count resourceLinks/navCtas lead-in
const m3 = pris.indexOf('"3:');
console.log('"3:" @', m3, JSON.stringify(pris.slice(m3, m3 + 60)));