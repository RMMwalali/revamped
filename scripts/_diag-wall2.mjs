import { readFile, writeFile } from 'node:fs/promises';
import { applyLogosFix } from './transform.mjs';
import { verifyFlight } from './flight.mjs';

const raw = await readFile('dist/index.html', 'utf8');
const data = (await (await import('./db.mjs')).pool.query("SELECT data FROM cms_sections WHERE section = 'logos'")).rows[0].data ?? null;
const items = (data && data.items) || [];

console.log('items:', items.length);
const out = applyLogosFix(raw, items);
await writeFile('dist/_wallout.html', out);
console.log('raw  verifyFlight:', JSON.stringify(verifyFlight(raw)));
console.log('out  verifyFlight:', JSON.stringify(verifyFlight(out)));
console.log('changed:', raw.length !== out.length);
await (await import('./db.mjs')).pool.end();