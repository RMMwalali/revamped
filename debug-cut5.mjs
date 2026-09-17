import { readFile } from 'node:fs/promises';
const BS = String.fromCharCode(92);
const html = await readFile('./dist/index.html', 'utf8');
// build needles programmatically: zero backslash-literal ambiguity
const fMark = BS + '"className' + BS + '":' + BS + '"styles_invention__bakTB' + BS + '"';
const fIdx = html.indexOf(fMark);
console.log('fIdx:', fIdx);
const openNeedle = '[' + BS + '"$' + BS + '",';
const fOpen = html.lastIndexOf(openNeedle, fIdx);
console.log('fOpen:', fOpen);
console.log('head:', JSON.stringify(html.slice(fOpen, fOpen + 90)));
