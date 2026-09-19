import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
// flight rows escaped with backslash: \"$41\"
for (const m of ['$41','$42','$44']) {
  const q = '\\\\"' + m + '\\\\"';
  const hits = [];
  let i = -1;
  while ((i = h.indexOf('\\"'+m+'\\"', i + 1)) >= 0) hits.push(i);
  console.log('$'+m, hits);
}
// The events band SSR wrapper in static region: find its end. The wrapper closes before stats section.
// Look at what is right after the leader strip / case links region in static html.
const bandStart = 192165;
// find "css-41c6dw" region end - look at 2KB after alt=Leader area
const leader = h.indexOf('css-41c6dw', bandStart);
console.log('\nleader at', leader);
console.log(JSON.stringify(h.slice(leader, leader + 1200)));