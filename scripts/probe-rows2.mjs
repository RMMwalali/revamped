import { readFile } from 'node:fs/promises';
import { verifyFlight } from './flight.mjs';
for (const f of ['dist/insights/index.html', 'dist/index.html', 'dist/insight/cphi-trade-show/index.html']) {
  const h = await readFile(f, 'utf8');
  console.log(f, JSON.stringify(verifyFlight(h)));
}
process.exit(0);
