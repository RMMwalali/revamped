// Find every chunk filename referenced from HTML or JS, download any missing.
import { readdir, readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://iventions.com';
const OUT = path.resolve('dist');
const CHUNK_DIR = path.join(OUT, 'assets', 'root', '_next', 'static', 'chunks');

const refs = new Set();
async function scan(p) {
  const t = await readFile(p, 'utf8').catch(() => null);
  if (!t) return;
  for (const m of t.matchAll(/_next\/static\/chunks\/([A-Za-z0-9_\-[\].()%]+?\.js)/g)) refs.add(m[1]);
}
async function walk(dir, ext) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) await walk(f, ext);
    else if (e.name.endsWith(ext)) await scan(f);
  }
}
await walk(OUT, '.html');
await walk(CHUNK_DIR, '.js');
console.log('referenced chunks:', refs.size);

let missing = 0;
for (const name of [...refs].sort()) {
  const local = path.join(CHUNK_DIR, decodeURIComponent(name));
  try {
    const st = await stat(local);
    if (st.size > 500) continue;
  } catch {}
  missing++;
  const url = ORIGIN + '/_next/static/chunks/' + name;
  await mkdir(path.dirname(local), { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: ORIGIN + '/' } });
  if (!res.ok) { console.log(`  [${res.status}] ${name}`); continue; }
  await writeFile(local, Buffer.from(await res.arrayBuffer()));
  console.log(`  OK ${name}`);
}
console.log(`DONE fetch-chunks (missing was ${missing})`);
