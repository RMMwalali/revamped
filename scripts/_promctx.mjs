import fs from 'node:fs';
import { execSync } from 'node:child_process';
function inspect(file, tag) {
  const g = fs.readFileSync(file, 'utf8');
  console.log('==', tag, file, 'size', g.length);
  for (const m of g.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    const t = JSON.parse('"' + m[1] + '"');
    let i = -1;
    while ((i = t.indexOf('"prominents"', i + 1)) >= 0) {
      console.log(' prominents @', i, JSON.stringify(t.slice(i, i + 90)));
    }
    i = -1;
    while ((i = t.indexOf('"prominentBlock"', i + 1)) >= 0) {
      console.log(' prominentBlock @', i, JSON.stringify(t.slice(i, i + 90)));
    }
  }
}
try {
  const p = execSync('git show HEAD:dist/index.html', { maxBuffer: 1e9 }).toString('utf8');
  fs.writeFileSync('dist/_orig.html', p);
} catch (e) { console.log('git show failed', e.message); }
inspect('dist/index.html', 'CURRENT');
inspect('dist/home/index.html', 'CURRENT-home');
inspect('dist/_orig.html', 'GIT-HEAD');