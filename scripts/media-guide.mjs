// Scan dist HTML and emit MEDIA-GUIDE.md: every image grouped by page + section.
// Section = nearest preceding heading (h1-h3) in document order.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('dist');

async function walk(dir, base = '') {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) {
      if (['vendor', 'insider'].includes(e.name)) continue;
      out.push(...await walk(full, rel));
    } else if (e.name === 'index.html') {
      const r = '/' + rel.replace(/\/index\.html$/, '');
      out.push(r === '/' ? '/' : r.replace(/\/$/, ''));
    }
  }
  return out;
}

function cleanText(s) {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

const routes = (await walk(OUT)).sort();
let md = `# StillCraft Events — Media Replacement Guide\n\n`;
md += `Every photo/logo/media slot on the site, grouped by page and section. `;
md += `Replace any of them without touching code: log in at \`/insider\`, open the page, click the image, upload the new file.\n\n`;
md += `Brand files (logo, favicon) are managed in the edit bar under **Brand**.\n\n`;

for (const route of routes) {
  const file = path.join(OUT, route === '/' ? 'index.html' : route.slice(1) + '/index.html');
  let html;
  try { html = await readFile(file, 'utf8'); } catch { continue; }
  // token walk: headings + imgs in document order (skip head/scripts/styles)
  const body = (html.split(/<body[^>]*>/i)[1] || html).split(/<\/body>/i)[0];
  const re = /<(h[1-3])\b[^>]*>([\s\S]*?)<\/\1>|<img\b[^<>]*>/gi;
  let section = '(top of page)';
  const rows = [];
  let m;
  while ((m = re.exec(body))) {
    if (/^h[1-3]/i.test(m[0].slice(1, 3))) {
      const t = cleanText(m[2]).slice(0, 80);
      if (t) section = t;
    } else {
      const tag = m[0];
      const src = (/src="([^"]+)"/.exec(tag) || [])[1] || '(no src)';
      const alt = (/alt="([^"]*)"/.exec(tag) || [])[1] || '';
      const id = (/data-sc-id="([^"]+)"/.exec(tag) || [])[1] || '';
      rows.push({ section, src, alt, id });
    }
  }
  if (!rows.length) continue;
  md += `## Page \`${route}\`\n\n`;
  md += `| Section | Current file | Alt text | Edit ID |\n|---|---|---|---|\n`;
  // de-dupe identical srcs shown twice (responsive pairs) but keep section note
  const seen = new Set();
  for (const r of rows) {
    const key = r.src;
    const dup = seen.has(key) ? ' (repeat)' : '';
    seen.add(key);
    md += `| ${r.section} | \`${r.src}\`${dup} | ${r.alt.slice(0, 60)} | ${r.id} |\n`;
  }
  md += `\n`;
}

await writeFile(path.resolve('MEDIA-GUIDE.md'), md, 'utf8');
console.log('wrote MEDIA-GUIDE.md');
