import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const SRC = path.resolve('scraped');
const OUT = path.resolve('dist');

function stripScripts(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
             .replace(/<script\b[^>]*\/>/gi, '');
}

function rewriteAssets(html) {
  const cwd = path.join('assets', 'root');
  html = html.replace(/(src|srcset|href|content)="\/_next\/image\?url=([^"&]+)[^"]*"/g, (whole, attr, enc) => {
    let u;
    try { u = decodeURIComponent(enc); } catch { return whole; }
    let mapped;
    if (/^https:\/\/cms\.iventions\.com\//.test(u)) {
      mapped = 'assets/cms/' + u.replace(/^https:\/\/cms\.iventions\.com\//, '');
    } else if (/^\//.test(u)) {
      mapped = cwd + '/' + u.slice(1);
    } else {
      return whole;
    }
    return `${attr}="${mapped}"`;
  });
  html = html
    .replace(/(["'=])\/(_next\/static\/[^"')\s]+)/g, `$1${cwd}/$2`)
    .replace(/(\(url\()\/(_next\/static\/[^)]+)\)/g, `$1${cwd}/$2)`)
    .replace(/(["'=])\/(upload\/[^"')\s]+)/g, `$1${cwd}/$2`)
    .replace(/(["'=])\/(icons\/[^"')\s]+)/g, `$1${cwd}/$2`)
    .replace(/(["'=])\/(cssda-[^"')\s]+)/g, `$1${cwd}/$2`)
    .replace(/(["'=])\/(test-mask\.svg)/g, `$1${cwd}/$2`)
    .replace(/(["'=])\/(favicon\.ico)/g, `$1${cwd}/$2`)
    .replace(/(["'=])\/(manifest\.json)/g, `$1${cwd}/$2`)
    .replace(/(["'=])\/([a-zA-Z0-9_-]+\.svg)/g, `$1${cwd}/$2`)
    .replace(/(["'=])(https:\/\/cms\.iventions\.com)(\/[^"'\s)]+)/g, `$1assets/cms$3`)
    .replace(/(\(url\()https:\/\/cms\.iventions\.com(\/[^)]+)\)/g, `$1assets/cms$2)`)
    .replace(/(href=")https:\/\/iventions\.com(\/[^"]*)"/g, '$1$2"');
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
  let html = await readFile(f, 'utf8');
  try {
    html = stripScripts(html);
    html = rewriteAssets(html);
  } catch (e) {
    console.log('FAILED', f, e.message);
    continue;
  }
  if (typeof html !== 'string') {
    console.log('NOT STRING after process:', f, typeof html);
    continue;
  }
  const rel = path.relative(SRC, f);
  const dest = path.join(OUT, rel);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, html, 'utf8');
}
console.log('DONE');
