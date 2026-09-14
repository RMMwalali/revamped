import fs from 'node:fs';
const g = fs.readFileSync('scripts/_aftercount.html', 'utf8').slice(0, 250000);
// find the flight region start: where newStat would end. Find ALL occurrences of 'self.__next_f.push'
for (const m of g.matchAll(/self\.__next_f\.push\(\[1,/g)) console.log('push @', m.index, 'head:', JSON.stringify(g.slice(m.index, m.index + 40)));
console.log('tail-check: what precedes first push:');
const first = g.indexOf('self.__next_f.push(');
console.log(JSON.stringify(g.slice(first - 300, first + 80)));