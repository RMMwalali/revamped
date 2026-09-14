import fs from 'node:fs';
import { execSync } from 'node:child_process';
const pris = execSync('git show HEAD:dist/projects/index.html', { maxBuffer: 1e9 }).toString('utf8');
const ac = fs.readFileSync('scripts/_aftercount.html', 'utf8');
console.log('PRISTINE first-push occurrences:');
for (const m of pris.matchAll(/self\.__next_f\.push\(\[1,"?([0-9]+):/g)) {
  console.log(' ', m[1], '@', m.index);
}
console.log('aftercount: index of each kept push:');
for (const m of ac.matchAll(/self\.__next_f\.push\(\[1,"?([0-9]+):/g)) {
  console.log(' ', m[1], '@', m.index);
}
console.log('pristine len', pris.length, 'aftercount len', ac.length);
// is "1:" still present anywhere in aftercount?
console.log('contain "1:[["?', ac.includes('self.__next_f.push([1,"1:[['), 'contains "0:"?', ac.includes('self.__next_f.push([1,"0:'));
// what is at aftercount position = first kept push minus 4 pushes? find where newStat's rows end: search for the 12th new row (mothers-day-brunch) end in ac
const i = ac.indexOf('mothers-day-brunch-at-southfield-mall');
console.log('mothers-day-brunch @', i, JSON.stringify(ac.slice(i + 40, i + 200)));