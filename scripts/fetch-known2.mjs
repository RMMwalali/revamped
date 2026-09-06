import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
const ORIGIN = 'https://iventions.com';
const CMS = 'https://cms.iventions.com';
const OUT = path.resolve('dist');
const FILES = [
  [ORIGIN, '/_next/static/chunks/320.127f79f47e8ad8bc.js', 'assets/root'],
  [ORIGIN, '/_next/static/chunks/3099.2d7c7c923e846179.js', 'assets/root'],
  [ORIGIN, '/_next/static/chunks/6715.75c25869ba0ad0e7.js', 'assets/root'],
  [ORIGIN, '/upload/earthspec_new.jpg', 'assets/root'],
];
for (const [origin, src, prefix] of FILES) {
  const local = path.join(OUT, prefix, src.replace(/^\//, ''));
  try { const st = await stat(local); if (st.size > 500) { console.log('exists', src); continue; } } catch {}
  await mkdir(path.dirname(local), { recursive: true });
  const res = await fetch(origin + src, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: ORIGIN + '/' } });
  if (!res.ok) { console.log(`  [${res.status}] ${src}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(local, buf);
  console.log(`  OK ${src} (${buf.length})`);
}
console.log('DONE fetch-known2');
