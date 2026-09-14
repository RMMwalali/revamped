import fs from 'node:fs';
for (const slug of ['adidas-display-wall', 'uefa-champions-league-final-2026', 'ypo-global-event']) {
  const html = fs.readFileSync(`dist/project/${slug}/index.html`, 'utf8');
  const staticHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  console.log(`\n=== ${slug} ===`);
  // Grep for the visible static prose: meta title, description, hero headline
  const m = /<title>([^<]*)<\/title>/.exec(html);
  const d = /<meta name="description" content="([^"]*)"/.exec(html);
  console.log('TITLE  :', m && m[1]);
  console.log('DESC   :', d && d[1]);
  // find case-study-specific text nodes in static html (t- ids beyond header/footer)
  const sp = staticHtml.replace(/\s+/g, ' ');
  // show sections by class names chosen earlier
  const sections = [...sp.matchAll(/data-sc-id="(t-\d+)">([^<]{0,120})</g)];
  console.log('text nodes:', sections.length);
  for (const [, id, txt] of sections) {
    if (/^(About|Home|Events|Exhibits|Congresses|Sports|Work|Insights|Contact|menu|CLOSE|LinkedIn|Instagram|got a project)/i.test(txt.trim())) continue;
    console.log(`  ${id}`.padEnd(12), txt.trim());
  }
}