// StillCraft structured mini-CMS (Insider dashboard sections).
// The inline edit bar handles single text/image nodes, but structured lists
// (highlight cards, logo wall, stats, testimonials, cities, long-form
// articles) render from Next.js flight payloads where one-click edits
// can't survive hydration. This module extracts those lists live from the
// HTML being served and swaps in admin-approved values from the store.
//
// Model: JSON keyed by section name (stored in Vercel Blob or local fs).
// Empty/missing values are always a no-op (live content is kept).
import { readStore, writeStore } from './storage.mjs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { LOGO_ROWS } from './stillcraft-logos.mjs';
import { NAMES as LOGO_NAMES } from './stillcraft-names.mjs';
import { safeReplace, safeReplaceVerified, boundedSplitJoin, findEdgesArrays, splitTopObjects, splitTopArrays, matchBracketRaw, verifyFlight } from './flight.mjs';

export const CMS_SECTIONS = ['hero', 'highlights', 'logos', 'stats', 'testimonials', 'cities', 'articles', 'insights', 'team', 'projects'];

// ---------- raw-byte helpers (no backslash-literal escaping traps) ----------
const BS = String.fromCharCode(92); // a single backslash char
const EBS = BS + BS; // regex-source for "one literal backslash" (for [^...] classes)
const FQ = BS + '"'; // the 2-char flight quote sequence \" as it sits in raw HTML (plain string ops)
const RFQ = EBS + '"'; // same 2-char sequence as REGEX source (matches one literal backslash + quote)
// opener for a flight key: \"key\":\" — plain (indexOf/split/swap) vs regex flavors
const fkey = (k) => RFQ + k + RFQ + ':' + RFQ;
const pfkey = (k) => FQ + k + FQ + ':' + FQ;
// key opener WITHOUT trailing quote (numeric / null values): \"key\":
const ropen = (k) => RFQ + k + RFQ + ':';
// terminator lookahead: a closing \" that is actually followed by structure,
// not an escaped quote inside the value (greedy FVAL would otherwise eat it)
const TERM = '(?=[,}\\]])';
// escape-aware inner for a flight string value (handles \" and \uXXXX inside).
// LAZY so the match stops at the first real terminator (see TERM below).
const FVAL = '(?:' + EBS + '.|[^' + EBS + '])*?';
const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Encode a plain value the way the CMS flight payload does (single-backslash plane).
export function flightEnc(s) {
  return String(s).split(BS).join(BS + BS).split('"').join(BS + '"')
    .split('<').join(BS + 'u003c').split('>').join(BS + 'u003e').split('&').join(BS + 'u0026')
    .split('\r').join(BS + 'r').split('\n').join(BS + 'n');
}
// Row-safe encoding for UNFRAMED flight rows (plain JSON, no byte lengths).
// Push strings are JS-decoded before React splits rows and JSON-parses them,
// so row-structural chars must survive both decodes: " \ newline tab and
// backslash arrive double-escaped (\\\" \\\\ \\n \\t), while & < > stay
// single-escaped (\u0026 — matching pristine bytes, and valid at both
// levels). Single-escaped \" or \n would close the JSON string early or
// split the row mid-value ("Expected ',' or '}'", "Unterminated string").
export function flightEncRow(s) {
  const e = flightEnc(s);
  let out = '', i = 0;
  while (i < e.length) {
    if (e[i] === BS && i + 1 < e.length) {
      const n = e[i + 1];
      if (n === '"') {
        // A content quote must survive TWO decodes (JS string, then JSON):
        // L0 \\\" -> L1 \" -> L2 ". Two backslashes would end the JS string.
        out += BS + BS + BS + n;
        i += 2;
        continue;
      }
      if (n === 'n' || n === 'r' || n === 't' || n === 'b' || n === 'f') {
        out += BS + BS + n;
        i += 2;
        continue;
      }
      if (n === BS) {
        out += BS + BS + BS + BS;
        i += 2;
        continue;
      }
    }
    out += e[i];
    i++;
  }
  return out;
}
function swapAll(html, oldV, newV) {
  if (!oldV || newV == null || String(newV) === '' || String(oldV) === String(newV)) return html;
  return safeReplace(html, oldV, String(newV), true);
}
const SCRIPT_BLOCK = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
// Bounded verbatim replace in non-script regions only (static HTML text and
// attributes). Script contents — flight pushes, JSON data blocks, inline
// code — are never touched raw, so admin quotes/newlines/backslashes cannot
// break JS string syntax ("Invalid or unexpected token" blank pages).
// Token-bounding also keeps short labels from rewriting asset URLs.
function replaceOutsideScripts(html, from, to) {
  if (!from || from === to) return html;
  SCRIPT_BLOCK.lastIndex = 0;
  let out = '', last = 0, m;
  while ((m = SCRIPT_BLOCK.exec(html))) {
    out += boundedSplitJoin(html.slice(last, m.index), from, to);
    out += m[0];
    last = m.index + m[0].length;
  }
  out += boundedSplitJoin(html.slice(last), from, to);
  return out;
}
// Swap a plain-text value: static HTML gets the raw text (outside scripts),
// unframed flight rows get the row-safe encoding, and verified
// (length-framed) rows get the decoded-domain swap (re-encoded on write).
// Row-safe encoding matters: push strings are JS-decoded before React splits
// rows and JSON-parses them, so a value containing " or a real newline must
// arrive double-escaped in raw bytes — single-escaped \" would either close
// the JSON string early or split the row mid-value ("Expected ',' or '}'",
// "Unterminated string" Application errors). Token-bounding keeps short
// labels from rewriting asset URLs that merely contain them.
function swapText(html, oldV, newV) {
  if (!oldV || newV == null || String(newV) === '' || String(oldV) === String(newV)) return html;
  const o = String(oldV), n = String(newV);
  html = replaceOutsideScripts(html, o, n);
  const eo = flightEncRow(o), ev = flightEncRow(n);
  html = safeReplace(html, eo, ev, true);
  html = safeReplaceVerified(html, o, n);
  return html;
}
// Swap an asset URL: raw (static) + backslash-escaped-slash flight variant +
// fully flight-encoded form (& -> \u0026 inside optimizer URLs).
function swapUrl(html, oldV, newV) {
  if (!oldV || newV == null || String(newV) === '' || String(oldV) === String(newV)) return html;
  const o = String(oldV), n = String(newV);
  html = replaceOutsideScripts(html, o, n);
  html = safeReplace(html, o, n, true);
  const oe = o.split('/').join(BS + '/'), ne = n.split('/').join(BS + '/');
  if (oe !== o) html = safeReplace(html, oe, ne, true);
  const fo = flightEnc(o), fn = flightEnc(n);
  if (fo !== o && fo !== oe) html = safeReplace(html, fo, fn, true);
  return html;
}
// Escape-aware bracket matcher: finds the [...] or {...} block starting at idx
// (idx points at the opening bracket). Skips \X escapes. Returns [start, end).
function matchBracket(html, idx) {
  const open = html[idx], close = open === '[' ? ']' : '}';
  let depth = 0;
  for (let k = idx; k < html.length; k++) {
    const c = html[k];
    if (c === BS) { k++; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return [idx, k + 1]; }
  }
  return null;
}
function arrayRegion(html, marker) {
  const i = html.indexOf(marker);
  if (i < 0) return null;
  const b = html.indexOf('[', i);
  if (b < 0 || b - i > marker.length + 40) return null;
  const m = matchBracket(html, b);
  if (!m) return null;
  return { start: m[0], end: m[1], text: html.slice(m[0], m[1]) };
}
function objectRegion(html, marker) {
  const i = html.indexOf(marker);
  if (i < 0) return null;
  const b = html.indexOf('{', i);
  if (b < 0 || b - i > marker.length + 40) return null;
  const m = matchBracket(html, b);
  if (!m) return null;
  return { start: m[0], end: m[1], text: html.slice(m[0], m[1]) };
}
function decodeFlight(s) {
  // Single-pass unescape (order matters: \\ pairs before \r \n \" \uXXXX).
  const str = String(s);
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c !== BS) { out += c; continue; }
    const n = str[i + 1];
    if (n === 'n') { out += '\n'; i++; }
    else if (n === 'r') { out += '\r'; i++; }
    else if (n === 't') { out += '\t'; i++; }
    else if (n === '"') { out += '"'; i++; }
    else if (n === BS) { out += BS; i++; }
    else if (n === 'u' && /^[0-9a-fA-F]{4}/.test(str.slice(i + 2, i + 6))) { out += String.fromCharCode(parseInt(str.slice(i + 2, i + 6), 16)); i += 5; }
    else { out += c; }
  }
  return out;
}
// Decode repeatedly until stable (CMS HTML can be double/triple-escaped:
// tags pre-escaped as \uXXXX text, then JSON-escaped by flight).
function plainDecode(raw) {
  let s = String(raw), prev = '', guard = 0;
  while (s !== prev && guard < 4) { prev = s; s = decodeFlight(s); guard++; }
  return s;
}
// Capture the raw (still flight-escaped) value of `key` inside snippet e.
function rawVal(e, key) {
  const m = new RegExp(fkey(key) + '(' + FVAL + ')' + RFQ + TERM).exec(e);
  return m ? m[1] : '';
}
// First plain (non-URL, non-escaped) match for simple keys like slug/participants.
function simpleVal(e, key) {
  const m = new RegExp(fkey(key) + '([^' + EBS + ']+)' + RFQ).exec(e);
  return m ? m[1] : '';
}

// ---------- store access (15s cache, same pattern as overrides) ----------
let cmsCache = null, cmsAt = 0;
export function bustCMS() { cmsCache = null; cmsAt = 0; }
const CMS_DEFAULTS = { hero: {}, highlights: {}, logos: {}, stats: {}, testimonials: {}, cities: {}, articles: {} };
export async function getCMS() {
  if (cmsCache && Date.now() - cmsAt < 15000) return cmsCache;
  const out = JSON.parse(JSON.stringify(CMS_DEFAULTS));
  try {
    const data = await readStore('cms.json');
    if (data) {
      for (const [section, sd] of Object.entries(data)) {
        if (sd && typeof sd === 'object') out[section] = { ...(out[section] || {}), ...sd };
      }
    }
  } catch {}
  cmsCache = out; cmsAt = Date.now();
  return out;
}
export async function saveCMSSection(section, data) {
  if (!CMS_SECTIONS.includes(section)) throw new Error('unknown section');
  if (!data || typeof data !== 'object') throw new Error('bad data');
  const all = await readStore('cms.json') || {};
  all[section] = JSON.parse(JSON.stringify(data));
  await writeStore('cms.json', all);
  bustCMS();
}

// ---------- live extractors (current values straight from served HTML) ----------
export function extractHero(html) {
  let label = '', description = '';
  const hb = objectRegion(html, FQ + 'heroBlock' + FQ);
  if (hb) {
    label = decodeFlight(rawVal(hb.text, 'label'));
    description = decodeFlight(rawVal(hb.text, 'description'));
  }
  return { label, description };
}
export function extractHighlights(html) {
  const reg = arrayRegion(html, FQ + 'prominents' + FQ);
  if (!reg) return [];
  const nodeOpen = FQ + 'node' + FQ + ':{' + FQ + 'databaseId' + FQ;
  const edges = reg.text.split(nodeOpen).slice(1);
  return edges.map((e) => {
    const title = decodeFlight(rawVal(e, 'title'));
    // CMS HTML content is double-escaped in flight (tags pre-escaped, then JSON-escaped).
    const excerptFlight = decodeFlight(rawVal(e, 'content'));
    const excerpt = plainDecode(rawVal(e, 'content')).replace(/<[^<>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const image = simpleVal(e, 'sourceUrl');
    const slug = simpleVal(e, 'slug');
    const location = decodeFlight(rawVal(e, 'location'));
    const category = (() => {
      const m = new RegExp('projectCategories' + RFQ + ':\\{' + RFQ + 'edges' + RFQ + ':\\[\\{' + RFQ + 'node' + RFQ + ':\\{' + RFQ + 'name' + RFQ + ':' + RFQ + '(' + FVAL + ')' + RFQ).exec(e);
      return m ? decodeFlight(m[1]) : '';
    })();
    const eventType = (() => {
      const m = new RegExp('eventType' + RFQ + ':\\{' + RFQ + 'edges' + RFQ + ':\\[\\{' + RFQ + 'node' + RFQ + ':\\{' + RFQ + 'name' + RFQ + ':' + RFQ + '(' + FVAL + ')' + RFQ).exec(e);
      return m ? decodeFlight(m[1]) : '';
    })();
    const pm = new RegExp(ropen('participants') + '(\\d+)').exec(e);
    return { slug, title, excerpt, excerptFlight, image, location, category, eventType, participants: pm ? Number(pm[1]) : '' };
  });
}
export function extractStats(html) {
  const reg = arrayRegion(html, FQ + 'achievements' + FQ);
  if (!reg) return [];
  const amounts = [];
  {
    const re = new RegExp(ropen('amount') + '([\\d.]+)', 'g');
    let m; while ((m = re.exec(reg.text))) amounts.push(m[1]);
  }
  const units = [];
  {
    const re = new RegExp(ropen('unit') + '(' + RFQ + FVAL + RFQ + '|null)', 'g');
    let m;
    while ((m = re.exec(reg.text))) units.push(m[1] === 'null' ? '' : decodeFlight(m[1].slice(2, -2)));
  }
  const titles = [];
  {
    const re = new RegExp(fkey('title') + '([^' + EBS + ']+)' + RFQ, 'g');
    let m; while ((m = re.exec(reg.text))) titles.push(decodeFlight(m[1]));
  }
  const raws = [];
  {
    const re = new RegExp(fkey('content') + '(' + FVAL + ')' + RFQ, 'g');
    let m; while ((m = re.exec(reg.text))) raws.push(m[1]);
  }
  const texts = raws.map((r) => {
    const dec = plainDecode(r);
    const inner = /<div>([^<>]*)<\/div>\s*\n?\s*<\/div>/.exec(dec) || /<div>([^<>]*)<\/div>/.exec(dec);
    return (inner ? inner[1] : dec.replace(/<[^<>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  });
  const textFlights = raws.map((r) => decodeFlight(r));
  const images = [];
  {
    const re = new RegExp(fkey('sourceUrl') + '([^' + EBS + ']+)' + RFQ, 'g');
    let m; while ((m = re.exec(reg.text))) images.push(m[1]);
  }
  return titles.map((t, i) => ({
    title: t, text: texts[i] || '', textFlight: textFlights[i] || '', amount: amounts[i] || '', unit: units[i] || '', image: images[i] || '',
  }));
}
export function extractTestimonials(html) {
  const reg = arrayRegion(html, FQ + 'testimonials' + FQ);
  if (!reg) return [];
  const nodeOpen = FQ + 'node' + FQ + ':{' + FQ + 'title' + FQ;
  const edges = reg.text.split(nodeOpen).slice(1);
  return edges.map((e) => {
    const name = (() => {
      const nm = new RegExp('^:' + RFQ + '([^' + EBS + RFQ.slice(2) + ']+)' + RFQ).exec(e.slice(0, 300));
      return nm ? decodeFlight(nm[1]) : '';
    })();
    const photo = (() => {
      const m = new RegExp('featuredImage' + RFQ + ':\\{' + RFQ + 'node' + RFQ + ':\\{' + RFQ + 'sourceUrl' + RFQ + ':' + RFQ + '([^' + EBS + ']+)' + RFQ).exec(e);
      return m ? m[1] : '';
    })();
    const quote = decodeFlight(rawVal(e, 'testimonial'));
    const location = decodeFlight(rawVal(e, 'location'));
    const industry = decodeFlight(rawVal(e, 'industry'));
    const role = decodeFlight(rawVal(e, 'role'));
    const org = (() => {
      const m = new RegExp('organization' + RFQ + ':\\{' + RFQ + 'name' + RFQ + ':' + RFQ + '(' + FVAL + ')' + RFQ).exec(e);
      return m ? decodeFlight(m[1]).trim() : '';
    })();
    const logo = (() => {
      const m = new RegExp('logo' + RFQ + ':\\{' + RFQ + 'node' + RFQ + ':\\{' + RFQ + 'sourceUrl' + RFQ + ':' + RFQ + '([^' + EBS + ']+)' + RFQ).exec(e);
      return m ? m[1] : '';
    })();
    const pm = new RegExp(ropen('participants') + '(\\d+)').exec(e);
    return { name, photo, quote, location, industry, role, org, logo, participants: pm ? Number(pm[1]) : '' };
  });
}
export function extractCities(html) {
  const seen = [];
  const re = /css-o2o1k2">([^<]+)</g;
  let m;
  while ((m = re.exec(html))) {
    if (!seen.includes(m[1])) seen.push(m[1]);
    if (seen.length >= 60) break;
  }
  return seen;
}
export function extractAddresses(html) {
  const reg = arrayRegion(html, FQ + 'listAddress' + FQ);
  if (!reg) return [];
  const objs = reg.text.split(FQ + 'city' + FQ).slice(1);
  return objs.map((o) => {
    const head = o.slice(0, 80);
    const city = decodeFlight(head.slice(3).split(FQ)[0]);
    const g = (k) => decodeFlight(rawVal(FQ + o.slice(0, 900), k));
    return { city, line1: g('addressLine1'), line2: g('addressLine2'), line3: g('addressLine3'), phone: g('phoneNumber') };
  });
}
export function extractInsights(html) {
  const reg = arrayRegion(html, FQ + 'insights' + FQ);
  if (!reg) return [];
  const nodeOpen = FQ + 'node' + FQ + ':{' + FQ + 'databaseId' + FQ;
  const edges = reg.text.split(nodeOpen).slice(1);
  return edges.slice(0, 12).map((e) => ({
    slug: simpleVal(e, 'slug'),
    title: decodeFlight(rawVal(e, 'title')),
  }));
}
// File-based logo wall (effective values before DB CMS): names + current images.
export function liveLogos() {
  const byOld = new Map();
  for (const r of (LOGO_ROWS['/'] || LOGO_ROWS['/home'] || [])) {
    if (!byOld.has(r.orig_html)) byOld.set(r.orig_html, r.value);
  }
  return (LOGO_NAMES['/'] || LOGO_NAMES['/home'] || []).map((n) => ({
    name: n.name, src: byOld.get(n.src) || '', old: n.src,
  }));
}

// ---------- appliers (DB values win; empty values keep live) ----------
function applyHero(html, hero) {
  if (!hero) return html;
  const live = extractHero(html);
  if (hero.label) html = swapText(html, live.label, hero.label);
  if (hero.description) html = swapText(html, live.description, hero.description);
  return html;
}
function applyHighlights(html, items) {
  if (!Array.isArray(items) || !items.length) return html;
  const live = extractHighlights(html);
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const cur = live.find((l) => l.slug && l.slug === it.slug) || live[Number(it.index) || 0] || null;
    if (!cur) continue;
    if (it.title) html = swapText(html, cur.title, it.title);
    if (it.excerpt) {
      if (cur.excerptFlight) html = swapText(html, cur.excerptFlight, it.excerpt);
      html = swapText(html, cur.excerpt, it.excerpt);
    }
    if (it.image) html = swapUrl(html, cur.image, it.image);
    if (it.location) html = swapText(html, cur.location, it.location);
    if (it.category && cur.category) html = swapText(html, cur.category, it.category);
    if (it.participants !== undefined && it.participants !== '' && it.participants !== null && cur.participants !== '') {
      html = swapAll(html, pfkey('participants') + cur.participants, pfkey('participants') + Number(it.participants));
    }
  }
  return html;
}
function applyLogos(html, cfg) {
  if (!cfg || typeof cfg !== 'object') return html;
  const items = Array.isArray(cfg.items) ? cfg.items : [];
  if (cfg.label) html = swapText(html, 'We are proud to have worked with', cfg.label);
  if (!items.length) return html;
  const live = liveLogos();
  // Match DB items to wall slots by logo NAME (exact, then case-insensitive),
  // falling back to positional index only when the counts line up exactly.
  // Index-only matching corrupted the wall when the DB held a stale 14-item
  // list against the 19-slot wall (every item after index 0 hit the wrong slot).
  const slotFor = (it, i) => {
    if (it && typeof it === 'object' && it.name) {
      const exact = live.findIndex((l) => l.name === it.name);
      if (exact >= 0) return live[exact];
      const ci = live.findIndex((l) => String(l.name).toLowerCase() === String(it.name).toLowerCase());
      if (ci >= 0) return live[ci];
    }
    if (items.length === live.length && live[i]) return live[i];
    return null;
  };
  // Names first (flight keys on the old logo path), then image URLs.
  items.forEach((it, i) => {
    const slot = slotFor(it, i);
    if (!slot) return;
    if (it.name && it.name !== slot.name) {
      const needle = FQ + 'title' + FQ + ':' + FQ + flightEnc(slot.name) + FQ + ',' + FQ + 'featuredImage' + FQ + ':{' + FQ + 'node' + FQ + ':{' + FQ + 'sourceUrl' + FQ + ':' + FQ + slot.old;
      const repl = FQ + 'title' + FQ + ':' + FQ + flightEnc(it.name) + FQ + ',' + FQ + 'featuredImage' + FQ + ':{' + FQ + 'node' + FQ + ':{' + FQ + 'sourceUrl' + FQ + ':' + FQ + slot.old;
      html = html.split(needle).join(repl);
      html = html.split('>' + slot.name + '<').join('>' + it.name + '<');
    }
  });
  items.forEach((it, i) => {
    const slot = slotFor(it, i);
    if (!slot) return;
    const froms = new Set([slot.old, slot.src]);
    for (const f of froms) {
      if (f && it.src && f !== it.src) html = swapUrl(html, f, it.src);
    }
  });
  return html;
}
function unitNullIndex(live, i) {
  let k = -1;
  for (let j = 0; j <= i; j++) if (live[j] && live[j].unit === '') k++;
  return k;
}
function replaceNthUnit(html, n, unit) {
  const labelAt = html.indexOf('data-sc-id="t-187"');
  if (labelAt < 0) return html;
  const secEnd = html.indexOf('</section>', labelAt);
  const scope = secEnd > 0 ? html.slice(labelAt, secEnd) : html.slice(labelAt, labelAt + 60000);
  const re = /(<div class="Paragraph_paragraph__SId_Y css-b1jxb5">)(.*?)(<\/div>)/g;
  let k = -1;
  const patched = scope.replace(re, (m, a, b, c) => (++k === n ? a + String(unit).replace(/</g, '&lt;') + c : m));
  if (patched === scope) return html;
  return html.slice(0, labelAt) + patched + (secEnd > 0 ? html.slice(secEnd) : html.slice(labelAt + 60000));
}
function applyStats(html, cfg) {
  if (!cfg || typeof cfg !== 'object') return html;
  if (cfg.label) html = swapText(html, 'Where passion meets precision ', cfg.label);
  const items = Array.isArray(cfg.items) ? cfg.items : [];
  if (!items.length) return html;
  const live = extractStats(html);
  items.forEach((it, i) => {
    if (!it || typeof it !== 'object' || !live[i]) return;
    const cur = live[i];
    if (it.title) {
      html = swapText(html, cur.title, it.title);
      html = html.split('alt="' + cur.title + '"').join('alt="' + it.title + '"');
    }
    if (it.text) {
      if (cur.textFlight) html = swapText(html, cur.textFlight, it.text);
      html = swapText(html, cur.text, it.text);
    }
    if (it.amount !== undefined && it.amount !== '' && it.amount !== null && String(cur.amount) !== String(it.amount)) {
      // Flight `"amount":` must stay numeric JSON: a label like "150 Clients
      // Served" typed into the number field would otherwise ship unquoted
      // text inside a JSON row and kill client parsing. Coerce to the leading
      // number; leave the value untouched when there is none.
      const num = /-?\d+(\.\d+)?/.exec(String(it.amount));
      if (num) {
        const re = new RegExp(ropen('amount') + escRe(String(cur.amount)) + '(?![\\d.])', 'g');
        html = html.replace(re, pfkey('amount').slice(0, -2) + num[0]);
        const ids = ['t-188', 't-190', 't-192', 't-194', 't-196'];
        if (ids[i]) {
          const re2 = new RegExp('(data-sc-id="' + ids[i] + '"[^<>]*>)' + escRe(String(cur.amount)) + '(<)', 'g');
          html = html.replace(re2, '$1' + num[0] + '$2');
        }
      }
    }
    if (it.unit !== undefined && it.unit !== null && String(cur.unit) !== String(it.unit)) {
      if (cur.unit === '') {
        let k = -1;
        const want = unitNullIndex(live, i);
        html = html.replace(new RegExp(ropen('unit') + 'null', 'g'), (m) => (++k === want ? pfkey('unit') + flightEnc(String(it.unit)) + FQ : m));
      } else {
        html = swapAll(html, pfkey('unit') + flightEnc(cur.unit) + FQ, pfkey('unit') + flightEnc(String(it.unit)) + FQ);
      }
      html = replaceNthUnit(html, i, String(it.unit));
    }
    if (it.image) html = swapUrl(html, cur.image, it.image);
  });
  return html;
}
function applyTestimonials(html, items) {
  if (!Array.isArray(items) || !items.length) return html;
  const live = extractTestimonials(html);
  items.forEach((it, i) => {
    if (!it || typeof it !== 'object' || !live[i]) return;
    const cur = live[i];
    if (it.name) html = swapText(html, cur.name, it.name);
    if (it.quote) html = swapText(html, cur.quote, it.quote);
    if (it.role) html = swapText(html, cur.role, it.role);
    if (it.org) html = swapText(html, cur.org, it.org);
    if (it.location) html = swapText(html, cur.location, it.location);
    if (it.industry) html = swapText(html, cur.industry, it.industry);
    // Photos and organisation logos are deliberately NOT swapped: the band is
    // the template carousel again, and it keeps its own slide imagery.
  });
  return html;
}
function applyCities(html, cfg) {
  if (!cfg || typeof cfg !== 'object') return html;
  if (cfg.label) html = swapText(html, 'We’ve produced', cfg.label);
  if (cfg.description) html = swapText(html, 'Bringing together audiences, cultures and ideas.', cfg.description);
  const items = Array.isArray(cfg.items) ? cfg.items.filter((s) => typeof s === 'string' && s.trim()) : [];
  if (items.length) {
    const re = /(class="css-o2o1k2">)([^<]+)(<)/g;
    let k = 0;
    html = html.replace(re, (m, a, b, c) => {
      const nv = items[k % items.length];
      k++;
      return nv && nv !== b ? a + nv + c : m;
    });
  }
  if (Array.isArray(cfg.addresses) && cfg.addresses.length) {
    const liveA = extractAddresses(html);
    cfg.addresses.forEach((a, i) => {
      if (!a || typeof a !== 'object' || !liveA[i]) return;
      const cur = liveA[i];
      if (a.city && a.city !== cur.city) {
        html = swapAll(html,
          pfkey('city') + flightEnc(cur.city) + FQ + ',' + FQ + 'addressLine1' + FQ,
          pfkey('city') + flightEnc(a.city) + FQ + ',' + FQ + 'addressLine1' + FQ);
        html = swapAll(html, '>' + cur.city + '<', '>' + a.city + '<');
      }
      if (a.line1) html = swapText(html, cur.line1, a.line1);
      if (a.line2) html = swapText(html, cur.line2, a.line2);
      if (a.line3) html = swapText(html, cur.line3, a.line3);
      if (a.phone) html = swapText(html, cur.phone, a.phone);
    });
  }
  return html;
}
function applyArticles(html, items) {
  if (!Array.isArray(items) || !items.length) return html;
  for (const it of items) {
    if (!it || typeof it !== 'object' || !it.slug) continue;
    const marker = pfkey('slug') + it.slug + FQ;
    if (!html.includes(marker)) continue;
    // Bound extraction to this post's edge node when present (a flat 30k
    // window could otherwise grab a *neighbouring* post's image).
    const f = findEdgeNode(html, it.slug);
    const at = html.indexOf(marker);
    const win = f ? html.slice(at, f.nodeEnd) : html.slice(at, at + 30000);
    const oldTitle = decodeFlight(rawVal(win, 'title'));
    if (it.title && oldTitle) html = swapText(html, oldTitle, it.title);
    if (it.image) {
      const m = new RegExp(fkey('sourceUrl') + '([^' + EBS + ']+)' + RFQ).exec(win);
      if (m && m[1] !== it.image) html = swapUrl(html, m[1], it.image);
    }
    if (it.excerpt || it.content) {
      const raw = rawVal(win, 'content');
      if (raw && raw !== '$3d' && !/^\$[0-9a-z]+$/i.test(raw)) {
        const nv = it.content || it.excerpt;
        // Long-form bodies live in UNFRAMED JSON rows: row-safe encoding
        // (double-escaped " and newlines, matching pristine bytes) so the
        // client row-split and JSON.parse both survive.
        html = swapAll(html, raw, flightEncRow(nv));
        const dec = plainDecode(raw).replace(/<[^<>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (dec.length > 20) html = swapText(html, dec, String(nv).replace(/<[^<>]*>/g, ' ').replace(/\s+/g, ' ').trim());
      }
    }
  }
  return html;
}

// ---------- insights (blog listing curation + per-post overrides) ----------
const DIST_ROOT = path.resolve('dist');
let manifestCache = null, manifestAt = 0;
export function bustManifest() { manifestCache = null; manifestAt = 0; }

function nodeField(ns, key) {
  const r = rawVal(ns, key);
  return r ? decodeFlight(r) : '';
}

function parseInsightNode(ns) {
  const slug = simpleVal(ns, 'slug');
  if (!slug) return null;
  const dbm = new RegExp(ropen('databaseId') + '(\\d+)').exec(ns);
  const img = simpleVal(ns, 'sourceUrl');
  let category = '';
  {
    const ci = ns.indexOf('insightCategories');
    if (ci >= 0) {
      const nm = new RegExp(fkey('name') + '([^' + EBS + ']+)' + RFQ).exec(ns.slice(ci, ci + 600));
      if (nm) category = decodeFlight(nm[1]);
    }
  }
  const dotm = new RegExp(fkey('dotColor') + '([^' + EBS + ']+)' + RFQ).exec(ns);
  const bgm = new RegExp(fkey('backgroundColor') + '([^' + EBS + ']+)' + RFQ).exec(ns);
  return {
    slug,
    databaseId: dbm ? Number(dbm[1]) : 0,
    title: nodeField(ns, 'title'),
    image: img || '',
    date: nodeField(ns, 'date'),
    category,
    dotColor: dotm ? decodeFlight(dotm[1]) : '',
    backgroundColor: bgm ? decodeFlight(bgm[1]) : '',
  };
}

// All dist posts (parsed from the /insights listing flight + detail metas).
export async function getInsightManifest() {
  if (manifestCache && Date.now() - manifestAt < 60000) return manifestCache;
  const out = [];
  try {
    const listing = await readFile(path.join(DIST_ROOT, 'insights', 'index.html'), 'utf8');
    const seen = new Set();
    for (const a of findEdgesArrays(listing)) {
      const inner = listing.slice(a.start + 1, a.end - 1);
      const nodes = splitTopObjects(inner);
      if (!nodes.length) continue;
      const first = inner.slice(nodes[0].start, nodes[0].end);
      if (!first.includes('insightTemplate')) continue;
      for (const nd of nodes) {
        const p = parseInsightNode(inner.slice(nd.start, nd.end));
        if (p && p.slug && !seen.has(p.slug)) { seen.add(p.slug); out.push(p); }
      }
    }
    for (const p of out) {
      try {
        const d = await readFile(path.join(DIST_ROOT, 'insight', p.slug, 'index.html'), 'utf8');
        const m = /<meta[^>]*name="description"[^>]*content="([^"]*)"/.exec(d)
          || /<meta[^>]*property="og:description"[^>]*content="([^"]*)"/.exec(d);
        if (m) p.excerpt = m[1].split('&amp;').join('&').split('&#39;').join("'").split('&quot;').join('"').split('&nbsp;').join(' ');
      } catch {}
    }
  } catch {}
  manifestCache = out;
  manifestAt = Date.now();
  return out;
}

// Live insight edges on a served page: [{slug, title, image, date, category,
// databaseId, dotColor, backgroundColor, nodeStart, nodeEnd, arrStart, arrEnd}]
export function extractInsightEdges(html) {
  const out = [];
  try {
    for (const a of findEdgesArrays(html)) {
      const inner = html.slice(a.start + 1, a.end - 1);
      const nodes = splitTopObjects(inner);
      if (!nodes.length) continue;
      const first = inner.slice(nodes[0].start, nodes[0].end);
      if (!first.includes('insightTemplate')) continue;
      for (const nd of nodes) {
        const gs = a.start + 1 + nd.start, ge = a.start + 1 + nd.end;
        const p = parseInsightNode(html.slice(gs, ge));
        if (p && p.slug) out.push({ ...p, nodeStart: gs, nodeEnd: ge, arrStart: a.start, arrEnd: a.end });
      }
    }
  } catch {}
  return out;
}

// First edge node (anywhere) for a slug.
function findEdgeNode(html, slug) {
  const needle = FQ + 'slug' + FQ + ':' + FQ + slug + FQ;
  const at = html.indexOf(needle);
  if (at < 0) return null;
  for (const a of findEdgesArrays(html)) {
    if (at < a.start || at > a.end) continue;
    const inner = html.slice(a.start + 1, a.end - 1);
    for (const nd of splitTopObjects(inner)) {
      const gs = a.start + 1 + nd.start, ge = a.start + 1 + nd.end;
      if (at >= gs && at <= ge) return { node: html.slice(gs, ge), nodeStart: gs, nodeEnd: ge };
    }
  }
  return null;
}

function normISODate(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '').trim());
  if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return '';
  return `${m[1]}-${m[2]}-${m[3]}T00:00:00+00:00`;
}
function dispDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return '';
  return `${m[3]}.${m[2]}.${m[1].slice(2)}`;
}
const escHtml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Raw (still flight-escaped) value of `key` with its absolute span, or null.
function rawValAt(e, eStart, key) {
  const m = new RegExp(fkey(key) + '(' + FVAL + ')' + RFQ + TERM).exec(e);
  if (!m) return null;
  return { index: eStart + m.index + (m[0].length - m[1].length - 2), raw: m[1] };
}

// Guarded structural edit: revert if flight rows stop verifying.
function guardedFlight(html, fn) {
  let before;
  try { before = verifyFlight(html); } catch { return html; }
  let out;
  try { out = fn(html); } catch { return html; }
  if (!out || out === html) return out || html;
  try {
    const after = verifyFlight(out);
    if (after.bad !== 0 || (before.rows > 0 && after.rows !== before.rows)) return html;
  } catch { return html; }
  return out;
}

// ---------- static insight cards (SEO/no-JS layer; flight drives hydration) ----------
// Balanced element walker from an opening `<tag` (quote-aware). Returns
// exclusive end index or -1.
function balancedTag(html, tag, openStart) {
  const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'wbr', 'col', 'embed', 'track']);
  let i = openStart;
  // consume opening tag (quote-aware)
  let q = null, openEnd = -1;
  for (let j = openStart; j < html.length; j++) {
    const c = html[j];
    if (q) { if (c === q) q = null; }
    else if (c === '"' || c === "'") q = c;
    else if (c === '>') { openEnd = j; break; }
  }
  if (openEnd < 0) return -1;
  if (html[openEnd - 1] === '/' || VOID.has(tag)) return openEnd + 1;
  let depth = 1;
  i = openEnd + 1;
  while (i < html.length) {
    if (html.startsWith('<!--', i)) {
      const e = html.indexOf('-->', i + 4);
      i = e < 0 ? html.length : e + 3;
      continue;
    }
    if (html[i] === '<') {
      const m = /^<\/?([a-zA-Z][a-zA-Z0-9]*)/.exec(html.slice(i, i + 12));
      if (!m) { i++; continue; }
      const tn = m[1].toLowerCase();
      let j = i + m[0].length, qq = null;
      while (j < html.length) {
        const c = html[j];
        if (qq) { if (c === qq) qq = null; }
        else if (c === '"' || c === "'") qq = c;
        else if (c === '>') break;
        j++;
      }
      if (j >= html.length) return -1;
      const isClose = html[i + 1] === '/';
      if (tn === tag) {
        if (isClose) { depth--; if (depth === 0) return j + 1; }
        else if (html[j - 1] !== '/' && !VOID.has(tn)) depth++;
      }
      i = j + 1;
    } else i++;
  }
  return -1;
}

// [{slug, start, end, template}] for both listing templates (static HTML only:
// flight uses backslash-escaped quotes so these real-quote patterns skip it).
function parseInsightCards(html) {
  const out = [];
  const seen = new Set();
  let m;
  const reA = /<a\s(?=[^>]*class="styles_item__[^"]*")[^>]*href="\/insight\/([a-z0-9-]+)"[^>]*>/g;
  while ((m = reA.exec(html))) {
    const end = balancedTag(html, 'a', m.index);
    if (end > 0) { out.push({ slug: m[1], start: m.index, end, template: 'insights' }); seen.add(m[1] + m.index); }
  }
  const contStarts = [];
  const reC = /<div\s[^>]*class="styles_item__OXawi[^"]*"[^>]*>/g;
  let cm;
  while ((cm = reC.exec(html))) contStarts.push(cm.index);
  const reH = /<a\s[^>]*href="\/insight\/([a-z0-9-]+)"[^>]*>/g;
  while ((m = reH.exec(html))) {
    if (out.some((c) => m.index >= c.start && m.index < c.end)) continue;
    let best = -1, bestEnd = -1;
    for (const cs of contStarts) {
      if (cs > m.index) break;
      const ce = balancedTag(html, 'div', cs);
      if (ce > m.index + m[0].length && cs > best) { best = cs; bestEnd = ce; }
    }
    if (best >= 0) out.push({ slug: m[1], start: best, end: bestEnd, template: 'home' });
  }
  return out.sort((a, b) => a.start - b.start);
}

function maxScId(html) {
  let mx = 0;
  const re = /data-sc-id="[ti]-(\d+)"/g;
  let m;
  while ((m = re.exec(html))) mx = Math.max(mx, Number(m[1]));
  return mx;
}

function removeInsightCards(html, slugs) {
  const set = new Set(slugs);
  if (!set.size) return html;
  const cards = parseInsightCards(html).filter((c) => set.has(c.slug));
  cards.sort((a, b) => b.start - a.start);
  for (const c of cards) html = html.slice(0, c.start) + html.slice(c.end);
  return html;
}

function fillInsightsCard(block, oldD, newD) {
  let b = block;
  b = b.split('/insight/' + oldD.slug).join('/insight/' + newD.slug);
  if (oldD.title && newD.title && oldD.title !== newD.title) {
    // aria-label + alts are whole strings; visible title is word-split lines.
    b = b.split('aria-label="' + oldD.title + '"').join('aria-label="' + newD.title + '"');
    b = b.split('alt="' + oldD.title + '"').join('alt="' + newD.title + '"');
    const tStart = b.indexOf('<div class="Paragraph_paragraph__SId_Y css-qfyo2o"');
    if (tStart >= 0) {
      const tEnd = balancedTag(b, 'div', tStart);
      if (tEnd > 0) {
        const openEnd = b.indexOf('>', tStart) + 1;
        b = b.slice(0, openEnd)
          + '<div class="styles_line__reDdl" aria-hidden="true" style="position: relative; display: block; text-align: start;">'
          + escHtml(newD.title) + '</div>'
          + b.slice(tEnd - '</div>'.length);
      }
    }
  }
  if (oldD.image && newD.image && oldD.image !== newD.image) b = b.split(oldD.image).join(newD.image);
  if (oldD.dateDisp && newD.dateDisp && oldD.dateDisp !== newD.dateDisp) {
    b = b.replace(/<span([^>]*)>(\d\d\.\d\d\.\d\d)<\/span><span([^>]*)>([^<]*)<\/span>/,
      (m, a, d, c, cat) => `<span${a}>${newD.dateDisp}</span><span${c}>${newD.category || cat}</span>`);
  } else if (newD.category && oldD.category && newD.category !== oldD.category) {
    b = b.replace(/<span([^>]*)>(\d\d\.\d\d\.\d\d)<\/span><span([^>]*)>([^<]*)<\/span>/,
      (m, a, d, c) => `<span${a}>${d}</span><span${c}>${escHtml(newD.category)}</span>`);
  }
  return b;
}

function renumberIds(block, idBase) {
  let k = 0;
  return block.replace(/data-sc-id="[ti]-\d+"/g, (m) => (m.charAt(11) === 't' ? `data-sc-id="t-${idBase + (k++)}"` : `data-sc-id="i-${idBase + (k++)}"`));
}

function fillHomeCard(block, oldD, newD) {
  let b = block;
  b = b.split('/insight/' + oldD.slug).join('/insight/' + newD.slug);
  if (oldD.title && newD.title && oldD.title !== newD.title) {
    b = b.split('aria-label="' + oldD.title + '"').join('aria-label="' + newD.title + '"');
    const hStart = b.indexOf('<h4 class="css-hhf6se"');
    if (hStart >= 0) {
      const hEnd = balancedTag(b, 'h4', hStart);
      if (hEnd > 0) {
        const openEnd = b.indexOf('>', hStart) + 1;
        b = b.slice(0, openEnd)
          + '<div class="styles_line__Ausrd" aria-hidden="true" style="position: relative; display: block; text-align: start;">'
          + escHtml(newD.title) + '</div>'
          + b.slice(hEnd - '</h4>'.length);
      }
    }
  }
  if (oldD.dateDisp && newD.dateDisp && oldD.dateDisp !== newD.dateDisp) {
    b = b.replace(/<p([^>]*)>(\d\d\.\d\d\.\d\d)<\/p>/, (m, a) => `<p${a}>${newD.dateDisp}</p>`);
  }
  if (newD.excerpt) {
    const cStart = b.indexOf('<div class="styles_content__LLh8c');
    if (cStart >= 0) {
      const cEnd = balancedTag(b, 'div', cStart);
      if (cEnd > 0) {
        const openEnd = b.indexOf('>', cStart) + 1;
        b = b.slice(0, openEnd) + '<p>' + escHtml(newD.excerpt) + '</p>' + b.slice(cEnd - '</div>'.length);
      }
    }
  }
  return b;
}

function cloneInsightsCard(block, oldD, newD, idBase) {
  return renumberIds(fillInsightsCard(block, oldD, newD), idBase);
}
function cloneHomeCard(block, oldD, newD, idBase) {
  return renumberIds(fillHomeCard(block, oldD, newD), idBase);
}

// Main entry: curate + override insight listings on any page.
export function applyInsights(html, cfg, page, manifest) {
  if (!cfg || typeof cfg !== 'object') return html;
  const items = (cfg.items && typeof cfg.items === 'object' && !Array.isArray(cfg.items)) ? cfg.items : {};
  const hidden = new Set(Array.isArray(cfg.hidden) ? cfg.hidden.filter((s) => typeof s === 'string') : []);
  const home = Array.isArray(cfg.home) ? cfg.home.filter((s) => typeof s === 'string') : [];
  if (!Object.keys(items).length && !hidden.size && !home.length) return html;
  const manBySlug = new Map((manifest || []).map((m) => [m.slug, m]));
  const eff = (slug) => ({ ...(manBySlug.get(slug) || {}), ...((items[slug] || {})) });
  const isHome = page === '/' || page === '/home';
  const liveEdges = extractInsightEdges(html);
  const liveBySlug = new Map(liveEdges.map((e) => [e.slug, e]));

  // 1) per-post field overrides (any page where the post appears)
  for (const [slug, data] of Object.entries(items)) {
    if (!data || typeof data !== 'object') continue;
    const live = liveBySlug.get(slug) || {};
    const man = manBySlug.get(slug) || {};
    if (data.title) {
      const old = live.title || man.title || '';
      if (old && old !== data.title) html = swapText(html, old, data.title);
    }
    if (data.image) {
      const old = live.image || man.image || '';
      if (old && old !== data.image) html = swapUrl(html, old, data.image);
    }
    if (data.date) {
      const iso = normISODate(data.date);
      if (iso) {
        // key-scoped inside this edge node (ISO dates may repeat across posts)
        const f = findEdgeNode(html, slug);
        if (f) {
          const rv = rawValAt(f.node, f.nodeStart, 'date');
          if (rv && decodeFlight(rv.raw) !== iso) {
            const enc = flightEnc(iso);
            html = guardedFlight(html, (h) => h.slice(0, rv.index) + enc + h.slice(rv.index + rv.raw.length));
          }
        }
      }
    }
    if (data.category) {
      // scoped to this node's insightCategories block (names collide globally)
      const f = findEdgeNode(html, slug);
      if (f) {
        const ci = f.node.indexOf('insightCategories');
        if (ci >= 0) {
          const sub = f.node.slice(ci);
          const m = new RegExp(fkey('name') + '(' + FVAL + ')' + RFQ).exec(sub);
          if (m) {
            const oldC = decodeFlight(m[1]);
            if (oldC && oldC !== data.category) {
              const abs = f.nodeStart + ci + m.index + (m[0].length - m[1].length - 2);
              const enc = flightEnc(data.category);
              html = guardedFlight(html, (h) => h.slice(0, abs) + enc + h.slice(abs + m[1].length));
            }
          }
        }
      }
    }
    if (data.excerpt && page === '/insight/' + slug) {
      // search/social blurb = detail meta descriptions
      for (const re of [
        /<meta[^>]*name="description"[^>]*content="([^"]*)"/,
        /<meta[^>]*property="og:description"[^>]*content="([^"]*)"/,
        /<meta[^>]*name="twitter:description"[^>]*content="([^"]*)"/,
      ]) {
        const m = re.exec(html);
        if (m && m[1] && m[1] !== data.excerpt && m[1].length > 20) html = swapText(html, m[1], data.excerpt);
      }
    }
    if (data.excerpt && isHome) {
      // home cards render their blurb from the edge content field
      const f = findEdgeNode(html, slug);
      if (f) {
        const rv = rawValAt(f.node, f.nodeStart, 'content');
        if (rv) {
          const enc = flightEnc(data.excerpt);
          html = guardedFlight(html, (h) => h.slice(0, rv.index) + enc + h.slice(rv.index + rv.raw.length));
        }
      }
    }
    if (data.content) {
      // reuse the articles long-form path (skips short/$ref nodes)
      html = applyArticles(html, [{ slug, title: '', image: '', content: data.content }]);
    }
  }

  // 2) hide posts from listings (flight edges + static cards)
  if (hidden.size) {
    html = guardedFlight(html, (h) => {
      let out = h;
      for (const a of findEdgesArrays(out)) {
        const inner = out.slice(a.start + 1, a.end - 1);
        const nodes = splitTopObjects(inner);
        if (nodes.length < 2) continue;
        const first = inner.slice(nodes[0].start, nodes[0].end);
        if (!first.includes('insightTemplate')) continue;
        const kept = [];
        for (const nd of nodes) {
          const ns = inner.slice(nd.start, nd.end);
          const p = parseInsightNode(ns);
          if (p && p.slug && hidden.has(p.slug)) continue;
          kept.push(ns);
        }
        if (kept.length !== nodes.length) {
          out = out.slice(0, a.start + 1) + kept.join(',') + out.slice(a.end - 1);
        }
      }
      return out;
    });
    html = removeInsightCards(html, [...hidden]);
  }

  // 3) home order (home pages only): exact slug sequence
  if (isHome && home.length) {
    const valid = home.filter((s) => manBySlug.has(s) && !hidden.has(s));
    if (valid.length) {
      html = guardedFlight(html, (h) => rebuildHomeEdges(h, valid, eff));
      html = syncHomeCards(html, valid, eff, manBySlug, items);
    }
  }
  // 4) listing static fill (kept cards carry new text pre-hydration)
  if (page === '/insights' && Object.keys(items).length) {
    html = syncInsightsCards(html, eff, manBySlug);
  }
  // 5) home insights circles: flight cells vs surviving edge count
  if (isHome) {
    html = syncInsightCircleCells(html);
  }
  return html;
}

// The home "insights" hero circles render from a flight cell list where each
// cell references `data...insights.edges:N` by index. When applyInsights
// trims/rebuilds the home edges array (hidden filter or home ordering), stray
// cells pointing past the new count de-reference to undefined and crash
// hydration (`AnimatedCircle` reads `node`). Rewrite the cell list so it
// always mirrors the surviving edge count, keeping `edges:N`/`index:N` in
// sync with the on-page data row's `$4:...` reference prefix.
function syncInsightCircleCells(html) {
  const count = homeInsightEdgeCount(html);
  if (count < 1) return html;
  // the circle cells live in the flight rows (`$L53` cells with `item` refs)
  const needle = 'styles_bottom__ivX84';
  const gi = html.indexOf(needle);
  if (gi < 0) return html;
  // cells appear as `"children":[[["$","$L53",...],...]` where the children
  // value opens `[`, then the cells ARRAY opens `[`, then each cell `[`. The
  // cells array (first child) is what must be trimmed to `count` cells.
  const cellStart = html.indexOf('children' + FQ + ':[', gi);
  if (cellStart < 0) return html;
  const cellsOpen = cellStart + ('children' + FQ + ':[').length; // X-open index
  const cellsEnd = matchBracketRaw(html, cellsOpen);
  if (cellsEnd <= 0) return html;
  // keep exactly `count` leading cells and renumber edges:N/index:N 0..count-1
  const inner = html.slice(cellsOpen + 1, cellsEnd - 1);
  const spans = splitTopArrays(inner);
  if (spans.length < 2) return html;
  const keep = spans.slice(0, count);
  const rebuilt = keep.map((s, i) => {
    let cell = inner.slice(s.start, s.end);
    const reNum = new RegExp('(edges:)\\d+').exec(cell);
    if (reNum) cell = cell.slice(0, reNum.index) + reNum[1] + i + cell.slice(reNum.index + reNum[0].length);
    const reIdx = new RegExp(RFQ + 'index' + RFQ + ':\\d+').exec(cell);
    if (reIdx) cell = cell.slice(0, reIdx.index) + pfkey('index').slice(0, -FQ.length) + i + cell.slice(reIdx.index + reIdx[0].length);
    return cell;
  });
  return html.slice(0, cellsOpen + 1) + rebuilt.join(',') + html.slice(cellsEnd - 1);
}

// Number of insight edge nodes in the (home) insights edges array.
function homeInsightEdgeCount(html) {
  for (const a of findEdgesArrays(html)) {
    const inner = html.slice(a.start + 1, a.end - 1);
    const nodes = splitTopObjects(inner);
    if (nodes.length < 1) continue;
    const first = inner.slice(nodes[0].start, nodes[0].end);
    if (!first.includes('insightTemplate')) continue;
    // the listing page keeps many edges; home arrays are small (<=6)
    if (nodes.length > 6) continue;
    return nodes.length;
  }
  return 0;
}

// Rebuild every home insights edges array to exactly `slugs` (in order).
function rebuildHomeEdges(html, slugs, eff) {
  let out = html;
  for (const a of findEdgesArrays(out)) {
    const inner = out.slice(a.start + 1, a.end - 1);
    const nodes = splitTopObjects(inner);
    if (!nodes.length) continue;
    const first = inner.slice(nodes[0].start, nodes[0].end);
    if (!first.includes('insightTemplate')) continue;
    // home array only (listing page keeps all visible; hidden filtered above)
    const bySlug = new Map();
    for (const nd of nodes) {
      const ns = inner.slice(nd.start, nd.end);
      const p = parseInsightNode(ns);
      if (p && p.slug && !bySlug.has(p.slug)) bySlug.set(p.slug, ns);
    }
    // only rebuild arrays that look like the home set (<=6 nodes); the main
    // 27-listing is curated by hidden[] alone.
    if (nodes.length > 6) continue;
    const built = [];
    for (const slug of slugs) {
      if (bySlug.has(slug)) { built.push(bySlug.get(slug)); continue; }
      const made = buildInsightNode(first, eff(slug));
      if (made) built.push(made);
    }
    if (!built.length) continue;
    out = out.slice(0, a.start + 1) + built.join(',') + out.slice(a.end - 1);
  }
  return out;
}

// Fill the template node's leaves with post data (lengths free: fresh string).
function buildInsightNode(template, d) {
  if (!d || !d.slug) return '';
  let s = template;
  // databaseId (numeric, unquoted)
  if (d.databaseId) {
    const mdb = new RegExp(ropen('databaseId') + '\\d+').exec(s);
    if (mdb) s = s.slice(0, mdb.index) + pfkey('databaseId').slice(0, -2) + Number(d.databaseId) + s.slice(mdb.index + mdb[0].length);
  }
  // slug
  s = swapFirstKey(s, 'slug', d.slug);
  // title
  if (d.title) s = swapFirstKey(s, 'title', flightEnc(d.title));
  // content: plain excerpt (cards render body blurb from this field)
  if (d.excerpt) s = swapFirstKey(s, 'content', flightEnc(d.excerpt));
  // image
  if (d.image) s = swapFirstKey(s, 'sourceUrl', d.image);
  // date
  if (d.date) s = swapFirstKey(s, 'date', normISODate(d.date) || d.date);
  // colors
  if (d.dotColor) s = swapFirstKey(s, 'dotColor', d.dotColor);
  if (d.backgroundColor) s = swapFirstKey(s, 'backgroundColor', d.backgroundColor);
  return s.includes(d.slug) ? s : '';
}

// Replace first `"key":"<old>"` (flight-escaped plane) with raw `encVal`.
function swapFirstKey(s, key, encVal) {
  const m = new RegExp(fkey(key) + '(' + FVAL + ')' + RFQ).exec(s);
  if (!m) return s;
  return s.slice(0, m.index) + pfkey(key) + encVal + FQ + s.slice(m.index + m[0].length);
}

// Sync home static cards to `slugs` order (remove extras, add missing, reorder,
// then fill kept cards so static text matches flight).
function syncHomeCards(html, slugs, eff, manBySlug, itemsExplicit) {
  const man = (s) => eff(s);
  const pristine = (s) => (manBySlug && manBySlug.get(s)) || {};
  let cards = parseInsightCards(html).filter((c) => c.template === 'home');
  if (!cards.length) return html;
  // remove cards not in order
  const want = new Set(slugs);
  const drop = cards.filter((c) => !want.has(c.slug)).map((c) => c.slug);
  if (drop.length) html = removeInsightCards(html, drop);
  // add missing (clone first remaining card)
  cards = parseInsightCards(html).filter((c) => c.template === 'home');
  const have = new Set(cards.map((c) => c.slug));
  const missing = slugs.filter((s) => !have.has(s));
  if (missing.length && cards.length) {
    const tpl = cards[0];
    const tplBlock = html.slice(tpl.start, tpl.end);
    const oldSlug = tpl.slug;
    const oldD = {
      slug: oldSlug,
      title: pristine(oldSlug).title || '',
      dateDisp: dispDate(pristine(oldSlug).date),
      excerpt: '',
    };
    let idBase = maxScId(html) + 1;
    if (idBase < 9000) idBase = 9000;
    const clones = [];
    for (const slug of missing) {
      const d = man(slug);
      clones.push(cloneHomeCard(tplBlock, oldD, {
        slug,
        title: d.title || slug,
        dateDisp: dispDate(d.date) || oldD.dateDisp,
        excerpt: d.excerpt || '',
      }, idBase));
      idBase += 40;
    }
    const at = cards[cards.length - 1].end;
    if (at > 0) html = html.slice(0, at) + clones.join('') + html.slice(at);
  }
  // reorder to slugs
  cards = parseInsightCards(html).filter((c) => c.template === 'home');
  const bySlug = new Map(cards.map((c) => [c.slug, c]));
  if (slugs.every((s) => bySlug.has(s)) && cards.length === slugs.length) {
    // check contiguity (only whitespace/comments between)
    let ok = true;
    for (let i = 0; i < cards.length - 1; i++) {
      const gap = html.slice(cards[i].end, cards[i + 1].start);
      if (!/^[\s]*(?:<!--[\s\S]*?-->[\s]*)*$/.test(gap)) {
        ok = false;
        if (process.env.SC_DBG) console.error('[reorder-skip] gap', i, JSON.stringify(gap.slice(0, 120)));
        break;
      }
    }
    if (ok) {
      const blocks = slugs.map((s) => html.slice(bySlug.get(s).start, bySlug.get(s).end));
      html = html.slice(0, cards[0].start) + blocks.join('') + html.slice(cards[cards.length - 1].end);
    }
  }
  // fill kept cards (back-to-front so positions stay valid)
  cards = parseInsightCards(html).filter((c) => c.template === 'home');
  cards.sort((a, b) => b.start - a.start);
  for (const c of cards) {
    const m = pristine(c.slug);
    const e = eff(c.slug) || {};
    const block = html.slice(c.start, c.end);
    const filled = fillHomeCard(block,
      { slug: c.slug, title: m.title || '', dateDisp: dispDate(m.date) },
      {
        slug: c.slug,
        title: e.title || m.title || '',
        dateDisp: dispDate(e.date) || dispDate(m.date),
        excerpt: (itemsExplicit[c.slug] && itemsExplicit[c.slug].excerpt) || '',
      });
    if (filled !== block) html = html.slice(0, c.start) + filled + html.slice(c.end);
  }
  return html;
}

// Fill kept /insights-listing static cards (titles/dates/images/categories).
function syncInsightsCards(html, eff, manBySlug) {
  const cards = parseInsightCards(html).filter((c) => c.template === 'insights');
  if (!cards.length) return html;
  const order = cards.slice().sort((a, b) => b.start - a.start);
  for (const c of order) {
    const m = (manBySlug && manBySlug.get(c.slug)) || {};
    const e = eff(c.slug) || {};
    if (!m.title && !e.title) continue;
    const block = html.slice(c.start, c.end);
    const filled = fillInsightsCard(block,
      { slug: c.slug, title: m.title || '', image: m.image || '', dateDisp: dispDate(m.date), category: m.category || '' },
      {
        slug: c.slug,
        title: e.title || m.title || '',
        image: e.image || m.image || '',
        dateDisp: dispDate(e.date) || dispDate(m.date),
        category: e.category || m.category || '',
      });
    if (filled !== block) html = html.slice(0, c.start) + filled + html.slice(c.end);
  }
  return html;
}

// Static add for the /insights listing template (used when hidden-filtering
// needs no add; adds happen on home via syncHomeCards — listing shows all).
function addInsightsCards(html, cards) {
  if (!cards.length) return html;
  const all = parseInsightCards(html).filter((c) => c.template === 'insights');
  if (!all.length) return html;
  const tpl = all[0];
  const tplBlock = html.slice(tpl.start, tpl.end);
  const oldSlug = tpl.slug;
  let idBase = maxScId(html) + 1;
  if (idBase < 9000) idBase = 9000;
  // old values for swaps: parsed from the live page is overkill — derive from block
  const oldTitle = (/aria-label="([^"]*)"/.exec(tplBlock) || [])[1] || '';
  const oldImg = (/src="([^"]*)"/.exec(tplBlock) || [])[1] || '';
  const oldDate = (/(\d\d\.\d\d\.\d\d)/.exec(tplBlock) || [])[1] || '';
  const clones = cards.map((c) => cloneInsightsCard(tplBlock,
    { slug: oldSlug, title: oldTitle, image: oldImg, dateDisp: oldDate, category: '' },
    c, (idBase += 40, idBase)));
  const at = all[all.length - 1].end;
  if (at < 0) return html;
  return html.slice(0, at) + clones.join('') + html.slice(at);
}

// ---------- team (text-only monogram cards) ----------
export function extractTeam(html) {
  const out = [];
  const re = /<article class="sc-vo" data-sc-voice="team">[\s\S]*?<h3[^>]*>([^<]+)<\/h3>[\s\S]*?<p[^>]*class="sc-vo-title"[^>]*>([^<]+)<\/p>[\s\S]*?<p[^>]*class="sc-vo-bio"[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(html))) out.push({ name: m[1].trim(), role: m[2].trim(), bio: m[3].replace(/<[^>]*>/g, '').trim() });
  return out;
}
function applyTeam(html, cfg) {
  if (!cfg || typeof cfg !== 'object') return html;
  const items = Array.isArray(cfg.items) ? cfg.items : Array.isArray(cfg.members) ? cfg.members : [];
  if (!items.length) return html;
  const live = extractTeam(html);
  if (!live.length) return html;
  for (let i = 0; i < items.length && i < live.length; i++) {
    const it = items[i];
    const cur = live[i];
    if (!it || !cur) continue;
    if (it.name && it.name !== cur.name) html = swapText(html, cur.name, it.name);
    if (it.role && it.role !== cur.role) html = swapText(html, cur.role, it.role);
    if (it.bio && it.bio !== cur.bio) html = swapText(html, cur.bio, it.bio);
    // monogram auto-updates via monoOf() on next render, but for immediate
    // static swap we also replace the 2-letter circle text if present.
    if (it.name && cur.name && it.name !== cur.name) {
      const oldMono = cur.name.split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
      const newMono = String(it.name).trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
      if (oldMono && newMono && oldMono !== newMono) html = html.split('>' + oldMono + '</div>').join('>' + newMono + '</div>');
    }
  }
  return html;
}

// ---------- case studies / projects ----------
export function extractProjects(html, page) {
  // project detail pages: title in h1 t-21, hero in p t-22, sections t-27/28/29 blocks
  const get = (id) => {
    const m = new RegExp('data-sc-id="' + id + '"[^>]*>([\\s\\S]*?)<\\/(?:h1|p|div)>').exec(html);
    return m ? m[1].replace(/<[^>]*>/g, '').trim() : '';
  };
  return {
    title: get('t-21'),
    hero: get('t-22'),
    challenge: get('t-27'),
    whatWeDid: get('t-28'),
    result: get('t-29'),
    quote: (() => { const m = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/.exec(html); return m ? m[1].replace(/<[^>]*>/g, '').trim() : ''; })(),
  };
}
function applyProjects(html, cfg, page) {
  if (!cfg || typeof cfg !== 'object') return html;
  // cfg shape: { overview: { footfall, dwell, note }, items: { slug: { title, excerpt, challenge, whatWeDid, result, quote } } }
  // page-scoped: /project/<slug> or /projects
  const slug = String(page || '').replace(/^\/project\//, '').split('/')[0].split('?')[0];
  const items = cfg.items && typeof cfg.items === 'object' && !Array.isArray(cfg.items) ? cfg.items : cfg;
  const data = slug && items[slug] ? items[slug] : null;
  if (data) {
    const live = extractProjects(html, page);
    if (data.title && live.title && data.title !== live.title) html = swapText(html, live.title, data.title);
    if (data.hero && live.hero && data.hero !== live.hero) html = swapText(html, live.hero, data.hero);
    if (data.challenge && live.challenge && data.challenge !== live.challenge) html = swapText(html, live.challenge, data.challenge);
    if (data.whatWeDid && live.whatWeDid && data.whatWeDid !== live.whatWeDid) html = swapText(html, live.whatWeDid, data.whatWeDid);
    if (data.result && live.result && data.result !== live.result) html = swapText(html, live.result, data.result);
    // quotes may be blank on the page (placeholders removed): an admin-supplied
    // quote applies onto the live quote when one exists.
    if (data.quote && live.quote && data.quote !== live.quote) html = swapText(html, live.quote, data.quote);
  }
  // overview stat on /projects (once) — inject/replace a small banner if present
  if ((page === '/projects' || page === '/projects/filter') && cfg.overview) {
    const o = cfg.overview;
    if (o.footfall) html = swapText(html, '33%', o.footfall);
    if (o.dwell) html = swapText(html, '21%', o.dwell);
  }
  return html;
}

// Main entry: apply saved CMS sections to served HTML.
export async function applyStructuredCMS(html, cms, page) {
  if (!cms || typeof cms !== 'object') return html;
  try {
    const isHome = page === '/' || page === '/home';
    if (isHome) {
      if (cms.hero && (cms.hero.label || cms.hero.description)) html = applyHero(html, cms.hero);
      if (cms.highlights && Array.isArray(cms.highlights.items)) html = applyHighlights(html, cms.highlights.items);
      if (cms.logos && (cms.logos.label || (Array.isArray(cms.logos.items) && cms.logos.items.length))) html = applyLogos(html, cms.logos);
      if (cms.stats && (cms.stats.label || (Array.isArray(cms.stats.items) && cms.stats.items.length))) html = applyStats(html, cms.stats);
      if (cms.testimonials && Array.isArray(cms.testimonials.items)) html = applyTestimonials(html, cms.testimonials.items);
      if (cms.cities && (cms.cities.label || cms.cities.description || (Array.isArray(cms.cities.items) && cms.cities.items.length) || (Array.isArray(cms.cities.addresses) && cms.cities.addresses.length))) html = applyCities(html, cms.cities);
    } else if (cms.cities && Array.isArray(cms.cities.addresses) && cms.cities.addresses.length) {
      html = applyCities(html, { addresses: cms.cities.addresses });
    }
    if (cms.articles && Array.isArray(cms.articles.items) && cms.articles.items.length) html = applyArticles(html, cms.articles.items);
    if (cms.insights && typeof cms.insights === 'object') {
      const manifest = await getInsightManifest().catch(() => []);
      html = applyInsights(html, cms.insights, page, manifest);
    }
    if (cms.team && typeof cms.team === 'object') html = applyTeam(html, cms.team);
    if (cms.projects && typeof cms.projects === 'object') html = applyProjects(html, cms.projects, page);
  } catch {}
  return html;
}

// Live snapshot for the Insider dashboard prefill (pristine dist + file wall).
export async function liveSnapshot(pristineHtml) {
  try {
    return {
      hero: extractHero(pristineHtml),
      highlights: extractHighlights(pristineHtml),
      logos: { label: 'We are proud to have worked with', items: liveLogos() },
      stats: { label: 'Where passion meets precision ', items: extractStats(pristineHtml) },
      testimonials: extractTestimonials(pristineHtml),
      cities: { items: extractCities(pristineHtml).slice(0, 45), addresses: extractAddresses(pristineHtml) },
      insights: extractInsights(pristineHtml),
      insightManifest: await getInsightManifest().catch(() => []),
      team: extractTeam(pristineHtml),
    };
  } catch { return {}; }
}
