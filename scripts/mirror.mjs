// Mirror cheap static assets to their ORIGINAL absolute locations so that
// runtime-generated URLs (webpack publicPath /_next/, /upload/, /icons/,
// /test-mask.svg, etc.) resolve identically to the live site.
// CMS images stay only under /assets/cms (served via the image shim + rewrites).
import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('dist');
const R = path.join(OUT, 'assets', 'root');

await cp(path.join(R, '_next'), path.join(OUT, '_next'), { recursive: true });
console.log('mirrored _next');
for (const d of ['upload', 'icons']) {
  try {
    await cp(path.join(R, d), path.join(OUT, d), { recursive: true });
    console.log('mirrored', d);
  } catch (e) { console.log('skip', d, e.message); }
}
// root-level loose files (svg badges, favicon, manifest, test-mask)
for (const e of await readdir(R, { withFileTypes: true })) {
  if (!e.isFile()) continue;
  if (/\.(svg|ico|json)$/i.test(e.name)) {
    await cp(path.join(R, e.name), path.join(OUT, e.name));
    console.log('mirrored', e.name);
  }
}
console.log('DONE mirror');
