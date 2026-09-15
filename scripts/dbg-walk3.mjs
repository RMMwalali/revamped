import { readFile } from 'node:fs/promises';
const html = await readFile('dist/insight/iventions-london-hub/index.html', 'utf8');
const parts = html.split('self.__next_f.push(');
const BS = String.fromCharCode(92);
function parseSeg(seg) {
  const m = /^\[(\d+),"/.exec(seg);
  let i = m[0].length;
  while (i < seg.length) { if (seg[i] === BS) { i += 2; continue; } if (seg[i] === '"') break; i++; }
  return seg.slice(m[0].length, i);
}
const joined = parts.slice(1).map(parseSeg).join('');
const h = joined.indexOf('47:T1226,');
const ps = h + 9;
// decode-walk counting bytes; report total at natural end (next \\n42: marker)
const marker = BS + 'n42:';
const markAt = joined.indexOf(marker, ps);
console.log('next-row marker at raw', markAt);
// count decoded bytes from ps to markAt
let bytes = 0, i = ps;
function dec(s, j) {
  const c = s[j];
  if (c !== BS) { const cp = s.codePointAt(j); const a = cp > 0xffff ? 2 : 1; return [a, Buffer.byteLength(String.fromCodePoint(cp), 'utf8')]; }
  const n = s[j + 1];
  if (n === 'n' || n === 'r' || n === 't' || n === 'b' || n === 'f' || n === 'v' || n === '"' || n === "'" || n === BS || n === '/') return [2, 1];
  if (n === 'u' && /^[0-9a-fA-F]{4}/.test(s.slice(j + 2, j + 6))) return [6, Buffer.byteLength(String.fromCharCode(parseInt(s.slice(j + 2, j + 6), 16)), 'utf8')];
  return [2, Buffer.byteLength(n || '', 'utf8')];
}
while (i < markAt) { const [a, b] = dec(joined, i); bytes += b; i += a; }
console.log('decoded bytes to next row:', bytes, 'want 0x1226 =', 0x1226);
// show raw right before marker
console.log('before marker:', JSON.stringify(joined.slice(markAt - 60, markAt + 20)));
process.exit(0);
