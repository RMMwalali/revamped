import fs from 'node:fs';
const g = fs.readFileSync('dist/index.html', 'utf8');
const s = g.slice(0, g.indexOf('self.__next_f.push('));
// 'Designed to be remembered' @98384 — expand window to see section start
console.log('===== 2500 before D2BR =====');
console.log(JSON.stringify(s.slice(98384 - 2500, 98384 + 200)));
// slide image 1 (UEFA webp) and next images: find other slide images in static
for (const m of s.matchAll(/UEFA-Champions-League-Final-2026-1-scaled-1\.webp/g)) console.log('UEFA img @', m.index);
for (const m of s.matchAll(/\.webp/g)) console.log('webp @', m.index, JSON.stringify(s.slice(Math.max(0, m.index - 60), m.index + 30)));