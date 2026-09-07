// One-shot: swap distinctive legacy brand hexes inside built JS chunks (both
// dist copies). Only rare brand tokens are touched; common values left alone.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const MAP = [
  ['9c93e8', '1B2A4A'], ['8072ff', '1B2A4A'], ['bfb8ff', '1B2A4A'],
  ['e0ff98', 'C9A24B'], ['608ff3', 'C9A24B'], ['ddd9ff', 'C9A24B'], ['546162', '1B2A4A'],
  ['f3efeb', 'FFFFFF'], ['f3efe9', 'FFFFFF'],
  ['eae3dc', 'F5F1EC'], ['efebe8', 'F5F1EC'],
  ['d1f3f5', 'F5F1EC'], ['ffddc4', 'F5F1EC'], ['f7ffdc', 'F5F1EC'],
];
async function files(d, out = []) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) await files(f, out);
    else if (e.name.endsWith('.js')) out.push(f);
  }
  return out;
}
let changed = 0;
for (const f of await files('dist/assets/root/_next/static/chunks')) {
  let t = await readFile(f, 'utf8');
  const before = t;
  for (const [a, b] of MAP) t = t.replace(new RegExp('#' + a, 'gi'), '#' + b);
  if (t !== before) { await writeFile(f, t, 'utf8'); changed++; console.log('themed', f.split(/[/\\]/).pop()); }
}
console.log('done, changed=' + changed);
