const fs = require('fs');
const f = fs.readdirSync('dist/assets/root/_next/static/chunks/app/(withQuoteContact)').find((x) => x.startsWith('page-'));
const src = fs.readFileSync('dist/assets/root/_next/static/chunks/app/(withQuoteContact)/' + f, 'utf8');
console.log('file:', f, 'size:', src.length);
for (const k of ['js-project-description', 'ProjectSliderActions']) {
  const i = src.indexOf(k);
  console.log('\n== index of', k, '=', i);
  if (i >= 0) console.log(JSON.stringify(src.slice(Math.max(0, i - 160), i + 160)));
}
// navigation mechanisms
for (const k of ['location.assign', 'router.push', '.push(', 'href=', 'useRouter', 'window.location']) {
  let c = 0, i = -1;
  while ((i = src.indexOf(k, i + 1)) >= 0 && c < 6) { console.log(k, 'at', i, '->', JSON.stringify(src.slice(Math.max(0, i - 70), i + 90))); c++; }
  if (c === 6) console.log(k, '...more');
}