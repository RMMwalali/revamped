import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
for (const k of ['caseStudies', 'caseStudiesBlock', 'CaseStudies', 'projectBlock', 'projectsBlock', 'highlightsBlock', 'sliders', 'Slider', 'EventSlider']) {
  const i = h.indexOf(k);
  console.log(k, i, i >= 0 ? JSON.stringify(h.slice(i - 100, i + 80)) : '');
}