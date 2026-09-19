import { readFile } from 'node:fs/promises';

const BS = String.fromCharCode(92);

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
  if (n === '\r') { return ['', (s[i + 2] === '\n') ? 3 : 2]; }
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
  if (n === 'x' && /^[0-9a-fA-F]{2}/.test(s.slice(i + 2, i + 4))) {
    return [String.fromCharCode(parseInt(s.slice(i + 2, i + 4), 16)), 4];
  }
  if (n === 'u') {
    if (/^[0-9a-fA-F]{4}/.test(s.slice(i + 2, i + 6))) {
      return [String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16)), 6];
    }
    if (s[i + 2] === '{') {
      const e = s.indexOf('}', i + 3);
      if (e > 0 && e - (i + 3) <= 6 && /^[0-9a-fA-F]+$/.test(s.slice(i + 3, e))) {
        return [String.fromCodePoint(parseInt(s.slice(i + 3, e), 16)), e - i + 1];
      }
    }
  }
  return [n, 2];
}

function decodeFully(raw) {
  let out = '', i = 0;
  while (i < raw.length) {
    const r = decodeOne(raw, i);
    if (!r) break;
    out += r[0];
    i += r[1];
  }
  return out;
}

const FQ = BS + '"';
const key = FQ + 'partners' + FQ + ':[';

function extractPartners(html) {
  const idx = html.indexOf(key);
  if (idx < 0) return null;
  const open = idx + key.length - 1;
  let depth = 0, end = -1;
  for (let k = open; k < html.length; k++) {
    const ch = html[k];
    if (ch === BS) { k++; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) { end = k; break; } }
  }
  if (end < 0) return null;
  const raw = html.slice(open, end + 1);
  return { raw, dec: decodeFully(raw), start: open, end };
}

for (const [label, file] of [['RAW', 'dist/index.html'], ['WALL', 'dist/_wallout.html']]) {
  const html = await readFile(file, 'utf8');
  const p = extractPartners(html);
  if (!p) { console.log(label, 'no partners'); continue; }
  try {
    const parsed = JSON.parse(p.dec);
    console.log(label, 'decode len:', p.dec.length, 'raw len:', p.raw.length, 'parse OK, nodes:', parsed.length);
  } catch (e) {
    console.log(label, 'JSON PARSE FAIL:', e.message);
    // find approximate problem position
    const dec = p.dec;
    let i = 0, depth = 0, inStr = false, problem = -1;
    for (i = 0; i < dec.length; i++) {
      const c = dec[i];
      if (c === BS) { i++; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '[') depth++;
      else if (c === ']') depth--;
      if (depth < 0) { problem = i; break; }
    }
    console.log(label, 'depth-neg at', problem, 'ctx:', JSON.stringify(dec.slice(Math.max(0, problem - 120), problem + 120)));
  }
}