import fs from 'node:fs';
for (const slug of ['adidas-display-wall', 'uefa-champions-league-final-2026', 'ypo-global-event']) {
  const html = fs.readFileSync(`dist/project/${slug}/index.html`, 'utf8');
  const pushes = [...html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)];
  console.log(`\n=== ${slug} === pushes: ${pushes.length}`);
  for (let i = 0; i < pushes.length; i++) {
    let s;
    try { s = JSON.parse('"' + pushes[i][1] + '"'); }
    catch { console.log(`  push ${i}: (outer parse fail)`); continue; }
    // only show pushes with the word "The challenge" or project layout markers
    if (/challenge|result|outcome|industry|location|participants|projectGallery|"slug"/.test(s.slice(0, 6000))) {
      console.log(`  push ${i} len=${s.length} head=${JSON.stringify(s.slice(0, 300))}`);
    }
  }
}
console.log('\n--- raw key markers in uefa push0 ---');
const html = fs.readFileSync('dist/project/uefa-champions-league-final-2026/index.html', 'utf8');
for (const marker of ['slug', 'title', 'industry', 'location', 'participants', 'challenge', 'result', 'description']) {
  const i = html.indexOf(`"${marker}"`);
  console.log(marker, i >= 0 ? `@${i}: ${JSON.stringify(html.slice(i, i + 140))}` : 'NOT FOUND');
}