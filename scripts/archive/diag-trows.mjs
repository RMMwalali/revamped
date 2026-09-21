import fs from 'node:fs';
for (const slug of ['adidas-display-wall', 'uefa-champions-league-final-2026', 'ypo-global-event']) {
  const h = fs.readFileSync(`dist/project/${slug}/index.html`, 'utf8');
  const tRows = [...h.matchAll(/:T[0-9a-f]{4,}/gi)];
  console.log(`${slug}: T-frame markers=${tRows.length} first=${tRows.slice(0,2).map(m=>m[0])}`);
  const pushes = [...h.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)];
  let multi = 0;
  for (const p of pushes) {
    let s;
    try { s = JSON.parse('"' + p[1] + '"'); } catch { continue; }
    if (s.split('\n').length > 1) multi++;
  }
  console.log(`  pushes=${pushes.length} multi-line pushes=${multi}`);
}