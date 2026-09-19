import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
const refs = [...h.matchAll(/prominentsBlock[^\x00]*?edges:\d+/g)];
const refs2 = [...h.matchAll(/(?:prominents|prominentBlock|prominentCard|HighlightProjects|caseCards)[\s\S]{0,30}edges:\d+/g)];
console.log('prominents edges refs:', refs2.map((m) => m[0].slice(-24)).slice(0, 20));
for (const mark of ['ProjectCard', 'case-study-card', 'js-project-description', 'will-change-transform']) {
  console.log(mark, h.indexOf(mark));
}