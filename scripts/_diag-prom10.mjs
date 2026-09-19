import fs from 'fs';
const t = fs.readFileSync('dist/_next/static/chunks/app(withQuoteContact)/page-2f419b88353d9d34.js', 'utf8');
for (const k of ['prominentBlock.prominents', 'prominentBlock', '.prominents', 'edges', 'prominentSlider', 'prominentSlide', 'HighlightProjects', 'prominentsBlock']) {
  const i = t.indexOf(k);
  console.log(k, i, i >= 0 ? JSON.stringify(t.slice(Math.max(0, i - 160), i + 160)) : '');
}