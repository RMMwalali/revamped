import fs from 'node:fs';
const html = fs.readFileSync('dist/project/adidas-display-wall/index.html', 'utf8');
const staticHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
for (const k of ['<h1', 't-21', 't-22', 't-23', 't-24', 't-25', 't-26', 'i-4', 'project-detai-content', 'styles_heading', 'Participant', 'participants']) {
  let i = staticHtml.indexOf(k);
  if (i < 0) { console.log(`--- "${k}" NOT FOUND in static`); continue; }
  console.log(`--- "${k}" @${i} ---`);
  console.log(staticHtml.slice(Math.max(0, i - 200), i + 500).replace(/\s+/g, ' '));
}