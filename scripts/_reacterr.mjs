import fs from 'node:fs';
const s = fs.readFileSync('dist/assets/root/_next/static/chunks/vendors-17046ce7-1c51721bf7671b66.js', 'utf8');
for (const w of ['did not match', 'same exact', 'server rendered', '418']) {
  let i = -1, c = 0;
  while ((i = s.indexOf(w, i + 1)) >= 0 && c < 6) { console.log(w, i, JSON.stringify(s.slice(i - 90, i + 120))); c++; }
}
const rd = s.indexOf('function rD(e)');
console.log('\n[rD def]\n', s.slice(rd - 600, rd + 300));
// find the error-code template map: `{...418:"...",...}`
const m = s.match(/\{[^{}]{0,80}418\:[^{}]{0,200}\}/g);
console.log('\nmap around 418:', m ? m.slice(0, 2) : 'none');
// find how i(418) message text is stored — "HTML" or template
const i_ = s.indexOf('"HTML"');
console.log('\nfirst "HTML" @', i_, JSON.stringify(s.slice(i_ - 200, i_ + 80)));