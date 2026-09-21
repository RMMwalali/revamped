import { readFile } from 'node:fs/promises';
import { debugRows } from './flight.mjs';
for (const f of ['dist/insights/index.html', 'dist/index.html']) {
  const h = await readFile(f, 'utf8');
  console.log('===', f);
  for (const r of debugRows(h)) {
    console.log('bytes?', r.bytes, 'span', r.payloadStart + '..' + r.payloadEnd, 'head:', JSON.stringify(r.head).slice(0, 110));
  }
}
process.exit(0);
