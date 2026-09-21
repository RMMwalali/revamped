import { readFile, writeFile } from 'node:fs/promises';
const Q = String.fromCharCode(39);
const SC = String.fromCharCode(59);
const lines = (await readFile('./scripts/transform.mjs', 'utf8')).split('\n');
const find = (anchor) => {
  const i = lines.findIndex((l) => l.indexOf(anchor) >= 0);
  if (i < 0) throw new Error('anchor missing: ' + anchor);
  return i;
};
const J = (parts) => parts.join('') + SC;
// 1) fMark line
const iMark = find('const fMark = ');
lines.splice(iMark, 1,
  J(['  const BSQ = String.fromCharCode(92) + String.fromCharCode(34)']),
  J(['  const fMark = BSQ + ', Q + 'className' + Q, ' + BSQ + ', Q + ':' + Q, ' + BSQ + ', Q + 'styles_invention__bakTB' + Q, ' + BSQ']));
// 2) fOpen line
const iOpen = find('const fOpen = html.lastIndexOf(');
lines.splice(iOpen, 1,
  J(['  const fOpenNeedle = ', Q + '[' + Q, ' + BSQ + ', Q + '$' + Q, ' + BSQ + ', Q + ',' + Q]),
  '  const fOpen = html.lastIndexOf(fOpenNeedle, fIdx)' + SC);
// 3) regex head check -> manual validation
const iHead = find('DBG bail fhead');
lines.splice(iHead, 1,
  '  let hp = fOpen + fOpenNeedle.length' + SC,
  '  const typeEnd = html.indexOf(BSQ, hp)' + SC,
  J(['  const headTail = ', Q + ',null,{' + Q, ' + BSQ + ', Q + 'className' + Q, ' + BSQ + ', Q + ':' + Q, ' + BSQ + ', Q + 'styles_invention__bakTB' + Q, ' + BSQ + ', Q + ',' + Q]),
  '  if (typeEnd < 0 || typeEnd === hp || html.slice(typeEnd, typeEnd + headTail.length) !== headTail) { console.error(' + Q + 'DBG bail fhead' + Q + '); return html; }');
await writeFile('./scripts/transform.mjs', lines.join('\n'), 'utf8');
console.log('patched OK');
