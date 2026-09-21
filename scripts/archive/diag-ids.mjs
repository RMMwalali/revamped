import fs from 'node:fs';
for (const slug of ['adidas-display-wall', 'uefa-champions-league-final-2026', 'ypo-global-event']) {
  const html = fs.readFileSync(`dist/project/${slug}/index.html`, 'utf8');
  const staticHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const out = [];
  const re = /<([a-z0-9]+)[^>]*data-sc-id="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(staticHtml))) {
    const txt = m[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').replace(/&amp;/g, '&').trim();
    if (txt) out.push(`${m[2]}  [${m[1]}] ${txt.slice(0, 90)}`);
  }
  console.log(`\n=== ${slug} static sc nodes (${out.length}):\n` + out.join('\n'));
}