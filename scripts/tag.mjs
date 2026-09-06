// Bake stable data-sc-id attributes into dist HTML so admin overrides can
// target exact elements server-side. Deterministic: strip + retag = same ids.
// Usage: node scripts/tag.mjs
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('dist');
const TEXT_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'a', 'span', 'button', 'blockquote', 'figcaption', 'dt', 'dd', 'td', 'th', 'label']);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'insider' || e.name === 'vendor') continue;
      out.push(...await walk(full));
    } else if (e.name.endsWith('.html')) out.push(full);
  }
  return out;
}

// Split into protected blocks (comments/scripts/styles) vs taggable HTML.
function tokenize(html) {
  const re = /(<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>)/gi;
  const parts = [];
  let last = 0, m;
  while ((m = re.exec(html))) {
    if (m.index > last) parts.push({ t: 'html', s: html.slice(last, m.index) });
    parts.push({ t: 'raw', s: m[0] });
    last = m.index + m[0].length;
  }
  if (last < html.length) parts.push({ t: 'html', s: html.slice(last) });
  return parts;
}

function stripIds(s) {
  return s.replace(/\sdata-sc-id="[ti]-\d+"/g, '');
}

function hasTextContent(html, tagStart, tagEnd) {
  // crude: look ahead for first text char before next tag
  const next = html.indexOf('<', tagEnd);
  if (next < 0) return false;
  return /[^\s]/.test(html.slice(tagEnd, next));
}

let files = 0, tTot = 0, iTot = 0;
for (const f of await walk(OUT)) {
  let tCount = 0, iCount = 0; // per-file: ids are page-scoped (overrides keyed by page)
  let html = await readFile(f, 'utf8');
  const parts = tokenize(stripIds(html));
  const out = parts.map((p) => {
    if (p.t === 'raw') return p.s;
    return p.s.replace(/<(img|p|h1|h2|h3|h4|h5|h6|li|a|span|button|blockquote|figcaption|dt|dd|td|th|label)(\s[^<>]*?|\s*?)(\/?)>/gi,
      (m, tag, attrs, self, offset, whole) => {
        tag = tag.toLowerCase();
        if (tag === 'img') {
          if (!/\bsrc\s*=/.test(attrs)) return m;
          iCount++;
          return `<img data-sc-id="i-${iCount}"${attrs}${self}>`;
        }
        if (!TEXT_TAGS.has(tag)) return m;
        if (!hasTextContent(whole, offset, offset + m.length)) return m;
        tCount++;
        return `<${tag} data-sc-id="t-${tCount}"${attrs}${self}>`;
      });
  }).join('');
  await writeFile(f, out, 'utf8');
  files++;
  tTot += tCount;
  iTot += iCount;
}
console.log(`tagged ${files} files (t=${tTot} i=${iTot})`);
