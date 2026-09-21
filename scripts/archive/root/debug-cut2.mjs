import { readFile } from 'node:fs/promises';
const html = await readFile('./dist/index.html', 'utf8');
const fMark = '\\"className\\":\\"styles_invention__bakTB\\"';
console.log('fMark raw:', JSON.stringify(fMark));
const fIdx = html.indexOf(fMark);
console.log('fIdx:', fIdx);
if (fIdx < 0) { console.log('MARKER NOT FOUND'); process.exit(0); }
const fOpen = html.lastIndexOf('[\\"$\",', fIdx);
console.log('fOpen:', fOpen);
const head = html.slice(fOpen, fIdx + fMark.length + 1);
console.log('head:', JSON.stringify(head.slice(0, 200)));
console.log('headtest:', /^\[\\"\$\\",\\"[^\\"]+\\",null,\{\\"className\\":\\"styles_invention__bakTB\\"[,]/.test(head));
// bracket scan
let depth = 0, inStr = false, esc = false, fEnd = -1;
for (let i = fOpen; i < html.length; i++) {
  const c = html[i];
  if (inStr) {
    if (esc) esc = false;
    else if (c === '\\') esc = true;
    else if (c === '"') inStr = false;
  } else if (c === '"') inStr = true;
  else if (c === '[') depth++;
  else if (c === ']') { depth--; if (depth === 0) { fEnd = i + 1; break; } }
  if (i - fOpen > 300000) { console.log('SCAN TOO FAR'); break; }
}
console.log('fEnd:', fEnd, 'span len:', fEnd - fOpen);
if (fEnd > 0) {
  console.log('next char:', JSON.stringify(html[fEnd]), 'prev char:', JSON.stringify(html[fOpen - 1]));
  const span = html.slice(fOpen, fEnd);
  console.log('flight span occurrences:', html.split(span).length - 1);
}
