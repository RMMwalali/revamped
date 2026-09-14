import fs from 'node:fs';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
const disk = fs.readFileSync('dist/projects/index.html', 'utf8');
const pris = execSync('git show HEAD:dist/projects/index.html', { maxBuffer: 1e9 }).toString('utf8');
function scripts(html) {
  return [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}
for (const [name, html] of [['DISK', disk], ['PRISTINE', pris]]) {
  const S = scripts(html).find((c) => c.includes('get you accurate numbers'));
  let parses = true, err = '';
  try { new vm.Script(S); } catch (e) { parses = false; err = e.message; }
  console.log(name, 'len', S.length, 'parses', parses, err);
  if (!parses) {
    console.log('  tail:', JSON.stringify(S.slice(-240)));
    console.log('  head:', JSON.stringify(S.slice(0, 140)));
  }
}
// locate & print the disk raw script fully char context around the corruption — find first unescaped quote after header
const dS = scripts(disk).find((c) => c.includes('get you accurate numbers'));
if (!dS) console.log('DISK lacks script');