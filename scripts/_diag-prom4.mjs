import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
// find static h3 cards with will-change-transform inside the highlight slider
const re = /<h3[^>]*will-change-transform[^>]*>([\s\S]*?)<\/h3>/g;
const cards = [];
let m;
while ((m = re.exec(h))) {
  const inner = m[1].replace(/<[^>]+>/g, '|').replace(/\s+/g, ' ').trim();
  cards.push({ at: m.index, text: inner.slice(0, 140) });
}
console.log('static will-change h3 cards:', cards.length);
for (const c of cards) console.log('  y', c.at, JSON.stringify(c.text));
// Also find the animate "Highlight projects" h3 region fully
const hi = h.indexOf('Highlight projects');
console.log('\nregion after Highlight projects heading (static first card):', JSON.stringify(h.slice(hi, hi + 420)));
// find all <h3 ... will-change> occurrences within +/- 1200 of Highlight projects
const lo = h.slice(Math.max(0, hi - 3000), hi + 4000);
console.log('\ncount of h3 in radius:', (lo.match(/<h3/g) || []).length);