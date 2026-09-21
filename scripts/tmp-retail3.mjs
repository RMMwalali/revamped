import {readFileSync} from 'node:fs';
const raw = readFileSync('dist/index.html', 'utf8');
let i = 0, n = 0;
while ((i = raw.indexOf('Retail & Malls', i)) >= 0 && n < 12) {
  console.log('RAW', n, JSON.stringify(raw.slice(Math.max(0, i - 120), i + 60)));
  i += 10; n++;
}
const s = await (await fetch('http://127.0.0.1:3105/')).text();
const m = [...s.matchAll(/<h4[^>]*class="css-hj2ayb"[^>]*>([^<]+)<\/h4>/g)];
console.log('served h4s:', m.map(x => x[1]));
