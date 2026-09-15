// StillCraft structured mini-CMS (Insider dashboard sections).
// The inline edit bar handles single text/image nodes, but structured lists
// (highlight cards, logo wall, stats, testimonials, cities, long-form
// articles) render from Next.js flight payloads where one-click edits
// can't survive hydration. This module extracts those lists live from the
// HTML being served and swaps in admin-approved values from the DB.
//
// Model: `cms_sections(section TEXT PRIMARY KEY, data JSONB)`.
// Empty/missing values are always a no-op (live content is kept).
import { pool } from './db.mjs';
import { LOGO_ROWS } from './stillcraft-logos.mjs';
import { NAMES as LOGO_NAMES } from './stillcraft-names.mjs';

export const CMS_SECTIONS = ['hero', 'highlights', 'logos', 'stats', 'testimonials', 'cities', 'articles'];

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
function swapAll(html, oldV, newV) {
  if (!oldV || newV == null || String(newV) === '' || oldV === newV) return html;
  return html.split(oldV).join(String(newV));
}
// Swap a plain-text value everywhere it appears: raw HTML + flight-escaped plane.
function swapText(html, oldV, newV) {
  if (!oldV || newV == null || String(newV) === '' || String(oldV) === String(newV)) return html;
  html = swapAll(html, String(oldV), String(newV));
  const eo = flightEnc(oldV), ev = flightEnc(newV);
  if (eo !== String(oldV)) html = swapAll(html, eo, ev);
  return html;
}
// Swap an asset URL: raw + backslash-escaped-slash flight variant.
function swapUrl(html, oldV, newV) {
  if (!oldV || newV == null || String(newV) === '' || String(oldV) === String(newV)) return html;
  html = swapAll(html, String(oldV), String(newV));
  const eo = String(oldV).split('/').join(BS + '/'), ev = String(newV).split('/').join(BS + '/');
  if (eo !== String(oldV)) html = swapAll(html, eo, ev);
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

// ---------- DB access (15s cache, same pattern as overrides) ----------
let cmsCache = null, cmsAt = 0;
export function bustCMS() { cmsCache = null; cmsAt = 0; }
const CMS_DEFAULTS = { hero: {}, highlights: {}, logos: {}, stats: {}, testimonials: {}, cities: {}, articles: {} };
export async function getCMS() {
  if (cmsCache && Date.now() - cmsAt < 15000) return cmsCache;
  const out = JSON.parse(JSON.stringify(CMS_DEFAULTS));
  try {
    const r = await pool.query('SELECT section, data FROM cms_sections');
    for (const row of r.rows) {
      if (row && typeof row.section === 'string' && row.data && typeof row.data === 'object') {
        out[row.section] = { ...(out[row.section] || {}), ...row.data };
      }
    }
  } catch {}
  cmsCache = out; cmsAt = Date.now();
  return out;
}
export async function saveCMSSection(section, data) {
  if (!CMS_SECTIONS.includes(section)) throw new Error('unknown section');
  if (!data || typeof data !== 'object') throw new Error('bad data');
  await pool.query(
    'INSERT INTO cms_sections (section, data, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (section) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
    [section, JSON.stringify(data).slice(0, 200000)]
  );
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
  // Names first (flight keys on the old logo path), then image URLs.
  items.forEach((it, i) => {
    if (!it || typeof it !== 'object' || !live[i]) return;
    if (it.name && it.name !== live[i].name) {
      const needle = FQ + 'title' + FQ + ':' + FQ + flightEnc(live[i].name) + FQ + ',' + FQ + 'featuredImage' + FQ + ':{' + FQ + 'node' + FQ + ':{' + FQ + 'sourceUrl' + FQ + ':' + FQ + live[i].old;
      const repl = FQ + 'title' + FQ + ':' + FQ + flightEnc(it.name) + FQ + ',' + FQ + 'featuredImage' + FQ + ':{' + FQ + 'node' + FQ + ':{' + FQ + 'sourceUrl' + FQ + ':' + FQ + live[i].old;
      html = html.split(needle).join(repl);
      html = html.split('>' + live[i].name + '<').join('>' + it.name + '<');
    }
  });
  items.forEach((it, i) => {
    if (!it || typeof it !== 'object' || !live[i]) return;
    const froms = new Set([live[i].old, live[i].src]);
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
      const re = new RegExp(ropen('amount') + escRe(String(cur.amount)) + '(?![\\d.])', 'g');
      html = html.replace(re, pfkey('amount').slice(0, -2) + String(it.amount));
      const ids = ['t-188', 't-190', 't-192', 't-194', 't-196'];
      if (ids[i]) {
        const re2 = new RegExp('(data-sc-id="' + ids[i] + '"[^<>]*>)' + escRe(String(cur.amount)) + '(<)', 'g');
        html = html.replace(re2, '$1' + String(it.amount) + '$2');
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
    if (it.photo) html = swapUrl(html, cur.photo, it.photo);
    if (it.logo) html = swapUrl(html, cur.logo, it.logo);
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
    const at = html.indexOf(marker);
    const win = html.slice(at, at + 30000);
    const oldTitle = decodeFlight(rawVal(win, 'title'));
    if (it.title && oldTitle) html = swapText(html, oldTitle, it.title);
    if (it.image) {
      const m = new RegExp(fkey('sourceUrl') + '([^' + EBS + ']+)' + RFQ).exec(win);
      if (m && m[1] !== it.image) html = swapUrl(html, m[1], it.image);
    }
    if (it.excerpt || it.content) {
      const raw = rawVal(win, 'content');
      if (raw && raw !== '$3d') {
        const nv = it.content || it.excerpt;
        html = swapAll(html, raw, flightEnc(nv));
        const dec = decodeFlight(raw).replace(/<[^<>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (dec.length > 20) html = swapText(html, dec, String(nv).replace(/<[^<>]*>/g, ' ').replace(/\s+/g, ' ').trim());
      }
    }
  }
  return html;
}

// Main entry: apply saved CMS sections to served HTML.
export function applyStructuredCMS(html, cms, page) {
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
  } catch {}
  return html;
}

// Live snapshot for the Insider dashboard prefill (pristine dist + file wall).
export function liveSnapshot(pristineHtml) {
  try {
    return {
      hero: extractHero(pristineHtml),
      highlights: extractHighlights(pristineHtml),
      logos: { label: 'We are proud to have worked with', items: liveLogos() },
      stats: { label: 'Where passion meets precision ', items: extractStats(pristineHtml) },
      testimonials: extractTestimonials(pristineHtml),
      cities: { items: extractCities(pristineHtml).slice(0, 45), addresses: extractAddresses(pristineHtml) },
      insights: extractInsights(pristineHtml),
    };
  } catch { return {}; }
}
