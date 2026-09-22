// Length-aware React Flight patching.
//
// Background: Next.js Flight rows with tags T A O o U S s L l G g M m V are
// BYTE-LENGTH-prefixed (`id:TAG<hexlen>,<payload>`) and a payload may span
// several `self.__next_f.push(...)` calls (e.g. an article body: one push ends
// `...47:T1226,` and the 0x1226 bytes continue in the next push). Blind
// string surgery inside such a payload desyncs the stream and the browser
// dies with "Application error ... Connection closed".
//
// safeReplace() applies a plain string swap everywhere while keeping every
// length-prefixed row in sync: push contents are merged (order-preserving, so
// cross-push payloads become whole), payloads are decoded, edited,
// re-encoded and their hex length is recomputed. Everything else (static
// HTML, plain JSON rows, app code) is replaced exactly like before.
const TAGSET = new Set(['T', 'A', 'O', 'o', 'U', 'S', 's', 'L', 'l', 'G', 'g', 'M', 'm', 'V']);
const BS = String.fromCharCode(92);

// ---- JS string decode (mirrors how the browser decodes push arguments) ----
function decodeOne(s, i) {
  const c = s[i];
  if (c === undefined) return null;
  if (c !== BS) {
    const cp = s.codePointAt(i);
    const adv = cp > 0xffff ? 2 : 1;
    const ch = String.fromCodePoint(cp);
    return [ch, adv, Buffer.byteLength(ch, 'utf8')];
  }
  const n = s[i + 1];
  if (n === undefined) return [BS, 1, 1];
  // Line continuations contribute zero bytes.
  if (n === '\n') return ['', 2, 0];
  if (n === '\r') {
    if (s[i + 2] === '\n') return ['', 3, 0];
    return ['', 2, 0];
  }
  if (n === 'n') return ['\n', 2, 1];
  if (n === 'r') return ['\r', 2, 1];
  if (n === 't') return ['\t', 2, 1];
  if (n === 'b') return ['\b', 2, 1];
  if (n === 'f') return ['\f', 2, 1];
  if (n === 'v') return ['\v', 2, 1];
  if (n === '0' && !/[0-9]/.test(s[i + 2] || '')) return ['\0', 2, 1];
  if (n === '"') return ['"', 2, 1];
  if (n === "'") return ["'", 2, 1];
  if (n === BS) return [BS, 2, 1];
  if (n === '/') return ['/', 2, 1];
  if (n === 'x' && /^[0-9a-fA-F]{2}/.test(s.slice(i + 2, i + 4))) {
    return [String.fromCharCode(parseInt(s.slice(i + 2, i + 4), 16)), 4, 1];
  }
  if (n === 'u') {
    if (/^[0-9a-fA-F]{4}/.test(s.slice(i + 2, i + 6))) {
      const ch = String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16));
      return [ch, 6, Buffer.byteLength(ch, 'utf8')];
    }
    if (s[i + 2] === '{') {
      const e = s.indexOf('}', i + 3);
      if (e > 0 && e - (i + 3) <= 6 && /^[0-9a-fA-F]+$/.test(s.slice(i + 3, e))) {
        const ch = String.fromCodePoint(parseInt(s.slice(i + 3, e), 16));
        return [ch, e - i + 1, Buffer.byteLength(ch, 'utf8')];
      }
    }
  }
  // Unknown escape: JS drops the backslash, keeps the char.
  return [n, 2, Buffer.byteLength(n, 'utf8')];
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

// ---- JS string encode (script-safe, Next-style: < > & " \ and controls escaped) ----
function encodeJs(s) {
  let out = '';
  for (const ch of String(s)) {
    const cp = ch.codePointAt(0);
    if (ch === BS) out += BS + BS;
    else if (ch === '"') out += BS + '"';
    else if (ch === '<') out += BS + 'u003c';
    else if (ch === '>') out += BS + 'u003e';
    else if (ch === '&') out += BS + 'u0026';
    else if (ch === '\n') out += BS + 'n';
    else if (ch === '\r') out += BS + 'r';
    else if (ch === '\t') out += BS + 't';
    else if (ch === '\b') out += BS + 'b';
    else if (ch === '\f') out += BS + 'f';
    else if (cp === 0x2028 || cp === 0x2029) out += BS + 'u' + cp.toString(16).padStart(4, '0');
    else if (cp < 0x20 || cp === 0x7f) out += BS + 'u' + cp.toString(16).padStart(4, '0');
    else if (cp >= 0xd800 && cp <= 0xdfff) out += BS + 'u' + cp.toString(16).padStart(4, '0');
    else out += ch;
  }
  return out;
}

function isHex(c) {
  return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
}

// Token chars: a match touching one of these sits inside a longer token —
// a filename, URL path, query string or escape sequence — and must be left
// alone. This keeps short admin labels (org names like UEFA/Pfizer,
// amounts) from rewriting asset URLs that merely contain them
// (UEFA-logo.png -> "Galleria Shopping mall"-logo.png 404s, spaces injected
// into srcsets, preload hrefs going invalid).
//
// Escape-aware: inside flight JS strings a closing \" (or \n \r \t \uXXXX)
// right after the match is a string terminator, NOT a token char — without
// this, every in-flight match would be skipped and hydration would go stale.
// Conversely \/ (escaped slash) stays a token char so raw-form swaps never
// touch backslash-escaped URLs (the \/ form has its own swap pass).
const TOKEN_CH = /[A-Za-z0-9_\-/%\\.]/;
function prevIsToken(s, j) {
  if (j <= 0) return false;
  const c = s[j - 1];
  if (c === '"') return false; // string open (covers opening \")
  if (c === BS) return true; // conservative: adjacency to a lone backslash
  if ((c === 'n' || c === 'r' || c === 't') && j >= 2 && s[j - 2] === BS) return false; // after \n-style escape
  if (/\\u[0-9a-fA-F]{4}$/.test(s.slice(Math.max(0, j - 6), j))) return false; // after \uXXXX escape
  return TOKEN_CH.test(c);
}
function nextIsToken(s, j, len) {
  const k = j + len;
  if (k >= s.length) return false;
  if (s[k] === BS) {
    const n = s[k + 1] || '';
    if (n === '"') return false; // closing \" -> string terminator
    if (n === 'n' || n === 'r' || n === 't') return false; // newline escape
    if (n === 'u') return false; // \uXXXX (& < > " ...) -> text boundary
    if (n === '/') return true; // \/ -> still inside a URL
    if (n === BS) return true; // literal backslash in content
    return TOKEN_CH.test(n);
  }
  return TOKEN_CH.test(s[k]);
}
export function boundedSplitJoin(s, from, to) {
  if (!from || from === to) return s;
  let out = '', i = 0;
  for (;;) {
    const j = s.indexOf(from, i);
    if (j < 0) { out += s.slice(i); break; }
    if (prevIsToken(s, j) || nextIsToken(s, j, from.length)) {
      out += s.slice(i, j + from.length);
      i = j + from.length;
      continue;
    }
    out += s.slice(i, j) + to;
    i = j + from.length;
  }
  return out;
}

// Walk one length-prefixed payload starting at raw index `at`.
// Returns raw end index, or -1 if `want` bytes never land exactly.
function walkPayload(raw, at, want) {
  let bytes = 0;
  let i = at;
  while (i < raw.length) {
    if (bytes === want) return i;
    if (bytes > want) return -1;
    const r = decodeOne(raw, i);
    if (!r) return -1;
    bytes += r[2];
    i += r[1];
  }
  return bytes === want ? i : -1;
}

// Find verified length-prefixed rows in push-string content.
// Returns [{ hdrLenStart, hdrLenEnd, payloadStart, payloadEnd }].
function findLenRows(content) {
  const rows = [];
  let pos = 0;
  const n = content.length;
  while (pos < n) {
    const colon = content.indexOf(':', pos);
    if (colon < 0) break;
    let run = colon - 1;
    while (run >= 0 && isHex(content[run])) run--;
    run++;
    if (run >= colon) { pos = colon + 1; continue; }
    const tag = content[colon + 1];
    if (!TAGSET.has(tag)) {
      // Plain row: skip to next raw newline-escape (or end).
      const nl = content.indexOf(BS + 'n', colon + 1);
      pos = nl < 0 ? n : nl + 2;
      continue;
    }
    let h = colon + 2, hex = '';
    while (h < n && isHex(content[h])) { hex += content[h]; h++; }
    if (!hex || content[h] !== ',') { pos = colon + 1; continue; }
    const end = walkPayload(content, h + 1, parseInt(hex, 16));
    if (end < 0) { pos = colon + 1; continue; }
    // Boundary after the payload: raw newline-escape (next row), content
    // end, or the start of the next row header (T-lengths include the
    // payload's trailing newline, so the next header may follow directly).
    const atSep = content[end] === BS && content[end + 1] === 'n';
    let atHeader = false;
    if (!atSep && end !== n) {
      let q = end, hd = '';
      while (q < n && isHex(content[q]) && hd.length < 24) { hd += content[q]; q++; }
      atHeader = hd.length > 0 && content[q] === ':';
    }
    if (!atSep && end !== n && !atHeader) { pos = colon + 1; continue; }
    rows.push({ hdrLenStart: colon + 2, hdrLenEnd: h, payloadStart: h + 1, payloadEnd: end });
    pos = atSep ? end + 2 : end;
  }
  return rows;
}

// Parse a push segment `[N,"..."])</script>...` into { prefix, content, suffix }.
function parseSeg(seg) {
  const m = /^\[(\d+),"/.exec(seg);
  if (!m) return null;
  let i = m[0].length;
  while (i < seg.length) {
    if (seg[i] === BS) { i += 2; continue; }
    if (seg[i] === '"') break;
    i++;
  }
  if (i >= seg.length) return null;
  return { prefix: seg.slice(0, m[0].length), content: seg.slice(m[0].length, i), suffix: seg.slice(i) };
}

// Edit merged content: verified rows get decode->replace->encode+relen,
// everything else gets a blind replace. Returns new content.
// bounded=true skips matches that sit inside longer tokens/URLs (see TOKEN_CH).
function editContent(content, from, to, bounded) {
  const rep = (s) => (bounded ? boundedSplitJoin(s, from, to) : s.split(from).join(to));
  const found = findLenRows(content);
  const flat = [];
  for (const r of found) {
    if (flat.length && r.payloadStart < flat[flat.length - 1].payloadEnd) continue;
    flat.push(r);
  }
  if (!flat.length) return rep(content);
  let out = '';
  let last = 0;
  for (const r of flat) {
    out += rep(content.slice(last, r.hdrLenStart));
    const dec = decodeFully(content.slice(r.payloadStart, r.payloadEnd));
    const ndec = rep(dec);
    if (ndec !== dec) {
      out += Buffer.byteLength(ndec, 'utf8').toString(16) + ',' + encodeJs(ndec);
    } else {
      out += content.slice(r.hdrLenStart, r.payloadEnd);
    }
    last = r.payloadEnd;
  }
  out += rep(content.slice(last));
  return out;
}

function applyOnePair(html, from, to, pushesOnly, bounded) {
  if (!from || from === to || !html.includes(from)) return html;
  const rep = (s) => (bounded ? boundedSplitJoin(s, from, to) : s.split(from).join(to));
  const delim = 'self.__next_f.push(';
  if (!html.includes(delim)) return pushesOnly ? html : rep(html);
  const parts = html.split(delim);
  const segs = [];
  for (let i = 1; i < parts.length; i++) segs.push(parseSeg(parts[i]));
  if (segs.some((s) => !s)) return pushesOnly ? html : rep(html); // unexpected shape: legacy path
  // Merge only when a payload spans pushes: any non-empty content that does
  // not start with a row header is a continuation (same for a truncated
  // length-header tail). Otherwise process segments in place (no restructuring).
  let needMerge = false;
  for (const s of segs) {
    if (s.content.length && !/^[0-9a-f]+:/.test(s.content)) { needMerge = true; break; }
    if (/[0-9a-f]+:[TAOoUSsLlGgMmV][0-9a-f]*,?$/.test(s.content.slice(-32))) { needMerge = true; break; }
  }
  const head = pushesOnly ? parts[0] : rep(parts[0]);
  if (!needMerge) {
    let out = head;
    for (const s of segs) {
      // Tails (`"])</script>...`) carry no length-prefixed rows: blind is safe.
      const tail = rep(s.suffix);
      out += delim + s.prefix + editContent(s.content, from, to, bounded) + tail;
    }
    return out;
  }
  // Merge all push-string contents into the first push (order-preserving).
  // Chunk order is unchanged so the client stream is identical; remaining
  // pushes are emptied. This makes cross-push payloads whole.
  const joined = segs.map((s) => s.content).join('');
  const content = editContent(joined, from, to, bounded);
  const tail0 = rep(segs[0].suffix);
  let out = head + delim + segs[0].prefix + content + tail0;
  for (let k = 1; k < segs.length; k++) {
    out += delim + segs[k].prefix + '' + rep(segs[k].suffix);
  }
  return out;
}

export function safeReplace(html, from, to, bounded) {
  if (!from || from === to) return html;
  return applyOnePair(html, from, to, false, bounded);
}

// Push-string contents only (static HTML and segment tails untouched),
// length-synced. Used where single-occurrence precision matters elsewhere.
export function safeReplacePushes(html, from, to, bounded) {
  if (!from || from === to) return html;
  return applyOnePair(html, from, to, true, bounded);
}

export function safeReplacePairs(html, pairs, bounded) {
  let out = html;
  for (const [from, to] of pairs || []) {
    if (from && from !== to) out = applyOnePair(out, from, to, false, bounded);
  }
  return out;
}

// Verified-rows-only replace: decode -> bounded-replace -> re-encode + relen.
// Blind spans, tails and static HTML are left byte-identical. `from`/`to`
// are PLAIN values (decoded domain); `to` is always re-encoded on write, so
// quotes, newlines and backslashes in admin text can never break the
// enclosing JS strings ("Invalid or unexpected token" blank pages).
export function safeReplaceVerified(html, from, to) {
  if (!from || from === to) return html;
  const delim = 'self.__next_f.push(';
  if (!html.includes(delim) || !html.includes(from)) return html;
  const parts = html.split(delim);
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const s = parseSeg(parts[i]);
    if (!s) return html; // unexpected shape: bail unchanged
    const found = findLenRows(s.content);
    if (!found.length) { out += delim + parts[i]; continue; }
    const flat = [];
    for (const r of found) {
      if (flat.length && r.payloadStart < flat[flat.length - 1].payloadEnd) continue;
      flat.push(r);
    }
    let c = '', last = 0;
    for (const r of flat) {
      c += s.content.slice(last, r.hdrLenStart);
      const dec = decodeFully(s.content.slice(r.payloadStart, r.payloadEnd));
      const ndec = boundedSplitJoin(dec, from, to);
      c += (ndec !== dec)
        ? Buffer.byteLength(ndec, 'utf8').toString(16) + ',' + encodeJs(ndec)
        : s.content.slice(r.hdrLenStart, r.payloadEnd);
      last = r.payloadEnd;
    }
    c += s.content.slice(last);
    out += delim + s.prefix + c + s.suffix;
  }
  return out;
}

export { parseSeg, findLenRows, decodeFully, encodeJs };

// Scanner model for push-string content: every literal quote char is
// backslash-escaped, so string delimiters are the 2-char sequence `\".
// The helpers below toggle string state on `\"` and skip other `\X`
// escapes, so brackets inside string values never confuse depth counting.

// Split a bracket-balanced `[...]` array inner into top-level `{...}`
// object spans. String-aware (delimiters are `\"`) so brackets inside
// string values don't confuse depth counting. Returns [{start, end}]
// (end exclusive) relative to `inner`.
export function splitTopObjects(inner) {
  const out = [];
  let depth = 0, start = -1, inStr = false;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === BS) {
      if (inner[i + 1] === '"') inStr = !inStr;
      i++;
      continue;
    }
    if (inStr) continue;
    if (c === '{') { if (depth === 0) start = i; depth++; }
    else if (c === '}') {
      depth--;
      if (depth === 0 && start >= 0) { out.push({ start, end: i + 1 }); start = -1; }
      if (depth < 0) depth = 0;
    }
  }
  return out;
}

// Split a bracket-balanced `[...]` array inner into top-level `[...]`
// array-element spans (string-aware, same rules as splitTopObjects).
export function splitTopArrays(inner) {
  const out = [];
  let depth = 0, start = -1, inStr = false;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === BS) {
      if (inner[i + 1] === '"') inStr = !inStr;
      i++;
      continue;
    }
    if (inStr) continue;
    if (c === '[') { if (depth === 0) start = i; depth++; }
    else if (c === ']') {
      depth--;
      if (depth === 0 && start >= 0) { out.push({ start, end: i + 1 }); start = -1; }
      if (depth < 0) depth = 0;
    }
  }
  return out;
}

// Find `edges:[...]` arrays (bracket-inclusive spans) in raw html.
export function findEdgesArrays(html) {
  const out = [];
  const marker = BS + '"edges' + BS + '":[';
  let idx = 0;
  while (true) {
    idx = html.indexOf(marker, idx);
    if (idx < 0) break;
    const open = idx + marker.length - 1; // index of `[`
    const end = matchBracketRaw(html, open);
    if (end > 0) out.push({ start: open, end, marker: html.slice(Math.max(0, idx - 80), idx) });
    idx = open + 1;
  }
  return out;
}

// Raw bracket matcher for push content: skips \X escapes and `\"`-strings.
// `open` must index `[`. Returns index past `]` or -1.
export function matchBracketRaw(html, open) {
  let depth = 0, inStr = false;
  for (let i = open; i < html.length; i++) {
    const c = html[i];
    if (c === BS) {
      if (html[i + 1] === '"') inStr = !inStr;
      i++;
      continue;
    }
    if (inStr) continue;
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}
export function debugRows(html) {
  const delim = 'self.__next_f.push(';
  if (!html.includes(delim)) return [];
  const parts = html.split(delim);
  const joined = parts.slice(1).map((p) => {
    const s = parseSeg(p);
    return s ? s.content : '';
  }).join('');
  return findLenRows(joined).map((r) => ({
    bytes: r.bytes !== undefined ? r.bytes : null,
    payloadStart: r.payloadStart,
    payloadEnd: r.payloadEnd,
    head: joined.slice(Math.max(0, r.hdrLenStart - 24), r.hdrLenStart + 32),
  }));
}
// Validator: counts verified length-prefixed rows across all pushes
// (merging first, like the editor path). `bad` = candidate headers that
// don't verify — normally 0 for self-consistent files.
export function verifyFlight(html) {
  const delim = 'self.__next_f.push(';
  if (!html.includes(delim)) return { rows: 0, bad: 0, merged: false };
  const parts = html.split(delim);
  const segs = [];
  for (let i = 1; i < parts.length; i++) {
    const s = parseSeg(parts[i]);
    if (!s) return { rows: 0, bad: -1, merged: false };
  }
  void segs;
  const joined = parts.slice(1).map((p) => {
    const s = parseSeg(p);
    return s ? s.content : '';
  }).join('');
  const rows = findLenRows(joined);
  // bad: len-tag headers that fail verification
  let bad = 0, pos = 0;
  while (pos < joined.length) {
    const colon = joined.indexOf(':', pos);
    if (colon < 0) break;
    let run = colon - 1;
    while (run >= 0 && isHex(joined[run])) run--;
    run++;
    if (run < colon && TAGSET.has(joined[colon + 1])) {
      let h = colon + 2, hex = '';
      while (h < joined.length && isHex(joined[h])) { hex += joined[h]; h++; }
      if (hex && joined[h] === ',') {
        const end = walkPayload(joined, h + 1, parseInt(hex, 16));
        let okB = end >= 0 && ((joined[end] === BS && joined[end + 1] === 'n') || end >= joined.length);
        if (!okB && end >= 0) {
          let q = end, hd = '';
          while (q < joined.length && isHex(joined[q]) && hd.length < 24) { hd += joined[q]; q++; }
          okB = hd.length > 0 && joined[q] === ':';
        }
        if (!(end >= 0 && okB)) bad++;
        pos = colon + 1;
        continue;
      }
    }
    pos = colon + 1;
  }
  return { rows: rows.length, bad, merged: true };
}
