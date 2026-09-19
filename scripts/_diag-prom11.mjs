import fs from 'fs';
const t = fs.readFileSync('C:/Users/SERENI~1/AppData/Local/Temp/opencode/page-home.js', 'utf8');
for (const k of ['prominentBlock', '.prominents', 'testimonialBlock', '.testimonials', 'ec=', 'data-testid', 'ProjectCard', 'caseMeta', 'prominent', 'CSS0', 'useSlider', 'handleNext']) {
  const hits = [];
  let i = -1;
  while ((i = t.indexOf(k, i + 1)) >= 0) hits.push(i);
  console.log(k, '=>', hits.length, hits.slice(0, 6));
}
// dump prominentBlock references context
const i = t.indexOf('prominentBlock');
console.log('\nctx:', JSON.stringify(t.slice(i - 200, i + 400)));