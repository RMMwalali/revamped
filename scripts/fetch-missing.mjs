// Download route chunks with parentheses/bracket segments that assets.mjs missed.
import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://iventions.com';
const OUT = path.resolve('dist');

const MISSING = [
  '/_next/static/chunks/app/(withQuoteContact)/%5Bslug%5D/page-2db73404b85d4915.js',
  '/_next/static/chunks/app/(withQuoteContact)/about/page-1086f123f968dd96.js',
  '/_next/static/chunks/app/(withQuoteContact)/insights/page-399375e1a3ac38be.js',
  '/_next/static/chunks/app/(withQuoteContact)/layout-41b6822294bd8aee.js',
  '/_next/static/chunks/app/(withQuoteContact)/page-2f419b88353d9d34.js',
  '/_next/static/chunks/app/(withoutQuoteContact)/contact/page-39444cf470c387d5.js',
  '/_next/static/chunks/app/(withoutQuoteContact)/service/%5Bslug%5D/page-66bb25de1cd89b22.js',
  '/_next/static/chunks/app/layout-f13770764cb0625c.js',
];

for (const src of MISSING) {
  const url = ORIGIN + src;
  // decode %5B/%5D for the local filename check only; keep URL as-is
  const local = path.join(OUT, 'assets', 'root', decodeURIComponent(src).replace(/^\//, ''));
  try {
    const st = await stat(local);
    if (st.size > 0) { console.log('exists', local); continue; }
  } catch {}
  await mkdir(path.dirname(local), { recursive: true });
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://iventions.com/',
    },
  });
  if (!res.ok) { console.log(`  [${res.status}] ${url}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(local, buf);
  console.log(`  OK ${path.relative(OUT, local)} (${buf.length})`);
}
console.log('DONE fetch-missing');
