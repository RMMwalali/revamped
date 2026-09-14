import fs from 'node:fs';
import { execSync } from 'node:child_process';
const pris = execSync('git show HEAD:dist/projects/index.html', { maxBuffer: 1e9 }).toString('utf8');
const occ = [...pris.matchAll(/>71<\/div>/g)];
console.log('>71</div> in FULL pristine:', occ.length, occ.map((m) => m.index));
// Show context of each
for (const m of occ) {
  console.log('@', m.index, JSON.stringify(pris.slice(m.index - 160, m.index + 30)));
}
// count <script> occurrences total in pristine (incl attrs)
console.log('script-open tags:', [...pris.matchAll(/<script[^>]*>/g)].length);
console.log('flight chunk markers "3:[[":', (pris.match(/"3:\[\[/g) || []).length);
console.log('footer3 script:', (pris.match(/self\.__next_f\.push\(\[1,"3:\[\[/g) || []).length);