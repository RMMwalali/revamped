import { readFile } from 'node:fs/promises';
import { safeReplace, verifyFlight } from './flight.mjs';

const file = 'dist/insight/iventions-london-hub/index.html';
const html = await readFile(file, 'utf8');
const v0 = verifyFlight(html);
console.log('raw verify:', JSON.stringify(v0));

// 1) no-op stability
const noop = safeReplace(html, 'ZZZ-NEVER-PRESENT-123', 'QQQ');
console.log('noop byte-identical:', noop === html);

// 2) different-length URL swap inside the article payload
const out = safeReplace(html, 'https://iventions.com/contact?form=contact', '/contact?form=contact');
console.log('edited differs:', out !== html);
const v1 = verifyFlight(out);
console.log('edited verify:', JSON.stringify(v1));
console.log('new link present:', out.includes('/contact?form=contact\\"') || out.includes('/contact?form=contact\\"'.slice(0, 20)));
console.log('old link gone from pushes:', !out.split('self.__next_f.push(').slice(1).join(' ').includes('iventions.com/contact'));

// 3) menu swap still fine
const out2 = safeReplace(out, 'https://iventions.com/about/', '/about/');
console.log('menu swap verify:', JSON.stringify(verifyFlight(out2)));
process.exit(0);
