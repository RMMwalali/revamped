// Download runtime-only assets (dynamically imported chunks + chunk-referenced
// media) that the HTML scrape could not discover.
import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://iventions.com';
const OUT = path.resolve('dist');

const FILES = [
  '/_next/static/chunks/three-418814eb.ba175ba5c8aadcb2.js',
  '/_next/static/chunks/three-b8583326.afb2dc117757b21f.js',
  '/_next/static/chunks/three-400ff16e.b442f34dbc3a23f8.js',
  '/_next/static/chunks/three-eb43e2b9.eb2e98b702d9e568.js',
  '/_next/static/chunks/7189.5fe694126f9bda97.js',
  '/upload/earth-2.png',
  '/upload/404-image.png',
  '/icons/ic_bin.svg',
  '/icons/ic_check.svg',
];

for (const src of FILES) {
  const url = ORIGIN + src;
  const local = path.join(OUT, 'assets', 'root', src.replace(/^\//, ''));
  try {
    const st = await stat(local);
    if (st.size > 500) { console.log('exists', src); continue; }
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
  console.log(`  OK ${src} (${buf.length})`);
}
console.log('DONE fetch-runtime');
