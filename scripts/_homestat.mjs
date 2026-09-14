import fs from 'node:fs';
const g = fs.readFileSync('dist/index.html', 'utf8');
const s = g.slice(0, g.indexOf('self.__next_f.push('));
for (const k of ['UEFA Champions', 'Menzies Congress', 'Adevinta Ignite']) {
  let i = -1;
  while ((i = s.indexOf(k, i + 1)) >= 0) {
    console.log('\n===== ' + k + ' @ ' + i + ' =====');
    console.log(JSON.stringify(s.slice(i - 320, i + 320)));
  }
}