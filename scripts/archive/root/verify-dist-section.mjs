import { readFile } from 'node:fs/promises';
const t = await readFile('./dist/home/index.html', 'utf8');
console.log('dist/home len:', t.length);
for (const w of ['styles_invention__bakTB', '/insight/', 't-338', 'stillcraft-london-hub']) {
  console.log(w, ':', t.split(w).length - 1);
}
const i = t.indexOf('styles_invention__bakTB');
// walk: show the div nesting via counting from block start, print first 600 and find candidate end by brace depth on a window
const start = t.lastIndexOf('<div', i);
console.log('--- block starts at', start, ':', t.slice(start, start + 120));
// find what comes right before block start (parent context)
console.log('--- before:', t.slice(Math.max(0, start - 300), start).replace(/\s+/g, ' '));
