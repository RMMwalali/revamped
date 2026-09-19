import { readFile } from 'node:fs/promises';

const BS = String.fromCharCode(92);
const delim = 'self.__next_f.push(';

function decodeOne(s, i) {
  const c = s[i];
  if (c === undefined) return null;
  if (c !== BS) {
    const cp = s.codePointAt(i);
    const adv = cp > 0xffff ? 2 : 1;
    return [String.fromCodePoint(cp), adv];
  }
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
    if (s[i + 2] === '{') {
      const e = s.indexOf('}', i + 3);
      if (e > 0 && e - (i + 3) <= 6 && /^[0-9a-fA-F]+$/.test(s.slice(i + 3, e))) return [String.fromCodePoint(parseInt(s.slice(i + 3, e), 16)), e - i + 1];
    }
  }
  return [n, 2];
}
function decodeFully(raw) {
  let out = '', i = 0;
  while (i < raw.length) { const r = decodeOne(raw, i); if (!r) break; out += r[0]; i += r[1]; }
  return out;
}

function getPushes(html) {
  const parts = html.split(delim);
  const out = [];
  for (let i = 1; i < parts.length; i++) {
    const m = /^\[(\d+),"/.exec(parts[i]);
    if (!m) continue;
    let j = m[0].length;
    while (j < parts[i].length) {
      if (parts[i][j] === BS) { j += 2; continue; }
      if (parts[i][j] === '"') break;
      j++;
    }
    out.push({ idx: Number(m[1]), content: parts[i].slice(m[0].length, j), raw: parts[i].slice(m[0].length, j) });
  }
  return out;
}

function dirs(raw) {
  // decoded text stream
  return decodeFully(raw);
}

(async () => {
  const rawHtml = await readFile('dist/index.html', 'utf8');
  const wallHtml = await readFile('dist/_wallout.html', 'utf8');
  const A = getPushes(rawHtml).map(p => dirs(p.content));
  const B = getPushes(wallHtml).map(p => dirs(p.content));
  console.log('push count RAW', A.length, 'WALL', B.length);
  const joinedA = A.join('');
  const joinedB = B.join('');
  console.log('joined lengths', joinedA.length, joinedB.length);
  // longest common diff summary: walk and report differing windows
  let i = 0, diffs = 0;
  const max = Math.max(joinedA.length, joinedB.length);
  while (i < max) {
    const a = joinedA[i] || '';
    const b = joinedB[i] || '';
    if (a !== b) {
      diffs++;
      const ca = joinedA.slice(Math.max(0, i - 70), i + 100);
      const cb = joinedB.slice(Math.max(0, i - 70), i + 100);
      console.log(`\n## diff #${diffs} at ${i} (lenA=${joinedA.length} lenB=${joinedB.length})`);
      console.log('RAW :', JSON.stringify(ca));
      console.log('WALL:', JSON.stringify(cb));
      // advance to next equal position (small window)
      let adv = 1;
      while (i + adv < max && (joinedA[i + adv] || '') !== (joinedB[i + adv] || '')) adv++;
      if (adv > 400) adv = 400;
      i += adv;
      if (diffs > 30) { console.log('...stopping at 30 diffs'); break; }
    } else i++;
  }
  console.log('\ntotal diffs:', diffs);
})();