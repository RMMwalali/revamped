import fs from 'node:fs';
const g = fs.readFileSync('dist/project/easter-at-galleria-mall/index.html', 'utf8');
console.log('.jpg refs', (g.match(/mall-case\/[^"']*\.jpg/g) || []).length);
console.log('.svg refs', (g.match(/mall-case\/[^"']*\.svg/g) || []).length);
console.log('sample', [...new Set(g.match(/mall-case\/[^"']*\.svg/g) || [])].slice(0, 9));
const h = g.slice(0, g.indexOf('self.__next_f.push('));
console.log('STATIC .svg refs', (h.match(/mall-case\/[^"']*\.svg/g) || []).length);
// also confirm the svg files exist
for (const s of new Set((g.match(/mall-case\/[^"']*\.svg/g) || []))) {
  if (!fs.existsSync('dist/' + s)) console.log('MISSING', s);
}
console.log('done');