import { mkdir, writeFile, stat, cp } from 'node:fs/promises';
import path from 'node:path';
const ORIGIN = 'https://iventions.com';
const OUT = path.resolve('dist');
const CH = path.join(OUT, 'assets', 'root', '_next', 'static', 'chunks');

const FILES = [
  '/_next/static/chunks/511.0427b8b8b2e41225.js',
  '/_next/static/chunks/800.bc9cd0445000ec3e.js',
  '/_next/static/chunks/8949.f340737003c33b71.js',
  '/_next/static/chunks/app/(withQuoteContact)/projects/filter/page-428fb00496c76d23.js',
  '/_next/static/chunks/app/(withQuoteContact)/projects/page-29e9da989f32f710.js',
];
for (const src of FILES) {
  const local = path.join(OUT, 'assets', 'root', decodeURIComponent(src).replace(/^\//, ''));
  try { const st = await stat(local); if (st.size > 500) { console.log('exists', src); continue; } } catch {}
  await mkdir(path.dirname(local), { recursive: true });
  const res = await fetch(ORIGIN + src, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: ORIGIN + '/' } });
  if (!res.ok) { console.log(`  [${res.status}] ${src}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(local, buf);
  console.log(`  OK ${src} (${buf.length})`);
}

// Encoded-name twins: some static servers don't decode %5B/%5D before lookup,
// but our HTML references encoded chunk paths. Duplicate decoded dirs.
const twins = [
  ['app/(withQuoteContact)/insight/[slug]', 'app/(withQuoteContact)/insight/%5Bslug%5D'],
  ['app/(withQuoteContact)/projects/[category]', 'app/(withQuoteContact)/projects/%5Bcategory%5D'],
  ['app/(withoutQuoteContact)/project/[slug]', 'app/(withoutQuoteContact)/project/%5Bslug%5D'],
];
for (const [a, b] of twins) {
  await cp(path.join(CH, a), path.join(CH, b), { recursive: true }).catch((e) => console.log('twin skip', a, e.message));
  console.log('twinned', b);
}
console.log('DONE fetch-crawl');
