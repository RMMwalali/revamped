import fs from 'node:fs';
import { execSync } from 'node:child_process';
const pris = execSync('git show HEAD:dist/projects/index.html', { maxBuffer: 1e9 }).toString('utf8');
// simulate the count step
const staticEnd = pris.indexOf('self.__next_f.push(');
const stat = pris.slice(0, staticEnd);
const rowRe = /<div class="ProjectListSection_project__76n_c css-avegm8"><a href="\/project\/[^"]+"[\s\S]*?<\/a><\/div>/g;
const rows = [];
let lastRowEnd = 0, r;
while ((r = rowRe.exec(stat))) { rows.push(r[0]); lastRowEnd = rowRe.lastIndex; }
const listOpen = '<div class="ProjectListSection_projectList__bFJCV css-rfhucd">';
const liOpen = stat.indexOf(listOpen);
const newStat = stat.slice(0, liOpen + listOpen.length) + rows.slice(0, 12).join('') + stat.slice(lastRowEnd);
const g = newStat + pris.slice(staticEnd);
console.log('full g len', g.length, 'scripts', [...g.matchAll(/<script[^>]*>/g)].length, 'marker3', (g.match(/"3:\[\[/g) || []).length, '>71</div> count', (g.match(/>71<\/div>/g) || []).length);
// the count step
const g2 = g.split('>71</div>').join('>12</div>');
console.log('after split/join len', g2.length, 'scripts', [...g2.matchAll(/<script[^>]*>/g)].length, 'marker3', (g2.match(/"3:\[\[/g) || []).length, '>71</div> left', (g2.match(/>71<\/div>/g) || []).length);
// check if the footer3 is still there
const scripts = [...g2.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
const foot = scripts.find((c) => c.includes('get you accurate numbers'));
console.log('footer3', foot ? 'len ' + foot.length : 'MISS');
console.log('first few scripts < 100 chars:');
scripts.filter((s) => s[1].length < 100).slice(0, 5).forEach((s) => console.log('  script', s[1].length, JSON.stringify(s[1].slice(0, 60))));