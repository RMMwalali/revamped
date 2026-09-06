import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
const ORIGIN = 'https://iventions.com';
const OUT = path.resolve('dist');
const FILES = [
  '/_next/static/chunks/2823.a592201171040fec.js',
  '/_next/static/chunks/9078.c56cd46e8a5f8594.js',
  '/_next/static/chunks/6685.bfd06db752d1c7d6.js',
];
for (const src of FILES) {
  const local = path.join(OUT, 'assets', 'root', src.replace(/^\//, ''));
  try { const st = await stat(local); if (st.size > 500) { console.log('exists', src); continue; } } catch {}
  await mkdir(path.dirname(local), { recursive: true });
  const res = await fetch(ORIGIN + src, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: ORIGIN + '/' } });
  if (!res.ok) { console.log(`  [${res.status}] ${src}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(local, buf);
  console.log(`  OK ${src} (${buf.length})`);
}
console.log('DONE fetch-known');
