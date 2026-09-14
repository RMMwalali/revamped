import { execSync } from 'node:child_process';
const pris = execSync('git show HEAD:dist/projects/index.html', { maxBuffer: 1e9 }).toString('utf8');
function stats(g, name) {
  const scripts = [...g.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const foot = scripts.find((c) => c.includes('get you accurate numbers'));
  console.log(name, 'scripts', scripts.length, 'footer3 len', foot ? foot.length : 'MISSING', 'marker3', (g.match(/"3:\[\[/g) || []).length);
}
stats(pris, 'PRIS  ');

// step 1: static reconstruction
const rowRe = /<div class="ProjectListSection_project__76n_c css-avegm8"><a href="\/project\/[^"]+"[\s\S]*?<\/a><\/div>/g;
const staticEnd = pris.indexOf('self.__next_f.push(');
const stat = pris.slice(0, staticEnd);
const rows = [];
let lastRowEnd = 0;
let r;
while ((r = rowRe.exec(stat))) { rows.push(r[0]); lastRowEnd = rowRe.lastIndex; }
const listOpen = '<div class="ProjectListSection_projectList__bFJCV css-rfhucd">';
const liOpen = stat.indexOf(listOpen);
const newStat = stat.slice(0, liOpen + listOpen.length) + rows.slice(0, 12).join('') + stat.slice(lastRowEnd);
let g = newStat + pris.slice(staticEnd);
stats(g, 'STEP1 static');

// step 2: count swap
const cntBefore = (g.match(/>71<\/div>/g) || []).length;
console.log('cnt occurrences to swap:', cntBefore);
g = g.split('>71</div>').join('>12</div>');
stats(g, 'STEP2 count ');