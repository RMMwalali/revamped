// Server-side application of admin content overrides into HTML.
// ID rows (t-/i-) target baked data-sc-id attributes (see scripts/tag.mjs).
// Anchor rows (el_id starting with 'a') match by exact content + occurrence
// index, so they keep working after React hydration re-renders the tree.
import { pool } from './db.mjs';

const cache = new Map(); // page -> { at, items }
const TTL = 15000;

export async function getOverrides(page) {
  const c = cache.get(page);
  if (c && Date.now() - c.at < TTL) return c.items;
  let items = [];
  try {
    const r = await pool.query(
      'SELECT el_id, kind, value, orig_html, idx, tag FROM content_overrides WHERE page = $1',
      [page]
    );
    items = r.rows;
  } catch {}
  cache.set(page, { at: Date.now(), items });
  return items;
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

const jesc = (s) => JSON.stringify(s).slice(1, -1);

// Patch flight-data occurrence when the original string is unique there,
// so hydration renders the override instead of reverting it.
// Tries entity-decoded and \u-escaped planes: flight often stores markup as
// \u003c-div\u003e and &nbsp; as spaces, while static HTML keeps entities.
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
    for (let i = 1; i < parts.length; i++) parts[i] = parts[i].replace(eo, ev);
    return parts.join('self.__next_f.push(');
  }
  return html;
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

function applyAnchor(html, it) {
  if (it.kind === 'image' || it.kind === 'media') {
    if (it.kind === 'image') {
      const re = new RegExp(`<img\\b[^<>]*src="${escapeRegExp(it.orig_html)}"`, 'gi');
      let m;
      const hits = [];
      while ((m = re.exec(html)) && hits.length <= (it.idx || 0)) hits.push(m);
      const hit = hits[it.idx || 0];
      if (!hit) return html;
      const tagStart = hit.index;
      const tagEnd = html.indexOf('>', tagStart);
      if (tagEnd < 0) return html;
      const tag = (html.slice(tagStart, tagEnd + 1))
        .replace(/\ssrc\s*=\s*"[^"]*"/i, ` src="${it.value}"`)
        .replace(/\ssrcset\s*=\s*"[^"]*"/i, '')
        .replace(/\ssizes\s*=\s*"[^"]*"/i, '');
      return html.slice(0, tagStart) + tag + html.slice(tagEnd + 1);
    }
    // media: swap video/source/poster URLs at the nth exact match of the URL text.
    const esc = escapeRegExp(it.orig_html);
    const re = new RegExp(`((?:src|poster)\\s*=\\s*")${esc}(")`, 'gi');
    let m, hits = 0;
    let out = '';
    let last = 0;
    while ((m = re.exec(html))) {
      if (hits === (it.idx || 0)) {
        out += html.slice(last, m.index + m[1].length) + it.value + m[2];
        last = m.index + m[0].length;
        break;
      }
      hits++;
    }
    let patched = last === 0 ? html : out + html.slice(last);
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
  let prev = html;
  for (const [lead, trail] of pairs) {
    html = html.split(lead + orig + trail).join(lead + value + trail);
  }
  if (html !== prev && isReelSwap) {
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
