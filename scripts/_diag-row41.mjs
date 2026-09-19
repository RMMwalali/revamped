import { readFile } from 'node:fs/promises';

const BS = String.fromCharCode(92);
const delim = 'self.__next_f.push(';

function decodeOne(s, i) {
  const c = s[i];
  if (c === undefined) return null;
  if (c !== BS) { const cp = s.codePointAt(i); const adv = cp > 0xffff ? 2 : 1; return [String.fromCodePoint(cp), adv]; }
  const n = s[i + 1];
  if (n === undefined) return [BS, 1];
  if (n === '\n') return ['', 2];
  if (n === '\r') return ['', (s[i + 2] === '\n') ? 3 : 2];
  if (n === 'n') return ['\n', 2];
  if (n === 'r') return ['\r', 2];
  if (n === 't') return ['\t', 2];
  if (n === 'b') return ['\b', 2];
  if (n === 'f') return ['\f', 2];
  if (n === 'v') return ['\v', 2];
  if (n === '0' && !/[0-9]/.test(s[i + 2] || '')) return ['\0', 2];
  if (n === '"') return ['"', 2];
  if (n === "'") return ["'", 2];
  if (n === BS) return [BS, 2];
  if (n === '/') return ['/', 2];
  if (n === 'x' && /^[0-9a-fA-F]{2}/.test(s.slice(i + 2, i + 4))) return [String.fromCharCode(parseInt(s.slice(i + 2, i + 4), 16)), 4];
  if (n === 'u') {
    if (/^[0-9a-fA-F]{4}/.test(s.slice(i + 2, i + 6))) return [String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16)), 6];
    if (s[i + 2] === '{') { const e = s.indexOf('}', i + 3); if (e > 0 && e - (i + 3) <= 6 && /^[0-9a-fA-F]+$/.test(s.slice(i + 3, e))) return [String.fromCodePoint(parseInt(s.slice(i + 3, e), 16)), e - i + 1]; }
  }
  return [n, 2];
}
function decodeFully(raw) { let out = '', i = 0; while (i < raw.length) { const r = decodeOne(raw, i); if (!r) break; out += r[0]; i += r[1]; } return out; }

function rowsFrom(html) {
  const parts = html.split(delim);
  let joined = '';
  for (let i = 1; i < parts.length; i++) {
    const m = /^\[(\d+),"/.exec(parts[i]);
    if (!m) continue;
    let j = m[0].length;
    while (j < parts[i].length) { if (parts[i][j] === BS) { j += 2; continue; } if (parts[i][j] === '"') break; j++; }
    joined += decodeFully(parts[i].slice(m[0].length, j));
  }
  return joined.split('\n');
}

const raw = rowsFrom(await readFile('dist/_steps/14-applyHighlightsFix.html', 'utf8'));
const wall = rowsFrom(await readFile('dist/_steps-slice/s06-flight-edges.html', 'utf8'));

function showRow(rows, id, label) {
  const r = rows.find(x => x.startsWith(id + ':')) || '';
  console.log(`\n=========== ${label} row ${id} (len ${r.length}) ===========`);
  // pad ID
  const body = r.slice(id.length + 1);
  // print decoded (already decoded). Show max 3000 chars around 'testimonial'
  const ti = body.indexOf('testimonial');
  const from = Math.max(0, ti - 400);
  console.log(body.slice(from, from + 2600));
}

showRow(wall, '41', 'WALL s06');
showRow(raw, '41', 'RAW 14');