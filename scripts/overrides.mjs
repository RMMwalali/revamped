// Server-side application of admin content overrides into HTML.
// ID rows (t-/i-) target baked data-sc-id attributes (see scripts/tag.mjs).
// Anchor rows (el_id starting with 'a') match by exact content + occurrence
// index, so they keep working after React hydration re-renders the tree.
import { readStore, writeStore } from './storage.mjs';
import { safeReplace, safeReplacePushes, safeReplacePairs, parseSeg, decodeFully, encodeJs, verifyFlight } from './flight.mjs';

const cache = new Map(); // page -> { at, items }
const TTL = 15000;

// Text rows have to survive the round trip through the edit bar, and older rows
// were stored in a shape the server can never re-find:
//   - orig_html/value held the element's OUTER html, but the anchor matcher
//     looks for `<TAG ...>orig_html</TAG>` (inner html).
//   - the bar's own editing chrome leaked in: markCandidates tags every
//     candidate with `sc-cand` before an edit starts, and the blur handler
//     leaves `contenteditable="false"` behind.
// Rows still carrying either are rewritten to the inner, chrome-free form on
// read, so previously saved edits start applying without touching the store.
const EDIT_CHROME = /\s(?:contenteditable|spellcheck|draggable)(?:="[^"]*")?/gi;
const OUTER = /^\s*<([a-zA-Z][a-zA-Z0-9-]*)\b[^<>]*>([\s\S]*)<\/\1>\s*$/;
function cleanFragment(s) {
  if (typeof s !== 'string') return s;
  return s
    .replace(EDIT_CHROME, '')
    .replace(/ class="([^"]*)"/g, (m, cls) => {
      const keep = cls.split(/\s+/).filter((c) => c && c !== 'sc-cand' && c !== 'sc-editing');
      return keep.length ? ' class="' + keep.join(' ') + '"' : '';
    })
    // The bar used to record non-breaking spaces, which the served markup
    // never carries - a trailing &nbsp; would keep the row from matching.
    .replace(/&nbsp;|\u00a0/g, ' ');
}
function sanitizeRow(it) {
  if (!it || typeof it !== 'object') return it;
  const row = { ...it };
  if (row.kind === 'text') {
    for (const f of ['orig_html', 'value']) {
      if (typeof row[f] !== 'string') continue;
      let v = cleanFragment(row[f]);
      const m = OUTER.exec(v);
      if (m) v = m[2];
      row[f] = v.trim();
    }
  }
  return row;
}
function sanitizeRows(items) {
  return (Array.isArray(items) ? items : []).map(sanitizeRow);
}

export async function getOverrides(page) {
  const c = cache.get(page);
  if (c && Date.now() - c.at < TTL) return c.items;
  let items = [];
  try {
    const data = await readStore('overrides.json');
    items = sanitizeRows(data?.[page] || []);
  } catch {}
  cache.set(page, { at: Date.now(), items });
  return items;
}

export async function saveOverrides(page, items) {
  const data = await readStore('overrides.json') || {};
  data[page] = sanitizeRows(items).map((it) => ({
    el_id: it.el_id,
    kind: it.kind,
    value: it.value,
    orig_html: it.orig_html,
    idx: it.idx,
    tag: it.tag,
  }));
  await writeStore('overrides.json', data);
  bustOverrides();
}

export function bustOverrides() { cache.clear(); }

// React Flight length-framed text rows (e.g. `39:T22c4,<blob>`): any byte
// change inside the payload kills the stream parser ("Connection closed").
// Mask payloads with placeholders before whole-HTML string ops, restore after.
const TROW = /(\d+):T([0-9a-f]+),/g;
const ROWSTART = /\\n[0-9a-z]{1,3}:(T[0-9a-f]+,|["\[{nI0-9])|"\]\)/;
export function maskT(html) {
  const payloads = [];
  let out = '';
  let last = 0;
  TROW.lastIndex = 0;
  let m;
  while ((m = TROW.exec(html))) {
    const start = m.index + m[0].length;
    const rest = html.slice(start);
    const rel = rest.search(ROWSTART);
    if (rel < 0) continue;
    const end = start + rel;
    out += html.slice(last, start) + '\0T' + payloads.length + '\0';
    payloads.push(html.slice(start, end));
    last = end;
    TROW.lastIndex = end;
  }
  out += html.slice(last);
  return { html: out, restore: (s) => s.replace(/\0T(\d+)\0/g, (_, i) => payloads[Number(i)]) };
}

// Replace inner HTML of the element carrying data-sc-id="id" (balanced tags).
export function replaceElInner(html, id, newInner) {
  const attr = `data-sc-id="${id}"`;
  const idx = html.indexOf(attr);
  if (idx < 0) return html;
  const lt = html.lastIndexOf('<', idx);
  const tagM = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(html.slice(lt, lt + 24));
  if (!tagM) return html;
  const tag = tagM[1];
  const gt = html.indexOf('>', idx);
  if (gt < 0) return html;
  const re = new RegExp(`<(/?)${tag}(?=[\\s>/])`, 'gi');
  re.lastIndex = gt + 1;
  let depth = 1, m, end = -1;
  while ((m = re.exec(html))) {
    if (m[1] === '/') {
      depth--;
      if (depth === 0) { end = m.index; break; }
    } else {
      const e = html.indexOf('>', m.index);
      if (e > 0 && html[e - 1] !== '/') depth++;
    }
    if (re.lastIndex > gt + 200000) break; // sanity cap
  }
  if (end < 0) return html;
  return html.slice(0, gt + 1) + newInner + html.slice(end);
}

export function replaceImgSrc(html, id, src) {
  const re = new RegExp(`<img[^<>]*data-sc-id="${id}"[^<>]*>`, 'i');
  return html.replace(re, (tag) => {
    if (/\ssrc\s*=/i.test(tag)) tag = tag.replace(/\ssrc\s*=\s*"[^"]*"/i, ` src="${src}"`);
    else tag = tag.replace(/<img/i, `<img src="${src}"`);
    return tag.replace(/\ssrcset\s*=\s*"[^"]*"/i, '').replace(/\ssizes\s*=\s*"[^"]*"/i, '');
  });
}

// Swap video/source/poster src across static HTML. id may be "" (anchor rows
// match by URL text below) or a data-sc-id.
export function replaceMediaSrc(html, id, src) {
  const attrVal = (attr) => new RegExp(`(${attr}\\s*=\\s*")([^"]*)(")`, 'i');
  const swapOnce = (out, attr, idAttr) => {
    const re = idAttr
      ? new RegExp(`<(video|source|img)[^<>]*data-sc-id="${idAttr}"[^<>]*>`, 'i')
      : null;
    if (re) {
      return out.replace(re, (tag) => {
        if (new RegExp(`\\s${attr}\\s*=`).test(tag)) {
          tag = tag.replace(attrVal(attr), `$1${src}$3`);
        }
        return tag;
      });
    }
    return out;
  };
  // ID rows: swap in src and poster if present.
  if (id) {
    let out = html;
    out = swapOnce(out, 'src', id);
    out = swapOnce(out, 'poster', id);
    return out;
  }
  // Anchor (ID-free) rows: replace the exact URL text at src/poster positions.
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(`((?:src|poster)\\s*=\\s*")${esc(src)}(")`, 'gi'), `$1${src}$2`);
}

// Text normalization for cross-domain matching. Recorded origins are DOM
// snapshots (ASCII apostrophes, <br class="css-0">, "—or") while flight rows
// keep canonical plain text ("We'll get you started or help you dream bigger.").
// Collapse both sides to a comparable form: drop tags, fold smart quotes and
// dashes, squash whitespace.
function normText(s) {
  return String(s == null ? '' : s)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/–/g, '-')
    .replace(/—/g, ' ')
    .replace(/\u2028/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Normalize decoded flight text the same way, returning an alignment map from
// normalized index back to decoded index (whitespace runs collapse onto their
// first char; tags — absent in decoded text — would be skipped).
function normTextMapped(s) {
  let out = [];
  let map = [];
  let lastWs = false;
  const fold = (c) => c === '’' ? "'" : c === '‘' ? "'" : c === '”' ? '"' : c === '“' ? '"' : c === '–' ? '-' : c === '\u2028' ? ' ' : c;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '—') {
      if (!lastWs) { out.push(' '); map.push(i); lastWs = true; }
      continue;
    }
    const ws = /\s/.test(c);
    if (ws) {
      if (!lastWs) { out.push(' '); map.push(i); lastWs = true; }
      continue;
    }
    out.push(fold(c));
    map.push(i);
    lastWs = false;
  }
  return { s: out.join(''), map };
}

// Decoded merge of all push-string contents (plain JS string domain). This
// build stores flight payloads as escaped JSON text without length-framed
// rows, so row walking finds nothing; decode the contents outright.
function flightDecoded(html) {
  const delim = 'self.__next_f.push(';
  const parts = html.split(delim);
  let out = '';
  for (let i = 1; i < parts.length; i++) {
    const s = parseSeg(parts[i]);
    if (!s) continue;
    out += decodeFully(s.content);
  }
  return out;
}

// Map decoded characters back to raw-slice boundaries inside a push string so
// a decoded-domain replacement can be spliced into the escaped content.
function decodeSpans(content) {
  const spans = [];
  let i = 0;
  while (i < content.length) {
    const r = advSpan(content, i);
    if (!r) break;
    spans.push({ rs: i, re: i + r });
    i += r;
  }
  return spans;
}
function advSpan(s, i) {
  const c = s[i];
  if (c === undefined) return 0;
  if (c !== '\\') { const cp = s.codePointAt(i); return cp > 0xffff ? 2 : 1; }
  const n = s[i + 1];
  if (n === undefined) return 0;
  if (n === '\n') return 2;
  if (n === '\r') return s[i + 2] === '\n' ? 3 : 2;
  if (/^[nrtbfv"]$/.test(n)) return 2;
  if (n === '\\') return 2;
  if (n === 'x' && /^[0-9a-fA-F]{2}/.test(s.slice(i + 2, i + 4))) return 4;
  if (n === 'u') {
    if (/^[0-9a-fA-F]{4}/.test(s.slice(i + 2, i + 6))) return 6;
    if (s[i + 2] === '{') {
      const e = s.indexOf('}', i + 3);
      if (e > 0 && e - (i + 3) <= 6 && /^[0-9a-fA-F]+$/.test(s.slice(i + 3, e))) return e - i + 1;
    }
  }
  return 2;
}

// Splice the canonical text edit into the merged push contents (decoded
// domain), where safeReplacePushes cannot operate because no length-framed
// rows exist. Requires an exactly-once decoded match to avoid retitling
// sibling nodes; value is re-encoded so quotes/newlines never break the
// enclosing JS string.
function patchCanonicalFlight(html, decoded, nOrig, value) {
  const { s: nDec, map } = normTextMapped(decoded);
  let at = -1, count = 0, from = 0;
  while ((from = nDec.indexOf(nOrig, from)) >= 0) {
    count++;
    if (at < 0) at = from;
    from += nOrig.length;
  }
  if (count !== 1 || at + nOrig.length > map.length) return html;
  const rs = map[at];
  const re = map[at + nOrig.length - 1];
  const seg = decoded.slice(rs, re + 1);
  if (!seg || /<[^>]+>/.test(seg)) return html;
  const delim = 'self.__next_f.push(';
  const parts = html.split(delim);
  const segs = [];
  for (let i = 1; i < parts.length; i++) segs.push(parseSeg(parts[i]));
  if (segs.some((s) => !s)) return html;
  const joined = segs.map((s) => s.content).join('');
  const spans = decodeSpans(joined);
  if (rs + seg.length > spans.length) return html;
  const rawStart = spans[rs].rs;
  const rawEnd = spans[rs + seg.length - 1].re;
  const newJoined = joined.slice(0, rawStart) + encodeJs(value) + joined.slice(rawEnd);
  // Re-emit merged pushes exactly like the editor path: first push carries the
  // content, the rest are emptied (order preserved, so the client stream is
  // unchanged).
  let out = parts[0];
  for (let k = 0; k < segs.length; k++) {
    const content = k === 0 ? newJoined : '';
    out += delim + segs[k].prefix + content + segs[k].suffix;
  }
  return out;
}

const jesc = (s) => JSON.stringify(s).slice(1, -1);

// Patch flight-data occurrence when the original string is unique there, so
// hydration renders the override instead of reverting it. Tries entity-decoded
// and \u-escaped planes: flight often stores markup as \u003c-div\u003e and
// &nbsp; as spaces, while static HTML keeps entities.
// Only a SINGLE occurrence is patched (and only when exactly one exists):
// shared labels (nav items, card titles, footer links) live in N flight nodes,
// and a blanket replace of all of them would retitle unrelated elements (the
// header/footer menu, sibling cards). Multi-node edits are covered after
// hydration by the injected text guard (textOverrideScript), which re-matches
// by element tag + exact content + index — the same targeting the edit bar
// used when the edit was recorded.
function patchFlight(html, orig, value) {
  if (process.env.SC_NOFLIGHTPATCH) return html;
  if (!orig || orig === value) return html;
  const parts = html.split('self.__next_f.push(');
  if (parts.length < 2) return html;
  const dec = (s) => s.split('&nbsp;').join(' ').split('&amp;').join('&').split('&#39;').join("'").split('&quot;').join('"');
  const escU = (s) => s.split('<').join('\\u003c').split('>').join('\\u003e').split('&').join('\\u0026');
  const cands = [];
  for (const o of (dec(orig) === orig ? [orig] : [orig, dec(orig)])) {
    cands.push([jesc(o), jesc(o === orig ? value : value)]);
    cands.push([jesc(escU(o)), jesc(escU(o === orig ? value : value))]);
  }
  for (const [eo, ev] of cands) {
    if (!eo || eo.length < 4 || eo === ev) continue;
    let count = 0;
    for (let i = 1; i < parts.length; i++) {
      let j = parts[i].indexOf('])');
      const seg = j >= 0 ? parts[i].slice(0, j) : parts[i];
      let k = seg.indexOf(eo);
      while (k >= 0) { count++; k = seg.indexOf(eo, k + 1); }
    }
    if (count !== 1) continue;
    // Length-synced single swap: safe inside length-prefixed rows, and
    // static HTML is untouched (the idx-th static occurrence is handled by
    // applyAnchor/replaceElInner, which must keep the other copies intact).
    return safeReplacePushes(html, eo, ev);
  }
  // Canonical pass: bridge the recorded DOM snapshot to the canonical flight
  // text by normalization. Only plain values are patched here — a JSX text
  // node cannot render raw tags (multi-line HTML is re-asserted after
  // hydration by the injected text guard). The canonical text must occur once
  // in the decoded payload, or a blanket rewrite would touch sibling nodes
  // (shared labels go through the client guard instead).
  if (!/<[^>]+>/.test(value)) {
    const v = String(value);
    const nOrig = normText(orig);
    const nVal = normText(v);
    if (nOrig.length >= 8 && nVal.length >= 1 && nOrig !== nVal) {
      const decoded = flightDecoded(html);
      return patchCanonicalFlight(html, decoded, nOrig, v);
    }
  }
  return html;
}

// Image overrides cannot be won in the served markup alone. The bundle rebuilds
// image srcs on the client - the hydrated value ("/upload/hero.svg") does not
// appear anywhere in the HTML we send - so React overwrites whatever we patch.
// Text survives because it is patched into the flight payload React renders
// from; image URLs are not carried there. So the swap is also applied after
// hydration, for every visitor and not just the admin whose edit bar happened
// to re-apply it client-side. Reruns while the page settles, like the other
// post-hydration guards in this codebase.
export function imageOverrideScript(items) {
  const pairs = [];
  const seen = new Set();
  for (const it of items || []) {
    if (it.kind !== 'image' || !it.orig_html || !it.value) continue;
    for (const orig of imgOrigCandidates(it.orig_html)) {
      for (const cand of imgSrcCandidates(orig)) {
        // A candidate equal to the new value is a no-op: the logo rows expand to
        // dozens of these, and shipping them just pads the page.
        if (!cand || cand === it.value || seen.has(cand)) continue;
        seen.add(cand);
        pairs.push([cand, it.value]);
      }
    }
  }
  if (!pairs.length) return '';
  const data = JSON.stringify(pairs).replace(/<\/script/gi, '<\\/script');
  return '<script>(function(){var P=' + data + ';'
    + 'function swap(){for(var i=0;i<P.length;i++){'
    + 'var from=P[i][0],to=P[i][1];'
    // encodeAssetSpaces runs after this script is injected and rewrites
    // spaces on both sides of a pair, so some pairs arrive here identical.
    + 'if(!from||from===to)continue;'
    + 'var els=document.querySelectorAll(\'img[src="\'+from+\'"]\');'
    + 'for(var j=0;j<els.length;j++){var el=els[j];'
    // Re-setting an unchanged src would feed the observer below forever.
    + 'if(el.getAttribute("src")===to)continue;'
    + 'el.setAttribute("src",to);el.removeAttribute("srcset");el.removeAttribute("sizes");}}}'
    + 'function run(){try{swap();}catch(e){}}'
    + 'if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",run);}else{run();}'
    // Hydration rebuilds image nodes from the flight payload, so re-assert on
    // every DOM change the way the text guard does - timers alone lose the
    // race whenever React re-renders late.
    + 'try{new MutationObserver(function(){run();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["src"]});}catch(e){}'
    + '[200,600,1200,2500,4000,6000,9000,14000].forEach(function(t){setTimeout(run,t);});'
    + '})();<\/script>';
}

// Text overrides cannot always be won in the served markup alone:
// - patchFlight (above) handles plain-text edits whose canonical form appears
//   once in the flight payload, so hydration renders the new value.
// - Shared labels (nav, card titles) appear in N flight nodes; a blanket
//   replace would retitle siblings. Multi-line values and animated-copy edits
//   can't live in a JSX text node verbatim. For all of those, ship a
//   post-hydration guard that re-asserts the recorded orig -> value by element
//   tag + normalized text + occurrence index (the same targeting the edit bar
//   used when the edit was recorded). Matching normalizes both sides (fold
//   smart quotes/dashes, drop <br> and wrapper tags, squash whitespace) so a
//   DOM-recorded orig still lands on the hydrated canonical text.
// Animation-wrapper captures (line-mask/fix-clip markup with live transform
// styles) are excluded: they would replace a heading's chrome, not its words.
export function textOverrideScript(items) {
  const jobs = [];
  const tags = 'P H1 H2 H3 H4 H5 H6 LI A SPAN BUTTON BLOCKQUOTE FIGCAPTION DT DD TD TH LABEL';
  const GRIME = /line-mask|fix-mask|fix-clip|will-change|translate3d|translate\(|animation:|--rX|--rY|css-3w1c3c|css-1lpdf6v/i;
  for (const it of items || []) {
    if (it.kind !== 'text' || !it.orig_html || !it.value || it.value === it.orig_html) continue;
    const o = String(it.orig_html);
    const v = String(it.value);
    if (o.length < 4 || o.length > 600) continue;
    if (v.length < 1 || v.length > 4000) continue;
    if (GRIME.test(o) || GRIME.test(v)) continue;      // animated chrome, not text
    if (/^<br\s*\/?\s*>$/i.test(v.trim())) continue;   // "clear this line" noise
    if (tags.indexOf(' ' + (it.tag || '').toUpperCase()) < 0) continue;
    jobs.push({ o, v, t: (it.tag || 'P').toUpperCase(), i: it.idx || 0 });
  }
  if (!jobs.length) return '';
  const data = JSON.stringify(jobs).replace(/<\/script/gi, '<\\/script');
  return '<script>(function(){var O=' + data + ';'
    + 'var N=function(s){return (""+(s==null?"":s)).'
    + 'replace(/<br\\s*\\/?>/gi," ").replace(/<[^>]*>/g," ").replace(/\u00a0/g," ")'
    + '.replace(/[\u2018\u2019]/g,"\u0027").replace(/[\u201c\u201d]/g,"\'")'
    + '.replace(/\u2013/g,"-").replace(/\u2014/g," ").replace(/\s+/g," ").trim();};'
    + 'function peers(tag,orig){var nn=N(orig),list=document.getElementsByTagName(tag),out=[];'
    + 'for(var j=0;j<list.length;j++){var e=list[j];'
    + 'if(e.closest&&e.closest(\'#sc-bar,#sc-brand-panel\'))continue;'
    + 'if(N(e.textContent)===nn)out.push(e);}return out;}'
    + 'function swap(){for(var i=0;i<O.length;i++){var o=O[i];'
    + 'var ps=peers(o.t,o.o),el=ps[o.i]||ps[0];'
    + 'if(el)setText(el,o.v);}}'
    // A rename recorded against a plain-text element (a client name in the
    // partners wall) matches, by normalized text, the SAME word somewhere it
    // is animated copy: the carousel's leader lines, whose <span> carries the
    // inline transform GSAP slides and clips. Writing innerHTML there deleted
    // that span, so the line could never be offset again and stayed painted on
    // top of whichever slide was animating. When the value lives in a single
    // text node, rewrite the node and leave every wrapper (and its transform)
    // alone; multi-node values still fall back to innerHTML, as before.
    + 'function setText(el,v){if(el.innerHTML===v)return;'
    + 'if(v.indexOf("<")<0&&document.createTreeWalker){'
    + 'var w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null),n,nodes=[];'
    + 'while((n=w.nextNode()))nodes.push(n);'
    + 'if(nodes.length===1){if(nodes[0].data!==v)nodes[0].data=v;return;}}'
    + 'el.innerHTML=v;}'
    + 'function run(){try{swap();}catch(e){}}'
    + 'if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",run);}else{run();}'
    + 'try{new MutationObserver(function(){run();}).observe(document.body,{childList:true,subtree:true});}catch(e){}'
    + '[200,600,1200,2500,4000,6000,9000,14000].forEach(function(t){setTimeout(run,t);});'
    + '})();<\/script>';
}

// Asset URLs (images, video src/poster) live in the flight payload too, as
// "sourceUrl":"…", and hydration re-renders those nodes from it. A swap that
// only rewrites the served markup is therefore undone the moment React takes
// over: the admin still saw the new asset (their edit bar keeps re-applying
// it) while every visitor got the old one back. Patch the push strings as
// well so React itself renders the new asset from the first paint - every
// recorded spelling is replaced, which is exactly the swap the client guard
// below already performs after hydration.
function patchAssetFlight(html, it) {
  if (!it.orig_html || !it.value || it.value === it.orig_html) return html;
  for (const cand of imgOrigCandidates(it.orig_html)) {
    if (!cand || cand === it.value) continue;
    html = safeReplacePushes(html, cand, it.value);
  }
  return html;
}

// Same swap, re-applied after the built-in content fixes have run. Those
// fixes (highlight images, CMS cards, flight patches) rewrite both the markup
// and the very push strings the swap targets, so an early pass gets silently
// reverted: hydration re-renders the original asset and the served HTML goes
// back to the stock file. Admin edits win - they are applied last.
// Saved rows applied LAST, after every built-in content fix.
//
// The page is largely re-derived on each request: nav renames, service cards,
// highlights, CMS passes and the file-content flight swaps all rewrite copy
// from constants baked into the code. Anything an admin saves used to be
// applied early and then overwritten by those passes, so a saved edit survived
// only until the next deploy re-ran the pipeline - which is exactly when it
// appeared to "revert". Re-applying the stored rows here makes the database the
// last word: whatever the generators produced, the saved value wins.
export function applyTextOverrides(html, items) {
  for (const it of items || []) {
    if (it.kind !== 'text' || !it.value) continue;
    // Pinned id first: it survives a built-in pass rewriting the same copy,
    // which is what would otherwise orphan a text-matched row.
    if (it.pinned_id) html = replaceElInner(html, it.pinned_id, it.value);
    else if (it.el_id && it.el_id.charAt(0) !== 'a') html = replaceElInner(html, it.el_id, it.value);
    else if (it.orig_html) html = applyAnchor(html, it);
  }
  return html;
}

export function applyAssetOverrides(html, items) {
  for (const it of items || []) {
    if (it.kind !== 'image' && it.kind !== 'media') continue;
    const anchored = it.kind === 'image' && !!it.orig_html && imgAnchored(html, it.orig_html);
    if (it.orig_html) html = applyAnchor(html, it);
    // One URL for another in the same payload slot: the row structure cannot
    // change, so this stays safe on the legal pages too (they skip the text
    // flight patches, where multi-line values really can break the parser).
    // The verifier is the belt to that braces - never ship a worse payload.
    const before = flightBad(html);
    const next = patchAssetFlight(html, it);
    if (next !== html && flightBad(next) > before) continue;
    html = next;
    // No <img> carries this URL: it is a CSS background image, living only in
    // baked <style> rules and the flight "sourceUrl" strings, none of which
    // the passes above reach. A full asset path is a safe token to replace
    // document-wide - static markup and every push, length-synced; anchored
    // rows keep their targeted rewrite so a same-asset <img> next to a
    // background is never swapped as a side effect.
    if (it.kind === 'image' && !anchored && it.orig_html && it.value && it.value !== it.orig_html) {
      for (const cand of imgOrigCandidates(it.orig_html)) {
        if (!cand || cand === it.value || !html.includes(cand)) continue;
        const rep = safeReplace(html, cand, it.value);
        if (rep === html) continue;
        if (flightBad(rep) > before) continue;
        html = rep;
      }
    }
  }
  return html;
}
function flightBad(html) {
  try { return verifyFlight(html).bad; } catch { return 0; }
}

export function applyOverrides(html, items, opts) {
  const noFP = !!(opts && opts.noFlightPatch);
  for (const it of items) {
    if (it.el_id && it.el_id.charAt(0) === 'a' && it.orig_html) {
      html = applyAnchor(html, it);
      if ((it.kind === 'text' || it.kind === 'media') && !noFP) html = patchFlight(html, it.orig_html, it.value);
      continue;
    }
    if (it.kind === 'text') {
      html = replaceElInner(html, it.el_id, it.value);
      if (!noFP) html = patchFlight(html, it.orig_html, it.value);
    } else if (it.kind === 'image') {
      html = replaceImgSrc(html, it.el_id, it.value);
    } else if (it.kind === 'media') {
      html = replaceMediaSrc(html, it.el_id, it.value);
      if (!noFP) html = patchFlight(html, it.orig_html, it.value);
    }
  }
  const imgScript = imageOverrideScript(items);
  if (imgScript) html = html.replace(/<\/body>/i, imgScript + '$&');
  const textScript = textOverrideScript(items);
  if (textScript) html = html.replace(/<\/body>/i, textScript + '$&');
  return html;
}

// Replace the idx-th exact occurrence of orig content (anchor rows).
function replaceNth(html, needle, n, replacement) {
  if (!needle) return html;
  let idx = -1, from = 0;
  for (let k = 0; k <= (n || 0); k++) {
    idx = html.indexOf(needle, from);
    if (idx < 0) return html;
    from = idx + needle.length;
  }
  return html.slice(0, idx) + replacement + html.slice(idx + needle.length);
}

// Root-relative assets are served both at their own path and mirrored under
// /assets/root; /assets/* paths are already absolute for this build.
function imgSrcCandidates(src) {
  const out = [src];
  if (src && src.charAt(0) === '/' && !src.startsWith('/assets/')) out.push('/assets/root' + src);
  if (src && src.startsWith('/assets/root/')) out.push(src.slice('/assets/root'.length));
  return out;
}

// Recorded image/media origs may use the Next optimizer spelling
// ("/_next/image?url=<enc>&w=..") while served markup carries the mapped
// direct file (rewriteAssets). Normalize to the direct form so older edits
// keep matching current markup, in served HTML and in the post-hydration guard.
function directImgSrc(src) {
  const m = /\/_next\/image\?url=([^&\s"'<>]+)/.exec(String(src || ''));
  if (!m) return null;
  let dec;
  try { dec = decodeURIComponent(m[1]); } catch { return null; }
  if (dec.startsWith('https://cms.iventions.com/')) {
    return '/assets/cms/' + dec.replace('https://cms.iventions.com/', '');
  }
  if (dec.startsWith('/')) return dec;
  return null;
}

function imgOrigCandidates(orig) {
  const out = [];
  const push = (s) => { if (s && !out.includes(s)) out.push(s); };
  push(orig);
  const direct = directImgSrc(orig);
  if (direct) {
    push(direct);
    if (direct.includes(' ')) push(direct.split(' ').join('%20'));
  }
  for (const base of [...out]) {
    if (base.charAt(0) === '/' && !base.startsWith('/assets/')) push('/assets/root' + base);
    if (base.startsWith('/assets/root/')) push(base.slice('/assets/root'.length));
  }
  return out;
}

// True when the recorded URL is carried by an <img src> in the markup. Rows
// that are not are CSS background images: no img anchor exists for
// applyAnchor, and the push-only flight swap cannot reach the baked <style>
// rule, so the caller must fall back to a document-wide replace.
function imgAnchored(html, orig) {
  for (const cand of imgOrigCandidates(orig)) {
    for (const sp of imgSrcCandidates(cand)) {
      if (sp && html.indexOf('src="' + sp + '"') >= 0) return true;
    }
  }
  return false;
}

function applyAnchor(html, it) {
  if (it.kind === 'image' || it.kind === 'media') {
    if (it.kind === 'image') {
      // The edit bar records the src it sees in the hydrated DOM, e.g.
      // "/upload/hero.svg", but the served markup mirrors root-relative assets
      // under /assets/root ("/assets/root/upload/hero.svg"). Matching only the
      // recorded spelling found nothing, so image edits saved fine, showed for
      // the logged-in admin (the bar re-applies them client-side) and never
      // reached an anonymous visitor. Try every known spelling, including the
      // pre-rewrite optimizer URL ("/_next/image?url=...") recorded by older DOMs.
      let hit = null;
      let everyHit = null;
      for (const cand of imgOrigCandidates(it.orig_html)) {
        for (const spelling of imgSrcCandidates(cand)) {
          const re = new RegExp(`<img\\b[^<>]*src="${escapeRegExp(spelling)}"`, 'gi');
          let m;
          const hits = [];
          while ((m = re.exec(html)) && hits.length < 200) hits.push(m);
          hit = hits[it.idx || 0] || null;
          // The recorded index is a position in the hydrated DOM, which holds
          // more nodes of the same image than the served markup (responsive
          // placeholders, cloned slides). When that position is gone, patch
          // every match instead of dropping the edit: this is the same swap
          // the post-hydration guard performs, and it keeps the served HTML
          // correct for visitors with JavaScript disabled.
          if (!hit) everyHit = hits.length ? hits : null;
          if (hit || everyHit) break;
        }
        if (hit || everyHit) break;
      }
      const swapTag = (h) => {
        const tagStart = h.index;
        const tagEnd = html.indexOf('>', tagStart);
        if (tagEnd < 0) return null;
        return (html.slice(tagStart, tagEnd + 1))
          .replace(/\ssrc\s*=\s*"[^"]*"/i, ` src="${it.value}"`)
          .replace(/\ssrcset\s*=\s*"[^"]*"/i, '')
          .replace(/\ssizes\s*=\s*"[^"]*"/i, '');
      };
      if (hit) {
        const tag = swapTag(hit);
        if (!tag) return html;
        return html.slice(0, hit.index) + tag + html.slice(html.indexOf('>', hit.index) + 1);
      }
      if (everyHit) {
        let out = '';
        let last = 0;
        for (const h of everyHit) {
          const tag = swapTag(h);
          if (!tag) continue;
          out += html.slice(last, h.index) + tag;
          last = html.indexOf('>', h.index) + 1;
        }
        return out ? out + html.slice(last) : html;
      }
      return html;
    }
    // media: swap video/source/poster URLs at the nth exact match of the URL text
    // (trying every known spelling of a recorded optimizer URL first).
    let patched = html;
    for (const cand of imgOrigCandidates(it.orig_html)) {
      const esc = escapeRegExp(cand);
      const re = new RegExp(`((?:src|poster)\\s*=\\s*")${esc}(")`, 'gi');
      let m, hits = 0;
      let out = '';
      let last = 0;
      while ((m = re.exec(patched))) {
        if (hits === (it.idx || 0)) {
          out += patched.slice(last, m.index + m[1].length) + it.value + m[2];
          last = m.index + m[0].length;
          break;
        }
        hits++;
      }
      if (last !== 0) { patched = out + patched.slice(last); break; }
    }
    return patchReelPairs(patched, it.orig_html, it.value);
  }
  // text: match the full element so substring occurrences (titles, metas) can't collide
  const tag = /^(P|H1|H2|H3|H4|H5|H6|LI|A|SPAN|BUTTON|BLOCKQUOTE|FIGCAPTION|DT|DD|TD|TH|LABEL)$/i.test(it.tag || '')
    ? it.tag.toLowerCase() : '[a-zA-Z][a-zA-Z0-9]*';
  const re = new RegExp(`<${tag}\\b[^<>]*>${escapeRegExp(it.orig_html)}</${tag}>`, 'gi');
  let m;
  const hits = [];
  while ((m = re.exec(html)) && hits.length <= (it.idx || 0)) hits.push(m);
  const hit = hits[it.idx || 0];
  if (!hit) return html;
  // Pin the element's stable id while its text still matches, so the late pass
  // can re-apply the row by id even after a later pass rewrites that copy.
  const open = hit[0].slice(0, hit[0].indexOf('>') + 1);
  const idm = /\sdata-sc-id="([^"]*)"/.exec(open);
  if (idm) it.pinned_id = idm[1];
  const absStart = hit.index + hit[0].indexOf('>') + 1;
  return html.slice(0, absStart) + it.value + html.slice(absStart + it.orig_html.length);
}

function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Client-rendered hero videos keep their source in Next.js flight payloads as
// "reelUrl"/"reelMobileUrl"/"reelPosterUrl" (with JSON-escaped quotes), not as
// <video src=/poster=…>. When an admin swaps one of those, patch every quoted
// form of the URL so the change survives hydration for all visitors, and point
// the mobile rendition at the same new file so desktop + mobile always match.
function patchReelPairs(html, orig, value) {
  if (!orig || orig === value) return html;
  const pairs = [
    ['\\"reelUrl\\":\\"', '\\"'],
    ['\\"reelMobileUrl\\":\\"', '\\"'],
    ['\\"reelPosterUrl\\":\\"', '\\"'],
    ['"reelUrl":"', '"'],
    ['"reelMobileUrl":"', '"'],
    ['"reelPosterUrl":"', '"'],
  ];
  const isReelSwap = ['\\"reelUrl\\":\\"' + orig + '\\"', '"reelUrl":"' + orig + '"']
    .some((nd) => html.includes(nd));
  const P = pairs.map(([lead, trail]) => [lead + orig + trail, lead + value + trail]);
  html = safeReplacePairs(html, P);
  if (isReelSwap) {
    // Keep the mobile rendition in sync: point it at the new file too so
    // desktop (reelUrl) and mobile (reelMobileUrl) never show split footage.
    const marker = '\\"reelMobileUrl\\":\\"';
    const n = html.indexOf(marker);
    if (n >= 0) {
      const end = html.indexOf('\\"', n + marker.length);
      if (end > n + marker.length) {
        const cur = html.slice(n + marker.length, end);
        if (cur !== value) html = html.slice(0, n + marker.length) + value + html.slice(end);
      }
    }
  }
  return html;
}
