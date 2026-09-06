// Rebuild dist/ from scraped/ WITHOUT stripping scripts.
// Keeps the identical stack: Next.js App Router + Emotion + Motion + Lenis.
// Only rewrites asset URLs to local absolute paths (forward slashes).
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const SRC = path.resolve('scraped');
const OUT = path.resolve('dist');
const AR = '/assets/root'; // absolute, works from any page depth

function mapImageOptimizer(url) {
  // url looks like: /_next/image?url=%2Fupload%2F...&w=1920&q=70
  // or url=https%3A%2F%2Fcms.iventions.com%2Fwp-content%2F...&w=...
  const m = /\/_next\/image\?url=([^&\s"'<>]+)/.exec(url);
  if (!m) return null;
  let dec;
  try { dec = decodeURIComponent(m[1]); } catch { return null; }
  if (dec.startsWith('https://cms.iventions.com/')) {
    return '/assets/cms/' + dec.replace('https://cms.iventions.com/', '');
  }
  if (dec.startsWith('/')) {
    return AR + dec;
  }
  return null;
}

function rewriteAssets(html) {
  // 1) Next.js image optimizer URLs -> direct local files (keep srcset descriptors intact)
  html = html.replace(/\/_next\/image\?url=([^&\s"'<>]+)(?:&[^"'<>\s]*)?/g, (whole, enc) => {
    const mapped = mapImageOptimizer('/_next/image?url=' + enc);
    return mapped || whole;
  });

  // 2) Absolute site-root asset paths -> local absolute paths
  html = html
    .replace(/(["'\(=])\/(_next\/static\/[^"'\)\s<>]+)/g, `$1${AR}/$2`)
    .replace(/(["'\(=])\/(upload\/[^"'\)\s<>]+)/g, `$1${AR}/$2`)
    .replace(/(["'\(=])\/(icons\/[^"'\)\s<>]+)/g, `$1${AR}/$2`)
    .replace(/(["'\(=])\/(cssda-[^"'\)\s<>]+)/g, `$1${AR}/$2`)
    .replace(/(["'\(=])\/(test-mask\.svg[^"'\)\s<>]*)/g, `$1${AR}/$2`)
    .replace(/(["'\(=])\/(favicon\.ico)/g, `$1${AR}/$2`)
    .replace(/(["'\(=])\/(manifest\.json)/g, `$1${AR}/$2`)
    .replace(/(["'\(=])\/([a-zA-Z0-9_-]+\.svg)/g, `$1${AR}/$2`);

  // 3) CMS absolute URLs -> local
  html = html
    .replace(/(["'\(=])https:\/\/cms\.iventions\.com(\/[^"'\)\s<>]+)/g, '$1/assets/cms$2');

  // 4) Canonical site links -> local routes (keep navigation working statically)
  html = html.replace(/(href=")https:\/\/iventions\.com(\/[^"]*)"/g, '$1$2"');

  // 5) Remove any previous custom injection (GSAP override conflicts with original stack)
  html = html.replace(/<!-- IVENTIONS:START -->[\s\S]*?<!-- IVENTIONS:END -->/g, '');

  // 6) CLONE-COMPAT: register sw.js so /_next/image URLs work on plain static
  // hosts. One tiny script, clearly marked; zero impact on look/animations.
  html = html.replace(/<!-- CLONE-COMPAT -->[\s\S]*?<!-- \/CLONE-COMPAT -->/g, '');
  html = html.replace(/(<\/body>)/i,
    '<!-- CLONE-COMPAT --><script src="/compat.js" defer></script><!-- /CLONE-COMPAT -->\n$1');

  return html;
}

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(full));
    else if (e.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const htmlFiles = await walk(SRC);
console.log('found', htmlFiles.length, 'files');
for (const f of htmlFiles) {
  const html = await readFile(f, 'utf8');
  const out = rewriteAssets(html);
  const rel = path.relative(SRC, f);
  const dest = path.join(OUT, rel);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, out, 'utf8');
  const scripts = (out.match(/<script[^>]*src="/g) || []).length;
  console.log('rebuilt', rel, `(${(out.length / 1024).toFixed(0)}kb, ${scripts} scripts, next_f=${out.includes('self.__next_f')})`);
}
console.log('DONE rebuild');
