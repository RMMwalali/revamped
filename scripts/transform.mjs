// StillCraft page transforms shared by the dev server and Vercel functions.
// Pure string ops over served HTML (+ brand data). No http, no fs writes.
import { readStore, writeStore } from './storage.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { FLIGHT as FILE_FLIGHT } from './stillcraft-content.mjs';
import { LOGO_ROWS } from './stillcraft-logos.mjs';
import { CONGRESS_PRECISION_SECTION } from './congress-precision.mjs';
import { OVERVIEW_STATS, caseBySlug, PLACEHOLDER_TESTIMONIALS, default as CASE } from './stillcraft-cases.mjs';
export { LOGO_ROWS };
export { CONTENT as FILE_CONTENT } from './stillcraft-content.mjs';
import { NAMES as LOGO_NAMES } from './stillcraft-names.mjs';
export { NAMES as LOGO_NAMES } from './stillcraft-names.mjs';
import { safeReplace, safeReplacePairs, safeReplaceVerified, verifyFlight, findEdgesArrays, splitTopObjects } from './flight.mjs';

// Page-scoped whole-value flight swaps (short labels patchFlight can't gate).
// Testimonial slider logos stay per-case for the edit bar (quotes name old clients).
const LOGO_FLIGHT = [...new Map(Object.values(LOGO_ROWS).flat()
  .filter(r => !/Testimonial/i.test(r.orig_html)).map(r => [r.orig_html, r.value])).entries()];
function applyContentFlight(html, page) {
  const pairs = FILE_FLIGHT[page];
  const P = [];
  if (pairs) for (const [from, to] of pairs) {
    const forms = [from, from.split('&').join('&amp;'), from.split('&').join('\\u0026')];
    const tos = [to, to.split('&').join('&amp;'), to.split('&').join('\\u0026')];
    for (let k = 0; k < forms.length; k++) {
      P.push([`"${forms[k]}"`, `"${tos[k]}"`]);
      P.push([`\\"${forms[k]}\\"`, `\\"${tos[k]}\\"`]);
    }
  }
  // wall name labels, scoped by title+logo so duplicate names stay distinct.
  // Must run before the URL swap below (it keys on the old logo path).
  if (LOGO_NAMES[page]) for (const n of LOGO_NAMES[page]) {
    P.push([
      `\\"title\\":\\"${n.old}\\",\\"featuredImage\\":{\\"node\\":{\\"sourceUrl\\":\\"${n.src}`,
      `\\"title\\":\\"${n.name}\\",\\"featuredImage\\":{\\"node\\":{\\"sourceUrl\\":\\"${n.src}`,
    ]);
  }
  // client logo URLs on wall pages only (testimonial sliders stay per-case for the edit bar)
  if (LOGO_ROWS[page]) for (const [oldSrc, newSrc] of LOGO_FLIGHT) {
    P.push([oldSrc, newSrc]);
    P.push([oldSrc.split('/').join('\\/'), newSrc.split('/').join('\\/')]);
  }
  return P.length ? safeReplacePairs(html, P) : html;
}

// ---------- brand cache (StillCraft defaults win when DB is down/empty) ----------
export const HERO_VIDEO_URL = 'https://res.cloudinary.com/dtnbwgpca/video/upload/v1789445868/skillcraft/Stillcraft_hero_video_zbgcov.mp4';
export const HERO_VIDEO_MOBILE_URL = 'https://res.cloudinary.com/dtnbwgpca/video/upload/q_auto,w_640/v1789445868/skillcraft/Stillcraft_hero_video_zbgcov.mp4';
export const HERO_POSTER_URL = 'https://res.cloudinary.com/dtnbwgpca/video/upload/so_0,w_1280,q_auto/v1789445868/skillcraft/Stillcraft_hero_video_zbgcov.jpg';
const BRAND_DEFAULTS = {
  site_name: 'StillCraft Events',
  tagline: 'Step into the Spotlight',
  logo_src: '',
  primary_color: '#1B2A4A',
  accent_color: '#C9A24B',
  hero_video_src: HERO_VIDEO_URL,
};
let brandCache = null;
let brandAt = 0;
function bustBrand() { brandAt = 0; }
async function getBrand() {
  if (brandCache && Date.now() - brandAt < 60000) return brandCache;
  try {
    const data = await readStore('brand.json');
    brandCache = { ...BRAND_DEFAULTS, ...data };
  } catch { brandCache = { ...BRAND_DEFAULTS, ...brandCache }; }
  brandAt = Date.now();
  return brandCache;
}

export async function saveBrand(updates) {
  const data = await readStore('brand.json') || {};
  Object.assign(data, updates);
  await writeStore('brand.json', data);
  bustBrand();
}

const DEFAULT_TAGLINE = 'Step into the Spotlight';

// ---------- site IA: StillCraft navigation (existing pages, new titles) ----------
// Three service lanes: Mall Calendar Programming, Mall Space Monetization, Brand Activations.
const NAV_LABELS = [
['Events', 'Brand Activations'],
  ['Exhibits', 'Mall Calendar Programming'],
  ['Congresses', 'Mall Space Monetization'],
];
const NAV_DROP_HREFS = ['/service/sports'];
const TITLE_MAP = {
  '/': 'International Event Agency | Brand Activations, Mall Calendar Programming | StillCraft Events',
  '/home': 'International Event Agency | Brand Activations, Mall Calendar Programming | StillCraft Events',
  '/about': 'About - StillCraft Events',
  '/service/events': 'Brand Activations | StillCraft Events',
  '/service/exhibits': 'Mall Calendar Programming | StillCraft Events',
  '/projects': 'Projects | Case Studies | StillCraft Events',
  '/case-studies': 'Case Studies | Mall Activations & Event Production | StillCraft Events',
  '/contact': 'Contact | Start Your Project | StillCraft Events',
  '/service/congresses': 'Mall Space Monetization | StillCraft Events',
};

// StillCraft menu order: Home, About, Mall Calendar Programming, Mall Space
// Monetization, Brand Activations, Contact.
const MENU_ORDER = [
  ['/', 'Home'],
  ['/about', 'About'],
  ['/service/exhibits', 'Mall Calendar Programming'],
  ['/service/congresses', 'Mall Space Monetization'],
  ['/service/events', 'Brand Activations'],
];
const CONTACT_HREF = '/contact?form=quote';
function applyMenuOrder(html) {
  return html.replace(
    /<ul class="styles_menus__items__hZxYX">([\s\S]*?)<\/ul>/g,
    (ul, inner) => {
      const items = [...inner.matchAll(/<li class="([^"]*)">(.*?)<\/li>/g)];
      if (items.length < 5) return ul; // not the header menu, leave alone
      const byHref = new Map();
      for (const [, cls, content] of items) {
        const m = /href="([^"]+)"/.exec(content);
        if (m && content.trim()) byHref.set(m[1], { cls, content });
      }
      const firstCls = items[0][1];
      const contact = byHref.get(CONTACT_HREF);
      const lis = MENU_ORDER.map(([href, label]) => {
        if (href === '/') return `<li class="${firstCls}"><a href="/">Home</a></li>`;
        const hit = byHref.get(href);
        if (hit) return `<li class="${hit.cls}">${hit.content}</li>`;
        return `<li class="${firstCls}"><a href="${href}">${label}</a></li>`;
      });
      if (contact) lis.push(`<li class="${contact.cls}">${contact.content}</li>`);
      return '<ul class="styles_menus__items__hZxYX">' + lis.join('') + '</ul>';
    }
  );
}

function flightReplace(html, fromJson, toJson) {
  // Replace whole-string JSON values. Length-synced inside flight pushes so
  // length-prefixed rows stay valid; plain replace everywhere else.
  return safeReplace(html, `"${fromJson}"`, `"${toJson}"`);
}

// Stale chunk insurance: chunk renames (content-hash rotation for the
// immutable `/_next/static` cache) must reach every HTML reference, including
// split-across-push flight refs that plain searches miss. A stale name 404s
// and Next.js dies with "Application error: a client-side exception has
// occurred". Same-length swaps, flight-aware — no-op when already clean.
// Runs at serve time so a regenerated dist/ (rebuild from scraped/) can never
// ship a desynced reference again.
const CHUNK_ROTATIONS = [
  ['7051-6e38258f27e823dd.js', '7051-f39c5f36163b0072.js'],
  ['7051-94cd094f4a3e8f0a.js', '7051-f3ed6d5164f253fc.js'],
  ['7172-1942429eed9ac7e3.js', '7172-4db4616175fc1cb4.js'],
  ['8809-c4e3ac275ea670ca.js', '8809-786367b29b78465e.js'],
  ['page-39444cf470c387d5.js', 'page-309422970545a739.js'],
  ['page-1086f123f968dd96.js', 'page-fd9d75e5d0bdf437.js'],
];
export function normalizeChunkRefs(html) {
  if (!html || html.indexOf('self.__next_f.push(') < 0) return html;
  // 1) contiguous refs (static markup, tails, whole pushes) — flight-aware.
  html = safeReplacePairs(html, CHUNK_ROTATIONS);
  // 2) refs split across push boundaries hide from plain searches: merge push
  // contents (order-preserving), swap, re-emit. Same-length swaps preserve
  // byte counts by construction; remaining pushes are emptied (same shape
  // applyOnePair uses for cross-push payloads).
  const delim = 'self.__next_f.push(';
  const parts = html.split(delim);
  const segs = [];
  for (let i = 1; i < parts.length; i++) {
    const m = /^\[(\d+),"/.exec(parts[i]);
    if (!m) return html; // unexpected shape: leave untouched
    let j = m[0].length;
    while (j < parts[i].length) {
      if (parts[i][j] === '\\') { j += 2; continue; }
      if (parts[i][j] === '"') break;
      j++;
    }
    if (j >= parts[i].length) return html;
    segs.push({ prefix: parts[i].slice(0, m[0].length), content: parts[i].slice(m[0].length, j), suffix: parts[i].slice(j) });
  }
  const joined = segs.map((s) => s.content).join('');
  let fixed = joined;
  let needs = false;
  for (const [from, to] of CHUNK_ROTATIONS) {
    if (fixed.includes(from)) { fixed = fixed.split(from).join(to); needs = true; }
  }
  if (!needs) return html;
  // Same-length swaps: byte counts are preserved by construction. Push order
  // is unchanged; remaining pushes are emptied (same shape applyOnePair uses
  // for cross-push payloads).
  let out = parts[0] + delim + segs[0].prefix + fixed + segs[0].suffix;
  for (let k = 1; k < segs.length; k++) out += delim + segs[k].prefix + '' + segs[k].suffix;
  return out;
}

// StillCraft IA inside flight vdom (CMS menu data React actually renders).
// Operates on flight pushes only; static markup is handled by NAV_LABELS/applyMenuOrder.
const EQ = '\\"'; // an escaped quote as it appears raw in flight HTML
// Global contact/social swaps: unique tokens, safe in static HTML and flight data.
const GLOBAL_SWAPS = [
  ['/projects/filter', '/projects'],
  ['info@iventions.com', 'info@stillcraftevents.co.ke'],
  ['https://www.linkedin.com/company/iventions', 'https://www.facebook.com/people/StillCraft-Events-Co/100079965229476'],
  ['https://www.instagram.com/iventions_events', 'https://www.instagram.com/stillcraftevents'],
  ['https://www.instagram.com/iventions', 'https://www.instagram.com/stillcraftevents'],
  ['+34 933 028 640', '+254 792 234 337'],
  ['+44 (0)7563 453 763', '+254 755 959 236'],
  ['Av. Diagonal 433, 4-2', 'Piedmont, 671 Ngong Road'],
  ['Av. Diagonal, 433, 4-2', 'Piedmont, 671 Ngong Road'],
  ['StillCraft Events International Events', 'StillCraft Events Co.'],
  ['StillCraft Events Co. International Events', 'StillCraft Events Co.'],
  // Footer Connect: href now points at Facebook, so the label must follow.
  ['>LinkedIn<', '>Facebook<'],
  [`"title":"LinkedIn"`, `"title":"Facebook"`],
  [/Copyright [©\uFFFD\xa9] Iventions/g, 'Copyright © StillCraft Events Co.'],
  // Meta/SEO: Barcelona → Nairobi
  ['Barcelona-based event agency delivering large-scale events, professional congresses, seamless destination management, and unique exhibitions', 'Nairobi-based event agency delivering mall activations, brand experiences, corporate events and exhibitions across Kenya'],
  ['Looking for an international event agency? One partner for events, exhibitions,', 'Looking for a Nairobi-based event agency? One partner for mall activations, brand experiences,'],
  ['Looking for an event marketing agency? We create exhibitions, brand activations', 'Looking for a brand activation agency? We create mall programmes, brand activations'],
  ['Looking for a trade show marketing agency? We design and build exhibition stands', 'Looking for a malls & retail agency? We design and deliver mall programmes'],
  ['Meet StillCraft Events, the global event agency behind powerful brand moments an', 'Meet StillCraft Events, the Nairobi-based agency behind powerful brand moments an'],
  ['Barcelona', 'Nairobi'],
  ['WHY DOES IVENTIONS', 'WHY DOES STILLCRAFT'],
  ['WHY DOES Iventions', 'WHY DOES STILLCRAFT'],
  ['Iventions', 'StillCraft Events Co.'],
  ['IVENTIONS', 'STILLCRAFT'],
  ['iventions', 'stillcraft'],
  // CMS accent fields (unique tokens; prose never contains raw hex codes)
  ['#546162', '#1B2A4A'],
  ['#ddd9ff', '#C9A24B'],
  ['#608ff3', '#C9A24B'],
  ['"#f7ffdc"', '"#F5F1EC"'],
];
// Footer office details: static markup uses footer-only div classes, flight
// uses addressLine/city keys, so neither form collides with project locations.
const FOOTER_DIV = 'div[^<>]*class="Paragraph_paragraph__SId_Y css-cgpd9q"[^<>]*';
const FOOTER_STATIC = [
  ['Barcelona, Spain', 'Nairobi, Kenya'],
  ['Nairobi, Spain', 'Nairobi, Kenya'],
  ['19 Eastbourne Terrace,', 'info@stillcraftevents.co.ke'],
  ['London W2 6LG.', '+254 755 959 236'],
  ['United Kingdom', 'Kenya'],
  ['Av. Diagonal 433, 4-2', 'Piedmont, 671 Ngong Road'],
  ['Av. Diagonal, 433, 4-2', 'Piedmont, 671 Ngong Road'],
];
const FOOTER_SVG_CLASS = 'Footer_footer_text__01STx';
const FOOTER_FLIGHT = [
  [`"city":"Barcelona"`, `"city":"Nairobi"`],
  [`"city":"London"`, `"city":"Contact"`],
  [`"addressLine3":"Barcelona, Spain"`, `"addressLine3":"Nairobi, Kenya"`],
  [`"addressLine3":"Nairobi, Spain"`, `"addressLine3":"Nairobi, Kenya"`],
  [`"addressLine1":"19 Eastbourne Terrace,"`, `"addressLine1":"info@stillcraftevents.co.ke"`],
  [`"addressLine2":"London W2 6LG."`, `"addressLine2":"+254 755 959 236"`],
  [`"addressLine3":"United Kingdom"`, `"addressLine3":"Kenya"`],
  [`|Barcelona, Spain|`, `|Nairobi, Kenya|`],
  [`|Nairobi, Spain|`, `|Nairobi, Kenya|`],
  [`19 Eastbourne Terrace,|London W2 6LG.|United Kingdom|+44 (0)7563 453 763`, `info@stillcraftevents.co.ke|+254 755 959 236|Kenya|+254 755 959 236`],
  [`"children":"Barcelona, Spain"`, `"children":"Nairobi, Kenya"`],
  [`"children":"Nairobi, Spain"`, `"children":"Nairobi, Kenya"`],
  [`"children":"19 Eastbourne Terrace,"`, `"children":"info@stillcraftevents.co.ke"`],
  [`"children":"London W2 6LG."`, `"children":"+254 755 959 236"`],
  [`"children":"United Kingdom"`, `"children":"Kenya"`],
  // surviving (first) card: template Barcelona office → canonical Nairobi set
  [`Iventions International Events`, `Piedmont, 671 Ngong Road`],
  [`Av. Diagonal 433, 4-2`, ``],
  [`Av. Diagonal, 433, 4-2`, ``],
  [`+34 933 028 640`, `+254 792 234 337`],
];
function applyFooterAddresses(html) {
  for (const [text, to] of FOOTER_STATIC) {
    const esc = text.replace(/[.*+?${}()|[\]\\]/g, '\\$&');
    html = html.replace(
      new RegExp('(<' + FOOTER_DIV + '>)' + esc + '(</div>)', 'g'),
      (m, open, close) => open + to + close
    );
  }
  const svgStart = html.indexOf(FOOTER_SVG_CLASS);
  if (svgStart >= 0) {
    const tagOpen = html.lastIndexOf('<svg', svgStart);
    const tagClose = html.indexOf('</svg>', svgStart);
    if (tagOpen >= 0 && tagClose > tagOpen) {
      const end = tagClose + '</svg>'.length;
      html = html.slice(0, tagOpen) +
        html.slice(tagOpen, end).split('fill="#1E1E1E"').join('fill="#F5F1EC"') +
        html.slice(end);
    }
  }
  const P = [];
  for (const [from, to] of FOOTER_FLIGHT) {
    P.push([from, to]);
    const fe = from.split('"').join('\\"');
    const te = to.split('"').join('\\"');
    if (fe !== from) P.push([fe, te]);
  }
  return P.length ? safeReplacePairs(html, P) : html;
}
// Home-page hero reel: point the flight's Vimeo URLs at the StillCraft hero
// clip. Default is the Cloudinary link (fast CDN, no local bandwidth); an
// admin can override it per deploy via brand hero_video_src or the Insider
// CMS hero section (DB wins over this constant). Works pre + post hydration.
//
// Mobile gets its own lightweight rendition (2.1MB vs 13.5MB): on phones the
// full clip stalls the hero loader behind a blank section, so reelMobileUrl
// points at a q_auto,w_640 transcode + reelPosterUrl at an instant jpg poster.
const HERO_VIDEO = HERO_VIDEO_URL;
function resolveHeroUrl(override) {
  const u = String(override || '').trim();
  if (u && /^https?:\/\//.test(u)) return u;
  if (u && u.startsWith('/')) return u;
  return HERO_VIDEO;
}
// Derive the lightweight mobile rendition for a Cloudinary video URL.
// Non-Cloudinary URLs (or already-transformed ones) are returned unchanged.
function mobileFor(url) {
  const u = String(url || '').trim();
  const i = u.indexOf('/video/upload/');
  if (!u || i < 0) return u || HERO_VIDEO_MOBILE_URL;
  const tail = u.slice(i + '/video/upload/'.length);
  if (/^[a-z]+_[^/]*\//i.test(tail) || /^[^/]*,[^/]*\//.test(tail)) return u; // already transformed
  return u.slice(0, i + '/video/upload/'.length) + 'q_auto,w_640/' + tail;
}
// Instant first-frame poster for a Cloudinary video URL ('' = leave as-is).
function posterFor(url) {
  const u = String(url || '').trim();
  const i = u.indexOf('/video/upload/');
  if (!u || i < 0) return '';
  const head = u.slice(0, i + '/video/upload/'.length);
  let tail = u.slice(i + '/video/upload/'.length);
  tail = tail.replace(/^([a-z]+_[^/]*\/|[^/,]*,[^/]*\/)/i, ''); // strip existing transform
  tail = tail.replace(/\.[a-z0-9]+$/i, '.jpg');
  if (!/\//.test(tail)) return '';
  return head + 'so_0,w_1280,q_auto/' + tail;
}
function applyHeroVideo(html, desktop, mobile, poster) {
  const dUrl = resolveHeroUrl(desktop);
  const mUrl = resolveHeroUrl(mobile || mobileFor(dUrl));
  const pUrl = String(poster || posterFor(dUrl)).trim();
  const jobs = [['reelUrl', dUrl], ['reelMobileUrl', mUrl]];
  if (pUrl) jobs.push(['reelPosterUrl', pUrl]);
  for (const [key, url] of jobs) {
    const needle = key + '\\":\\"'; // raw flight: key":"...
    let cursor = 0;
    while (true) {
      const from = html.indexOf(needle, cursor);
      if (from < 0) break;
      const start = from + needle.length;
      const end = html.indexOf('\\"', start);
      if (end <= start) break;
      html = html.slice(0, start) + url + html.slice(end);
      cursor = start + url.length;
    }
  }
  // The SSR <video> still points at the donor's Vimeo progressive URL while
  // hydration swaps it to the Cloudinary URL above: the browser downloads
  // BOTH (~35MB). Align the static tag to the same URL hydration sets, so
  // there is exactly one download and no reload on match. Same for the
  // poster (Vimeo thumb vs Cloudinary frame).
  if (dUrl) {
    html = html.replace(/(<video\b[^<>]*\ssrc=")https:\/\/player\.vimeo\.com[^"]*(")/gi, '$1' + dUrl + '$2');
  }
  if (pUrl) {
    html = html.replace(/(<video\b[^<>]*\sposter=")https:\/\/i\.vimeocdn\.com[^"]*(")/gi, '$1' + pUrl + '$2');
  }
  return html;
}
function applyGlobalSwaps(html, page) {
  if (process.env.SC_NOSWAPS) return html;
  // Legal pages have no below-root error boundary and carry length-framed
  // text blobs: any blob byte change fatals them, so their blobs stay frozen.
  const frozen = page === '/cookie-policy' || page === '/privacy-policy' || page === '/legal-notice-terms-of-use';
  if (frozen) return html;
  const P = [];
  // (regex form expanded to literals so flight rows stay length-synced)
  P.push(['Copyright © Iventions', 'Copyright © StillCraft Events Co.']);
  P.push(['Copyright � Iventions', 'Copyright © StillCraft Events Co.']);
  P.push(['Copyright \\u00a9 Iventions', 'Copyright © StillCraft Events Co.']);
  P.push(['Copyright \\ufffd Iventions', 'Copyright © StillCraft Events Co.']);
  for (const [from, to] of GLOBAL_SWAPS) {
    if (typeof from !== 'string') continue;
    P.push([from, to]);
    const slash = [from.split('/').join('\\/'), to.split('/').join('\\/')];
    if (slash[0] !== from) P.push(slash);
    const esc = [from.split('"').join('\\"'), to.split('"').join('\\"')];
    if (esc[0] !== from) P.push(esc);
  }
  return P.length ? safeReplacePairs(html, P) : html;
}
// Kenyan legal rewrite: the Legal / Privacy / Cookie pages are frozen for
// GLOBAL_SWAPS (length-framed blobs), so they kept the Spanish entity, tax
// ID, addresses, phones, socials and Barcelona meta. This length-synced pass
// rewrites them as standalone StillCraft Events Co. (Nairobi) documents.
export function applyLegalFix(html) {
  const P = [
    ['pursuant to Spanish Law', 'pursuant to the laws of Kenya'],
    ['pursuant to Spanish law', 'pursuant to the laws of Kenya'],
    ['This website is the property of StillCraft Events Co., tax identification number B65280398 with its registered address at Av. Diagonal, 433, 4-2, 08036 in Nairobi, Spain',
     'This website is the property of StillCraft Events Co., with its registered address at Piedmont, 671 Ngong Road, Nairobi, Kenya'],
    ['Registration Data: Volume: 41761, Page: 171, Sheet: B 396052, registration 1st', 'Registered in Nairobi, Kenya'],
    ['StillCraft Events Co. International Events SLU.', 'StillCraft Events Co.'],
    ['StillCraft Events Co. International Events SLU', 'StillCraft Events Co.'],
    ['StillCraft Events Co. International Events', 'StillCraft Events Co.'],
    ['StillCraft International Events,', 'StillCraft Events Co.,'],
    ['StillCraft International Events ', 'StillCraft Events Co. '],
    ['StillCraft International Events', 'StillCraft Events Co.'],
    ['Iventions International Events, S.L.U.', 'StillCraft Events Co.'],
    ['Iventions International Events S.L.U.', 'StillCraft Events Co.'],
    ['International Events SLU', 'Events Co.'],
    ['International Events S.L.U.', 'Events Co.'],
    [', S.L.U.', ''],
    ['S.L.U.', ''],
    [' SLU.', '.'],
    [' SLU', ''],
    ['B65280398', ''],
    ['identified by tax identification number  , with address', 'with its office'],
    ['tax identification number  ,', ''],
    ['tax identification number ,', ''],
    ['tax identification number  with', 'with'],
    ['tax identification number with', 'with'],
    ['Av. Diagonal, 433, 4-2, 08036', 'Piedmont, 671 Ngong Road'],
    ['Av. Diagonal 433, 4-2', 'Piedmont, 671 Ngong Road'],
    ['08036', '00100'],
    ['from its offices in Spain', 'from its offices in Nairobi, Kenya'],
    ['in accordance with Spanish legislation', 'in accordance with the laws of Kenya'],
    ['Spanish legislation', 'the laws of Kenya'],
    ['Spanish Law', 'Kenyan law'],
    ['The courts and tribunals of the city of Nairobi, Spain, shall have exclusive jurisdiction', 'The courts and tribunals of the city of Nairobi, Kenya, shall have exclusive jurisdiction'],
    ['Nairobi, Spain', 'Nairobi, Kenya'],
    ['WHY DOES IVENTIONS USE THESE COOKIES?', 'WHY DOES STILLCRAFT USE THESE COOKIES?'],
    ['WHY DOES STILLCRAFT EVENTS USE THESE COOKIES?', 'WHY DOES STILLCRAFT USE THESE COOKIES?'],
    ['WHY DOES Iventions USE THESE COOKIES?', 'WHY DOES STILLCRAFT USE THESE COOKIES?'],
    ['info@iventions.com', 'info@stillcraftevents.co.ke'],
    ['+34 933 028 640', '+254 792 234 337'],
    ['+44 (0)7563 453 763', '+254 755 959 236'],
    ['https://www.linkedin.com/company/iventions', 'https://www.facebook.com/people/StillCraft-Events-Co/100079965229476'],
    ['https://www.instagram.com/iventions_events', 'https://www.instagram.com/stillcraftevents'],
    ['https://www.instagram.com/iventions', 'https://www.instagram.com/stillcraftevents'],
    ['>LinkedIn<', '>Facebook<'],
    [`"title":"LinkedIn"`, `"title":"Facebook"`],
    ['Barcelona-based event agency delivering large-scale events, professional congresses, seamless destination management, and unique exhibitions', 'Nairobi-based event agency delivering mall activations, brand experiences, corporate events and exhibitions across Kenya'],
    ['Barcelona', 'Nairobi'],
    ['WHY DOES IVENTIONS', 'WHY DOES STILLCRAFT'],
    ['Iventions', 'StillCraft Events Co.'],
    ['IVENTIONS', 'STILLCRAFT'],
    ['iventions', 'stillcraft'],
    ['Spain', 'Kenya'],
  ];
  return safeReplacePairs(html, P);
}
const linkObj = (title, url) =>
  `{${EQ}link${EQ}:{${EQ}target${EQ}:${EQ}${EQ},${EQ}title${EQ}:${EQ}${title}${EQ},${EQ}url${EQ}:${EQ}${url}${EQ}}}`;
// Menu links are dropped by URL, never by title. A title-keyed drop fails
// silently when the CMS renames an item: "Congresses" and "Work" sat in the
// hydrated header and footer for exactly that reason while the static markup
// looked correct, because the drop list was still looking for the older
// "Space Activation" and "Projects" labels.
// dist pages disagree about the origin baked into their flight payload: the
// homepage still carries the donor's, while every other page was rewritten to
// the live host by an earlier sweep. Anything keyed to a single hard-coded
// ORIGIN therefore silently no-ops off the homepage, which is how the header
// and footer drifted apart page to page. Read it from the document instead.
function flightOrigin(html) {
  const m = new RegExp(EQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 'url' +
    EQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':' +
    EQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(https?://[^\\\\/]+)/(?:home|about)/').exec(html);
  return m ? m[1] : ORIGIN;
}
function findMenuLinkObjs(html, path) {
  const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    '\\{' + esc(EQ) + 'link' + esc(EQ) + ':\\{' + esc(EQ) + 'target' + esc(EQ) + ':' + esc(EQ) + esc(EQ) + ',' +
    esc(EQ) + 'title' + esc(EQ) + ':' + esc(EQ) + '[^\\\\]*?' + esc(EQ) + ',' +
    esc(EQ) + 'url' + esc(EQ) + ':' + esc(EQ) + '(?:https?://[^\\\\/]*)?' + esc(path) + esc(EQ) + '\\}\\}', 'g');
  return [...new Set(html.match(re) || [])];
}
const ORIGIN = 'https://iventions.com';
// Absolute site URLs (meta og:url, share links) must point at the host that
// actually serves the site. Rewritten per request; length-synced for flight.
function applyLinks(html, host, page) {
  const fullHost = String(host || '').split(',')[0].trim();
  if (!fullHost) return html;
  const encHost = encodeURIComponent(fullHost);
  const P = [];
  // og:url carries the bare origin: expand to the full current page URL first
  // (must run before the generic host swap below).
  P.push([`content="https://iventions.com"`, `content="https://${fullHost}${page === '/' ? '/' : page}"`]);
  P.push([`content=\\"https://iventions.com\\"`, `content=\\"https://${fullHost}${page === '/' ? '/' : page}\\"`]);
  P.push(['https://iventions.com', `https://${fullHost}`]);
  P.push(['https%3A%2F%2Fiventions.com', `https%3A%2F%2F${encHost}`]);
  P.push(['http%3A%2F%2Fiventions.com', `https%3A%2F%2F${encHost}`]);
  // GLOBAL_SWAPS turns bare iventions hosts into stillcraft.com before this
  // runs — catch those too so og:url never points at stillcraft.com.
  P.push([`content="https://stillcraft.com"`, `content="https://${fullHost}${page === '/' ? '/' : page}"`]);
  P.push([`content=\\"https://stillcraft.com\\"`, `content=\\"https://${fullHost}${page === '/' ? '/' : page}\\"`]);
  P.push(['https://stillcraft.com', `https://${fullHost}`]);
  P.push(['https%3A%2F%2Fstillcraft.com', `https%3A%2F%2F${encHost}`]);
  P.push(['http%3A%2F%2Fstillcraft.com', `https%3A%2F%2F${encHost}`]);
  html = safeReplacePairs(html, P);
  return applyCanonical(html, fullHost, page);
}
// rel=canonical states which URL is the real one for a page, so neither the
// donor's canonical nor the stillcraft.com stand-in this file rewrites above
// can be inherited. Injected here because applyLinks is the only pass that
// knows the real host and path. /insider is excluded: it is the private CMS,
// and asking a search engine to index a login page is wrong.
function applyCanonical(html, host, page) {
  if (page === '/insider' || page === '/insider/') return html;
  if (/<link[^>]+rel="canonical"/i.test(html)) return html;
  // Static <head> only. Flight rows are length-prefixed, so a tag injected
  // into the payload would desync the stream; the static copy is what
  // crawlers actually read.
  if (!/<\/head>/i.test(html)) return html;
  const path = page === '/' || !page ? '/' : page;
  return html.replace(/<\/head>/i, `<link rel="canonical" href="https://${host}${path}">\n$&`);
}
const MENU_DROP_URLS = ['/service/sports/', '/insights/', '/projects/'];
const MENU_DROP_TITLES = { '/service/sports/': 'Sports', '/insights/': 'Insights', '/projects/': 'Projects' };
const MENU_TITLES = { About: 'About', Events: 'Brand Activations', Exhibits: 'Mall Calendar Programming', Congresses: 'Mall Space Monetization', Sports: 'Our Work' };
function applyFlightIA(html) {
  // All replacements run through the length-synced replacer: menu JSON rows
  // are plain edits, while anything landing inside a length-prefixed flight
  // row (e.g. article HTML) gets its hex length recomputed instead of
  // corrupting the stream ("Application error ... Connection closed").
  const origin = flightOrigin(html);
  const homeObj = linkObj('Home', origin + '/home/');
  const brandObj = linkObj('Brand Activations', origin + '/service/events/');
  const retailObj = linkObj('Mall Calendar Programming', origin + '/service/exhibits/');
  const monetObj = linkObj('Mall Space Monetization', origin + '/service/congresses/');
  const P = [
    // 0) service entity titles drive the page headlines (menu keeps short
    // labels). Must run before the menu rename below (same original values).
    [`"slug":"events","title":"Events"`, `"slug":"events","title":"Brand Activations"`],
    [`\\"slug\\":\\"events\\",\\"title\\":\\"Events\\"`, `\\"slug\\":\\"events\\",\\"title\\":\\"Brand Activations\\"`],
    [`"slug":"exhibits","title":"Exhibits"`, `"slug":"exhibits","title":"Mall Calendar Programming"`],
    [`\\"slug\\":\\"exhibits\\",\\"title\\":\\"Exhibits\\"`, `\\"slug\\":\\"exhibits\\",\\"title\\":\\"Mall Calendar Programming\\"`],
    [`"slug":"congresses","title":"Congresses"`, `"slug":"congresses","title":"Mall Space Monetization"`],
    [`\\"slug\\":\\"congresses\\",\\"title\\":\\"Congresses\\"`, `\\"slug\\":\\"congresses\\",\\"title\\":\\"Mall Space Monetization\\"`],
  ];
  // 1) drop Sports / Insights / Projects link objects
  // (object + trailing comma). About is kept (main + footer nav).
  for (const u of MENU_DROP_URLS) {
    for (const obj of findMenuLinkObjs(html, u)) {
      P.push([obj + ',', '']);  // mid-array
      P.push([',' + obj, '']);  // last entry, no trailing comma
    }
  }
  // 2) rename remaining titles (skip About: dropped above; Home stays)
  for (const [from, to] of Object.entries(MENU_TITLES)) {
    if (from === 'About') continue;
    P.push([`${EQ}title${EQ}:${EQ}${from}${EQ}`, `${EQ}title${EQ}:${EQ}${to}${EQ}`]);
  }
  // 3) prepend Home to header menus (footer already starts with Home).
  // Header flight starts with About (kept), so anchor on the About object.
  const aboutObj = linkObj('About', origin + '/about/');
  P.push([`${EQ}menus${EQ}:[${aboutObj}`, `${EQ}menus${EQ}:[${homeObj},${aboutObj}`]);
  // 4) order the three service lanes: Mall Calendar Programming, Mall Space
  // Monetization, Brand Activations (raw CMS order is Events, Exhibits,
  // Congresses, so post-rename the sequence needs two adjacent swaps).
  P.push([brandObj + ',' + retailObj, retailObj + ',' + brandObj]);
  P.push([brandObj + ',' + monetObj, monetObj + ',' + brandObj]);
  // 5) localize CMS link targets (LinkedIn/Instagram untouched)
  P.push([origin + '/', '/']);
  if (origin !== ORIGIN) P.push([ORIGIN + '/', '/']);
  // 6) trailing brand mentions in values ("... | Iventions")
  P.push([` Iventions${EQ}`, ` StillCraft Events${EQ}`]);
  P.push([` IVENTIONS${EQ}`, ` STILLCRAFT EVENTS${EQ}`]);
  return safeReplacePairs(html, P);
}

// Insights/blog section removed (client killed the blog): cut the whole
// "Inside StillCraft Events" block (heading + article cards) from static
// HTML and from the RSC flight tuple. Presence-guarded; any structural
// surprise bails with html untouched, and a flight-oracle regression reverts.
function cutBalancedDiv(html, start) {
  let depth = 0;
  let i = start;
  while (i < html.length) {
    if (html.startsWith('</div', i) && /[\s>]/.test(html[i + 5] || '')) {
      const gt = html.indexOf('>', i);
      if (gt < 0) return -1;
      depth--;
      i = gt + 1;
      if (depth === 0) return i;
    } else if (html.startsWith('<div', i) && /[\s>]/.test(html[i + 4] || '')) {
      const gt = html.indexOf('>', i);
      if (gt < 0) return -1;
      if (html[gt - 1] !== '/') depth++;
      i = gt + 1;
    } else {
      i++;
    }
  }
  return -1;
}
// Script-aware search: Next.js flight payloads embed escaped copies of page
// text (e.g. "Join our team", "</section>" inside strings). Cutting at a
// match that lives INSIDE a <script> block corrupts the flight JS and blanks
// the page (React fails to parse). These helpers only match static markup.
function insideScript(html, i) {
  const open = html.lastIndexOf('<script', i);
  if (open < 0) return false;
  const gt = html.indexOf('>', open);
  if (gt < 0 || gt > i) return false;
  const close = html.indexOf('</script>', gt);
  return close < 0 || close > i;
}
function staticIndexOf(html, needle, from) {
  let i = html.indexOf(needle, from || 0);
  while (i >= 0 && insideScript(html, i)) i = html.indexOf(needle, i + 1);
  return i;
}
function staticLastIndexOf(html, needle, from) {
  let i = html.lastIndexOf(needle, from);
  while (i >= 0 && insideScript(html, i)) i = html.lastIndexOf(needle, i - 1);
  return i;
}
function cutFlightTuple(html, open) {
  // open at '[' of ["$",type,key,props]; string-aware bracket balance.
  let depth = 0;
  let inStr = false;
  // Flight tuples live inside a push-string, so every quote is written as \".
  // A backslash escapes the next character whether or not we are inside a
  // string; without that, each \" flips inStr and the bracket count drifts.
  for (let i = open; i < html.length; i++) {
    const c = html[i];
    if (c === '\\') { i++; continue; }
    if (inStr) {
      if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
    } else if (c === '[') {
      depth++;
    } else if (c === ']') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}
// The donor homepage "Inside Iventions" band is a 3-card insights carousel.
// The blog is retired, so the band becomes a case-study teaser: the same
// heading/CTA/card DOM is reused and only the copy changes. Reusing the DOM
// (rather than injecting a new subtree) is what keeps the static HTML and the
// RSC flight rows describing the same tree, so hydration stays clean.
//
// Every replacement below is a whole visible string, and each donor string
// occurs in both the static markup and the flight payload, so one blind
// split/join per pair covers both surfaces. Guards abort the whole pass if a
// donor string is missing or ambiguous, so a donor copy change can never leave
// a half-rewritten band behind.
const TEASER_CASES = ['easter-at-galleria-mall', 'mothers-day-at-galleria-mall', 'christmas-at-westgate-mall'];

// The testimonial carousel prints a detail grid under every quote
// (participants / industry / event type / location). Those four fields came
// straight from the donor's own testimonials, so the strip under each quote
// still advertised donor sectors and donor cities - "Football",
// "Pharmaceutical", "Udine", "Istanbul, Turkey" - next to StillCraft quotes.
//
// Each slide maps to one case in the library (PLACEHOLDER_TESTIMONIALS is
// built by indexing CASE, so slide n is CASE[n]), so the grid is rewritten
// from the case data. The pass is scoped to the grid's own value list
// (css-h3wi0l) so it cannot touch the quote, the name, or the role, which
// share the same value styling one section further down.
function applyTestimonialBandFix(html) {
  if (html.indexOf('css-1kjo4sp') < 0) return html;
  const pairs = [];
  // The donor published this band as four label groups, each holding one value
  // per slide in slide order - so value N of every group belongs to the same
  // slide. Rewrite column-wise against the case list.
  const LABEL = /class="css-qg5m4o">([^<]+)</g;
  const VALUE = /class="css-1kjo4sp"[^>]*>([^<]+)</g;
  const marks = [];
  let m;
  while ((m = LABEL.exec(html))) marks.push({ i: m.index, end: LABEL.lastIndex, label: m[1].trim().toLowerCase() });
  while ((m = VALUE.exec(html))) marks.push({ i: m.index, value: m[1] });
  marks.sort((a, b) => a.i - b.i);

  // The four published groups run first; the name/role/company chips that
  // follow share the same value styling and must be left untouched.
  const GROUPS = ['participants', 'industry', 'event type', 'location'];
  const columns = new Map();
  let group = '';
  let col = 0;
  for (const k of marks) {
    if (k.label != null) {
      group = k.label;
      col = 0;
      continue;
    }
    const at = GROUPS.indexOf(group);
    if (at === -1) continue;
    const c = CASE[col];
    col++;
    if (!c) continue;
    const value = {
      participants: c.participants.toLocaleString('en-US'),
      industry: c.industry,
      'event type': c.eventType,
      location: c.location,
    }[group];
    if (!value || k.value === value) continue;
    pairs.push([k.i, k.value, value]);
  }

  if (!pairs.length) return html;
  // Only the static markup is rewritten. These chips also appear inside the
  // RSC payload, where a changed length would invalidate the row's length
  // prefix, so the pass is confined to the part of the document before the
  // first flight push and the flight is checked afterwards.
  const flightAt = html.indexOf('self.__next_f.push(');
  let out = html;
  for (let i = pairs.length - 1; i >= 0; i--) {
    const [pos, from, to] = pairs[i];
    if (flightAt >= 0 && pos > flightAt) continue;
    const start = out.indexOf(from, pos);
    if (start < 0) continue;
    out = out.slice(0, start) + teaserEscape(to) + out.slice(start + from.length);
  }
  return out;
}

// Split a heading into exactly n lines, so the existing line-div count (and
// therefore the DOM shape) is preserved. Short text is padded with empty lines
// rather than returning fewer entries, so callers can index blindly.
function teaserLines(text, n) {
  const words = String(text).split(' ').filter(Boolean);
  if (n <= 1 || words.length <= 1) return Array(n).fill('').map((_, i) => (i === 0 ? String(text) : ''));
  const per = Math.ceil(words.length / n);
  const out = [];
  for (let i = 0; i < words.length; i += per) out.push(words.slice(i, i + per).join(' '));
  // Merge the tail so we never exceed the donor's line count.
  while (out.length > n) {
    out[n - 2] += ' ' + out.pop();
  }
  while (out.length < n) out.push('');
  // Trailing spaces on all but the last line mirror the donor's line divs.
  return out.map((l, i) => (i < out.length - 1 && l ? l + ' ' : l));
}

function teaserEscape(s) {
  return String(s).split('&').join('&amp;');
}

// Encode a short HTML fragment the way the RSC payload stores one: the tag
// delimiters and the ampersand are \u-escaped, quotes are backslash-escaped,
// and newlines are the two-character sequence \n. Writing it by hand is how a
// replacement ends up as malformed JSON that React drops on hydration.
function flightHtmlString(text) {
  return '<p>' + teaserEscape(text) + '</p>'
    .split('&').join('\\u0026')
    .split('<').join('\\u003c')
    .split('>').join('\\u003e')
    .split('"').join('\\"');
}

function applyCaseTeaser(html) {
  if (html.indexOf('styles_invention__bakTB') < 0) return html;
  const P = [];
  // Pairs whose `from` must exist for the pass to be considered current. If
  // any is gone the donor copy changed and the whole pass is skipped.
  const REQ = [];
  const add = (from, to) => {
    if (!from || from === to) return;
    P.push([from, to]);
    REQ.push(from);
  };
  // Best-effort pair: applied only when the form is present. Used for strings
  // that appear in some surfaces (flight props) and not others.
  const addIf = (from, to) => {
    if (!from || from === to) return;
    P.push([from, to]);
  };

  // --- standfirst + CTA ---
  add(
    'Get insider tips, bold ideas, and future-forward trends, straight from the frontlines of unforgettable events.',
    'Mall programmes, holiday activations and brand experiences delivered by one team. A few of the recent ones.'
  );
  // The band's two CTA buttons both pointed at the retired blog listing. The
  // label appears as `>text<` in the static markup and as a bare string in
  // flight `children`/`title` props, so pair every form. /insights is also
  // still a plain href string in flight props (not just an attribute), written
  // there with escaped quotes, so both quote styles are paired.
  const EQ = String.fromCharCode(92) + '"'; // \" as it appears inside flight
  for (let i = 0; i < 4; i++) {
    addIf('>Explore our insights<', '>View all case studies<');
    addIf('"Explore our insights"', '"View all case studies"');
    addIf(`${EQ}Explore our insights${EQ}`, `${EQ}View all case studies${EQ}`);
    addIf('href="/insights"', 'href="/case-studies"');
    addIf(`${EQ}href${EQ}:${EQ}/insights${EQ}`, `${EQ}href${EQ}:${EQ}/case-studies${EQ}`);
    addIf('"url":"https://iventions.com/insights"', '"url":"/case-studies"');
    addIf('"url":"https://iventions.com/insights/"', '"url":"/case-studies"');
    // The donor pointed this CTA at its uploads directory, not at a listing, so
    // the label was reworded to "View all case studies" but the href stayed on
    // /assets/cms/resource/ and 404'd. Left as-is it was the band\'s only link.
    addIf('href="/assets/cms/resource/"', 'href="/case-studies"');
    addIf(`${EQ}url${EQ}:${EQ}/assets/cms/resource/${EQ}`, `${EQ}url${EQ}:${EQ}/case-studies${EQ}`);
  }

  // --- one case per donor card ---
  //
  // The donor strings are read back out of the band rather than hardcoded:
  // the live pipeline rebrands the page (donor "Iventions" becomes
  // "StillCraft Events") before this pass runs, so literal donor copy would
  // no longer match. Reading the rendered band keeps this correct across both
  // the raw build input and the rebranded served output.
  const sOpen = html.indexOf('<div class="styles_invention__bakTB');
  if (sOpen < 0) return html;
  const sEnd = cutBalancedDiv(html, sOpen);
  if (sEnd < 0) return html;
  const band = html.slice(sOpen, sEnd);

  // Band heading: the donor's two span halves become "Case" / "Studies". The
  // second half is read from the band (not hardcoded) because the live
  // pipeline has already rebranded the donor brand name by this point.
  //
  // The pair is anchored on the heading's own tag so it can only ever match
  // the heading. A bare brand-name pair would also match the same word where
  // it appears inside a card body, and replace it with "Studies" there.
  const head = band.slice(0, band.indexOf('styles_item__OXawi') < 0 ? band.length : band.indexOf('styles_item__OXawi'));
  const headSpans = [...head.matchAll(/>([^<>{}]{2,})</g)].map(m => m[1])
    .filter(t => t.trim() && t !== '&nbsp;' && !/insider tips/i.test(t) && !/^Explore our insights$/.test(t));
  const h2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/.exec(head);
  if (headSpans.length >= 2 && h2) {
    add(`>${headSpans[0]}</span>`, '>Case</span>');
    add(`>${headSpans[1]}</span>`, '>Studies</span>');
  }

  // Card boundaries: each donor card is a styles_item__OXawi block. Slice the
  // band from the first card marker to the end of the cards.
  const firstCard = band.indexOf('styles_item__OXawi');
  if (firstCard < 0) return html;
  const cards = band.slice(firstCard).split('styles_item__OXawi').slice(1);
  if (cards.length !== 3) return html;

  // Matching flight view of the same band. The RSC payload keeps the three
  // card bodies as escaped HTML (\u003c for <) inside a single T row, and that
  // row is a pre-rebrand copy of the donor copy, so its wording can differ
  // from the static HTML. Decode the row, split it per card on the donor date
  // labels, and pair each card's prose with that card's excerpt.
  //
  // Reading the row (rather than scanning a window around it) is what keeps
  // this exact: a window picks up unrelated paragraphs, and a card body that
  // only partly matches leaves donor copy behind in the row that hydration
  // then re-renders.
  // The card bodies live in a T row that is emitted *before* the band's own
  // flight tuple, so the window has to start before the band marker. The row
  // holds only the bodies (no date labels), so each card is located by the
  // opening words of its first paragraph.
  const fIdx = html.indexOf(`${EQ}styles_invention__bakTB${EQ}`);
  const flightCardHtml = [];
  {
    const from = Math.max(0, fIdx - 80000);
    const win = html.slice(from, fIdx + 60000)
      .split('\\u003c').join('<').split('\\u003e').join('>')
      .split('\\u0026').join('&');
    // First words of each card's opening body paragraph, read from the static
    // markup. Long enough to be unambiguous, short enough to survive the
    // rebrand (which only touches brand names, not sentence openings).
    const marks = cards.map(cardHtml => {
      const ps = [...cardHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)];
      for (const p of ps) {
        const words = [...p[1].matchAll(/>([^<>{}]{4,})</g)].map(x => x[1])
          .filter(t => t.trim() && !/^&nbsp;$/.test(t)).join(' ');
        if (words.length >= 40) return words.slice(0, 40);
      }
      return null;
    });
    if (marks.every(Boolean)) {
      const at = marks.map(s => win.indexOf(s));
      if (at.every(i => i >= 0) && at[0] < at[1] && at[1] < at[2]) {
        for (let k = 0; k < 3; k++) {
          flightCardHtml.push(win.slice(at[k], k + 1 < 3 ? at[k + 1] : at[k] + 8000));
        }
      }
    }
  }

  cards.forEach((cardHtml, i) => {
    const c = caseBySlug(TEASER_CASES[i]);
    if (!c) return;
    // Every visible text leaf in this card, in document order: the date
    // label, the wrapped title lines, then the body lines.
    const leaves = [...cardHtml.matchAll(/>([^<>{}]{2,})</g)]
      .map(m => m[1])
      .filter(t => t.trim() && t !== '&nbsp;');
    if (leaves.length < 3) return;

    const [date, ...rest] = leaves;
    // Title lines are the ones inside the heading's line divs.
    const titleCount = [...cardHtml.matchAll(/<div class="styles_line__Ausrd"[^>]*>([^<]*)<\/div>/g)].length;
    const bodyCount = rest.length - titleCount;
    if (titleCount < 1 || bodyCount < 1) return;

    // Date label -> the case's type and venue, so the slot still reads as a
    // label above the title.
    add(date, teaserEscape(c.eventType + ' · ' + c.location));
    // Card link -> the case detail page that already exists. Static markup
    // carries it as an href attribute; flight props carry it as a URL string,
    // sometimes escaped, sometimes absolute. The donor slug is read from the
    // card so a rebrand or path change cannot desync it.
    const href = /href="(\/insight\/[^"]+)"/.exec(cardHtml);
    if (href) {
      for (let k = 0; k < 3; k++) {
        addIf(`href="${href[1]}"`, `href="/project/${c.slug}"`);
        addIf(`${EQ}url${EQ}:${EQ}https://iventions.com${href[1]}${EQ}`, `${EQ}url${EQ}:${EQ}/project/${c.slug}${EQ}`);
        addIf(`${EQ}url${EQ}:${EQ}https://iventions.com${href[1]}/${EQ}`, `${EQ}url${EQ}:${EQ}/project/${c.slug}${EQ}`);
        addIf(`"url":"https://iventions.com${href[1]}"`, `"url":"/project/${c.slug}"`);
        addIf(`"url":"https://iventions.com${href[1]}/"`, `"url":"/project/${c.slug}"`);
      }
    }
    // Title: keep the donor's line count so the DOM shape is unchanged.
    const tLines = teaserLines(c.title, titleCount);
    for (let k = 0; k < titleCount; k++) add(rest[k], teaserEscape(tLines[k]));
    // Body: the excerpt wrapped to the donor's line count. Surplus donor
    // lines collapse to empty, which renders as blank lines rather than
    // overflowing the card.
    const bLines = teaserLines(c.excerpt, bodyCount);
    for (let k = 0; k < bodyCount; k++) {
      add(rest[titleCount + k], k < bLines.length ? teaserEscape(bLines[k]) : '');
    }

    // The flight stores this card's body as whole paragraphs rather than
    // line-break divs, so the per-line pairs above never match there. Pair
    // the flight copy's own paragraphs with the excerpt, so the RSC row
    // renders the same copy the static markup shows. These pairs are built
    // from the row's own text, which may still carry the donor brand name.
    const fCard = flightCardHtml[i] || '';
    for (const p of fCard.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)) {
      const text = [...p[1].matchAll(/>([^<>{}]{4,})</g)].map(x => x[1])
        .filter(t => t.trim() && !/^&nbsp;$/.test(t)).join(' ');
      if (text.length >= 12) addIf(text, teaserEscape(c.excerpt));
    }

    // Card heading carries an aria-label with the donor title as one string,
    // and the card's own link/href slug in several shapes. The label and slug
    // are not in the leaf list above, so pair them explicitly or the donor
    // title and /insight/ URL survive in the served markup.
    const aria = /aria-label="([^"]*)"/.exec(cardHtml);
    if (aria) addIf(`aria-label="${aria[1]}"`, `aria-label="${teaserEscape(c.title)}"`);
  });

  // The band's insights edges array still carries the three donor posts as
  // CMS nodes (slug, title, a whole donor article as body copy, and a
  // template). Nothing renders them now that the band is a case teaser, but
  // they still ship to the client and feed the admin manifest, so each node is
  // repointed at the teaser case in the same position.
  //
  // Each node is rewritten as ONE whole-node pair rather than as separate
  // field pairs. The body is a full article in escaped HTML, so a per-field
  // pair for it either matches nothing (leaving the article in place) or
  // matches after another pair has already mangled part of it, which is how
  // the excerpt ended up spliced into the middle of a donor sentence. Working
  // on the node as a unit means the replacement is exact or it does not
  // happen at all.
  try {
    for (const a of findEdgesArrays(html)) {
      const inner = html.slice(a.start + 1, a.end - 1);
      const nodes = splitTopObjects(inner);
      if (!nodes.length) continue;
      const first = inner.slice(nodes[0].start, nodes[0].end);
      if (!first.includes('insightTemplate')) continue;
      let ci = -1;
      for (const nd of nodes) {
        const nodeHtml = inner.slice(nd.start, nd.end);
        const sm = /\\"slug\\":\\"([^\\]*)\\"/.exec(nodeHtml);
        if (!sm) continue;
        ci++;
        const target = caseBySlug(TEASER_CASES[ci]);
        if (!target) continue;
        let next = nodeHtml;
        // Replace the body first, while every offset below still refers to
        // nodeHtml. The slug and title edits change the string length, and
        // slicing the body afterwards with stale offsets spliced the new copy
        // in without removing the old article.
        // The value runs to the comma that starts the next key, and that slice
        // also picks up the escaped quote that terminates the JSON string, so
        // drop it or the row stops parsing.
        const cm = /\\"content\\":\\"/.exec(nodeHtml);
        const tail = cm && /,\\?"insightTemplate\\?"/.exec(nodeHtml.slice(cm.index));
        if (cm && tail) {
          const valStart = cm.index + cm[0].length;
          const valEnd = cm.index + tail.index;
          if (valEnd > valStart) {
            next = next.slice(0, valStart) + flightHtmlString(target.excerpt) + next.slice(valEnd);
          }
        }
        next = next.split(`\\"slug\\":\\"${sm[1]}\\"`).join(`\\"slug\\":\\"${target.slug}\\"`);
        const tm = /\\"title\\":\\"((?:[^\\"]|\\[^"])*)\\"/.exec(nodeHtml);
        if (tm) {
          next = next.split(`\\"title\\":\\"${tm[1]}\\"`).join(`\\"title\\":\\"${target.title}\\"`);
        }
        if (next !== nodeHtml) addIf(nodeHtml, next);
      }
    }
  } catch { /* leave the edges array untouched if its shape ever changes */ }
  // Guard: every required donor string must still be present, else the donor
  // copy changed and this pass is stale. Best-effort pairs are simply skipped
  // by the replace when their form is absent.
  for (const from of REQ) {
    if (!html.includes(from)) return html;
  }
  // Pairs are applied one after another, so a short `from` that is a prefix of
  // a longer one (a band heading word vs. a card title that opens with it)
  // would rewrite the longer one first and leave a half-swapped string behind.
  // Ordering the longest `from` first makes the rewrite single-pass: every
  // match is consumed whole before any shorter key can reach into it.
  P.sort((a, b) => b[0].length - a[0].length);
  return safeReplacePairs(html, P);
}

function removeInsightSection(html) {
  if (html.indexOf('styles_invention__bakTB') < 0) return html;
  const pairs = [];
  // 1) static HTML block
  const sOpen = html.indexOf('<div class="styles_invention__bakTB');
  if (sOpen < 0) { console.error('DBG bail no-sopen'); return html; }
  const sEnd = cutBalancedDiv(html, sOpen);
  if (sEnd < 0) { console.error('DBG bail s unbalanced'); return html; }
  const staticSpan = html.slice(sOpen, sEnd);
  if (staticSpan.indexOf('<script') >= 0) { console.error('DBG bail static-script'); return html; }
  if (sEnd < 0) { console.error('DBG bail static-unbalanced'); return html; }
  if (html.split(staticSpan).length - 1 !== 1) { console.error('DBG bail static-count'); return html; }
  pairs.push([staticSpan, '']);
  // 2) RSC flight tuple (backslash-escaped JSON inside push strings)
  const BSQ = String.fromCharCode(92) + String.fromCharCode(34);
  const fMark = BSQ + 'className' + BSQ + ':' + BSQ + 'styles_invention__bakTB' + BSQ;
  const fIdx = html.indexOf(fMark);
  if (fIdx < 0) { console.error('DBG bail no-fmark'); return html; }
  const fOpenNeedle = '[' + BSQ + '$' + BSQ + ',';
  const fOpen = html.lastIndexOf(fOpenNeedle, fIdx);
  if (fOpen < 0) { console.error('DBG bail no-fopen'); return html; }
  let hp = fOpen + fOpenNeedle.length;
  const typeEnd = html.indexOf(BSQ, hp);
  const headTail = ',null,{' + BSQ + 'className' + BSQ + ':' + BSQ + 'styles_invention__bakTB' + BSQ + ',';
  // tuple head may carry a row reference (["$","$L28",null,{...}]) instead of
  // a type string (["$","div",null,{...}]): accept either.
  let headOK = typeEnd > hp && html.slice(typeEnd, typeEnd + headTail.length) === headTail;
  if (!headOK) {
    let p = hp;
    if (html.startsWith(BSQ, p)) p += BSQ.length;
    const rm = /^\$L[0-9a-z]+/.exec(html.slice(p, p + 12));
    if (rm) {
      const afterRef = p + rm[0].length;
      if (html.startsWith(BSQ, afterRef)) {
        const want = ',' + headTail.slice(1);
        headOK = html.slice(afterRef + BSQ.length, afterRef + BSQ.length + want.length) === want;
      }
    }
  }
  if (typeEnd < 0 || !headOK) { console.error('DBG bail fhead'); return html; }
  const fEnd = cutFlightTuple(html, fOpen);
  if (fEnd < 0) { console.error('DBG bail f unbalanced'); return html; }
  let fs = fOpen;
  let fe = fEnd;
  let fTo = '';
  if (html[fe] === ',') {
    fe++;
  } else if (html[fs - 1] === ',') {
    fs--;
  } else {
    fTo = 'null'; // sole child: keep the parent valid
  }
  const flightSpan = html.slice(fs, fe);
  if (html.split(flightSpan).length - 1 !== 1) { console.error('DBG bail f-count'); return html; }
  pairs.push([flightSpan, fTo]);
  const badBefore = verifyFlight(html).bad;
  const out = safeReplacePairs(html, pairs);
  if (verifyFlight(out).bad > badBefore) { console.error('DBG bail oracle'); return html; }
  return out;
}
function applyFooterMenuOrder(html) {
  // Footer Explore order must match the header: Home, About, Mall and
  // Retail, Mall Space Monetization, Brand Activations, Contact.
  // Sports / Work / Insights entries are dropped (retired lanes). Rename-safe:
  // blocks are keyed by href, labels were already renamed by NAV_LABELS.
  const ORDER = ['/home', '/about', '/service/exhibits', '/service/congresses', '/service/events', '/contact?form=quote'];
  const DROP = ['/service/sports', '/projects/filter', '/projects', '/insights'];
  const openRe = /<div class="styles_contents_menu___Mcbo">/g;
  let m = openRe.exec(html);
  if (!m) return html;
  const boxStart = m.index;
  const boxEnd = cutBalancedDiv(html, boxStart);
  if (boxEnd < 0) return html;
  let box = html.slice(boxStart, boxEnd);
  const blocks = [...box.matchAll(/<p\b[^<>]*>\s*<a\b[^<>]*href="([^"]+)"[^<>]*>[\s\S]*?<\/a>\s*<\/p>/gi)];
  if (!blocks.length) return html;
  const byHref = new Map();
  for (const b of blocks) {
    if (!byHref.has(b[1])) byHref.set(b[1], b[0]);
  }
  const kept = [];
  for (const href of ORDER) {
    const b = byHref.get(href);
    if (b) kept.push(b);
  }
  if (!kept.length) return html;
  let firstIdx = -1;
  let lastEnd = -1;
  for (const b of blocks) {
    const i = box.indexOf(b[0]);
    if (firstIdx < 0 || i < firstIdx) firstIdx = i;
    const e = i + b[0].length;
    if (e > lastEnd) lastEnd = e;
  }
  box = box.slice(0, firstIdx) + kept.join('') + box.slice(lastEnd);
  void DROP;
  return html.slice(0, boxStart) + box + html.slice(boxEnd);
}
// StillCraft footprint: the template marquee scrolls 45 European/Middle-East
// cities under a botched "Nairobi … Europe's most iconic cities" heading.
// Rewrite the heading as one coherent sentence and point the marquee + flight
// city data at StillCraft's real malls and neighbourhoods. Runs after global
// swaps (so template "Barcelona" is already "Nairobi" and is left alone).
const FOOTPRINT = ['Galleria Mall', 'Sarit Centre', 'Westgate Mall', 'Two Rivers Mall', 'Village Market', 'Junction Mall', 'Imaara Mall', 'Southfield Mall', 'Westlands', 'Kilimani', 'South C', 'Ngong Road', 'Upperhill', 'Karen', 'Eastleigh'];
const MARQUEE_ORDER = ['Toulouse', 'Glasgow', 'Copenhagen', 'Rome', 'Birmingham', 'Brussels', 'Manchester', 'Edinburgh', 'Dublin', 'Luxembourg', 'Venice', 'London', 'Amsterdam', 'Madrid', 'Berlin', 'Vienna', 'Lisbon', 'Paris', 'Munich', 'Milan', 'Cardiff', 'Newcastle', 'Rotterdam', 'Vitoria', 'Riga', 'Sofia', 'Bratislava', 'Ljubljana', 'Bucharest', 'Helsinki', 'Athens', 'Kaunas', 'Prague', 'Budapest', 'Stockholm', 'Belgrade', 'Nicosia', 'Tallinn', 'Valletta', 'Vilnius', 'Warsaw', 'Abu Dhabi', 'Istanbul', 'Shanghai'];
// Service pages list each offering with the city it ran in, and those cities
// were the donor's ("Budapest", "Frankfurt"). applyCitiesFix bails on these
// pages - it is scoped to the homepage marquee - so the service listings kept
// advertising European hosts. StillCraft delivers in Nairobi, so the city line
// under each service is restated. The line count is untouched: only the text
// node inside the existing line-mask/line pair changes, which keeps the
// reveal animation's DOM shape intact.
const DONOR_SERVICE_CITIES = ['Budapest', 'Frankfurt', 'Barcelona', 'Udine', 'Istanbul, Turkey', 'Amsterdam', 'Paris', 'London', 'Milan', 'Vienna', 'Munich', 'Berlin', 'Madrid', 'Lisbon', 'Brussels', 'Athens', 'Dubai', 'Abu Dhabi'];
export function applyServiceCitiesFix(html) {
  try {
    if (html.indexOf('css-928hs6') < 0) return html;
    return html.replace(/(<p class="css-928hs6[^"]*">[\s\S]*?<div class="line fix-clip"[^>]*>)([^<]*)(<\/div>)/g, (full, a, city, c) => {
      const t = city.trim();
      if (!DONOR_SERVICE_CITIES.includes(t)) return full;
      return a + 'Nairobi' + c;
    });
  } catch { return html; }
}
// The /about/ talent block is already gone from the static markup
// (applyAboutTeamRemove strips it), but its RSC row still carried all 35 of
// the donor's staff: names, job titles, fun-fact quotes and their portraits.
// Static/flight disagreement like that is not invisible - the client component
// re-renders on hydration and republishes the whole donor roster, so the
// section the copy pass removed came straight back client-side.
//
// The row is unreferenced (no other row resolves to its id), so the row is
// dropped whole rather than blanked. The reference check is the guard: if a
// future capture ever wires this module into the layout, a dangling id would
// break the page, so the pass bails and leaves the data for a human decision
// instead of trading donor content for a blank page.
const CREW_MODULE = 'ModuleContentDynamicLayoutAboutMembersLayout';
export function applyAboutCrewRemove(html) {
  try {
    if (html.indexOf(CREW_MODULE) < 0) return html;
    const badBefore = (() => { try { return verifyFlight(html).bad; } catch { return 0; } })();
    const delim = 'self.__next_f.push(';
    const parts = html.split(delim);
    let out = parts[0];
    for (let i = 1; i < parts.length; i++) {
      const seg = parts[i];
      const at = seg.indexOf(CREW_MODULE);
      if (at < 0) { out += delim + seg; continue; }
      // Row start: the "<id>:[" that introduces this row.
      const rowStart = seg.lastIndexOf(':[', at);
      if (rowStart < 0) { out += delim + seg; continue; }
      const id = (/([0-9a-f]{2,4}):\[$/.exec(seg.slice(0, rowStart + 2)) || [])[1];
      // Bail unless the row is genuinely orphaned: a reference elsewhere means
      // deleting it would leave a dangling id.
      if (!id || (html.match(new RegExp(`"${id}"`, 'g')) || []).length > 1) { out += delim + seg; continue; }
      // Bracket-balanced, string-aware scan to the row's own closing bracket -
      // a segment holds several rows, so lastIndexOf(']') would swallow the
      // ones after this.
      let depth = 0, j = rowStart + 1, inStr = false;
      for (; j < seg.length; j++) {
        const ch = seg[j];
        if (ch === '\\') { j++; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === '[') depth++;
        else if (ch === ']' && --depth === 0) break;
      }
      if (j >= seg.length) { out += delim + seg; continue; }
      // Take the row's trailing newline with it so the next row keeps its own
      // line prefix.
      let end = j + 1;
      if (seg[end] === '\n') end++;
      out += delim + seg.slice(0, rowStart) + seg.slice(end);
    }
    if (out === html) return html;
    try { if (verifyFlight(out).bad > badBefore) return html; } catch { return html; }
    return out;
  } catch { return html; }
}
export function applyCitiesFix(html) {
  if (html.indexOf('css-o2o1k2') < 0 && html.indexOf('producedBlock') < 0) return html;
  // heading (static spans + flight label share these substrings)
  const HP = [
    ['events in Europe’s', 'events in Kenya’s'],
    ['most iconic cities.', 'most vibrant malls and neighbourhoods.'],
  ];
  html = safeReplacePairs(html, HP);
  // deterministic European → footprint map (template Barcelona already became
  // Nairobi via global swaps and is intentionally left alone)
  const map = new Map();
  MARQUEE_ORDER.forEach((c, i) => map.set(c, FOOTPRINT[i % FOOTPRINT.length]));
  // static marquee items only (project locations elsewhere must not move)
  html = html.replace(/(css-o2o1k2">)([^<]+)(<)/g, (m, a, b, c) =>
    map.has(b) ? a + map.get(b) + c : m);
  // flight city entries + area names + Nairobi coords
  const FP = [];
  for (const [from, to] of map) {
    FP.push([`\\"city\\":\\"${from}\\"`, `\\"city\\":\\"${to}\\"`]);
  }
  FP.push([`\\"area\\":\\"Western Europe\\"`, `\\"area\\":\\"Nairobi\\"`]);
  FP.push([`\\"area\\":\\"Eastern Europe\\"`, `\\"area\\":\\"Nairobi Metro\\"`]);
  FP.push([`\\"area\\":\\"Middle East & Asia\\"`, `\\"area\\":\\"Kenya\\"`]);
  FP.push([`\\"latitude\\":\\"45.5190165\\"`, `\\"latitude\\":\\"-1.2921\\"`]);
  FP.push([`\\"longitude\\":\\"-1.5558989\\"`, `\\"longitude\\":\\"36.8219\\"`]);
  FP.push([`\\"latitude\\":\\"46.8146553\\"`, `\\"latitude\\":\\"-1.2921\\"`]);
  FP.push([`\\"longitude\\":\\"21.0171655\\"`, `\\"longitude\\":\\"36.8219\\"`]);
  FP.push([`\\"latitude\\":\\"25.2048\\"`, `\\"latitude\\":\\"-1.2921\\"`]);
  FP.push([`\\"longitude\\":\\"55.2708\\"`, `\\"longitude\\":\\"36.8219\\"`]);
  html = safeReplacePairs(html, FP);
  return html;
}
// Single-office footer: exactly one address block, served on every page —
//   Piedmont, 671 Ngong Road
//   Nairobi, Kenya
//   +254 792 234 337
// The template ships two offices (Barcelona + London, later re-mapped into a
// duplicated Piedmont block plus a Citystone Courts block from CMS data).
// This replaces the whole offices container (any inner content) and trims the
// flight listAddress array to the same single entry. Runs after CMS/DB.
export function applyFooterSingleOffice(html) {
  const openTag = '<div class="css-1bp2dcu">';
  const at = html.indexOf(openTag);
  if (at >= 0) {
    const openEnd = at + openTag.length;
    const end = cutBalancedDiv(html, at);
    if (end > openEnd) {
      const one =
        '<div class="css-ducv57">' +
        '<div class="Paragraph_paragraph__SId_Y css-cgpd9q">Piedmont, 671 Ngong Road</div>' +
        '<div class="Paragraph_paragraph__SId_Y css-cgpd9q">Nairobi, Kenya</div>' +
        '<div class="Paragraph_paragraph__SId_Y css-cgpd9q">+254 792 234 337</div>' +
        '</div>';
      html = html.slice(0, openEnd) + one + html.slice(end - '</div>'.length);
    }
  }
  // Flight-rendered address CARDS: the RSC payload bakes one `$L28` card
  // element per listAddress entry, so trimming the data array alone still
  // leaves a pre-rendered second card that hydration re-draws. Keep only
  // the first card inside the office children array. Cards are enumerated
  // by the fixed `["$","$L28","<piped-summary>` element opener and each
  // closes on its own `\"}]]}]` phone-paragraph tail — no bracket-depth
  // scan (nesting quirks differ per captured payload).
  try {
    const BP = String.fromCharCode(92);
    const ref = BP + '"$' + BP + '",' + BP + '"$L28' + BP + '",' + BP + '"';
    const cardTail = BP + '"' + '}]]}]';
    const cardCue = 'translateY(0.3em)' + BP + '"},' + BP + '"children' + BP + '":[';
    const openTok = '],[' + ref;
    let ci = html.indexOf(cardCue);
    let guard = 0;
    while (ci >= 0 && guard++ < 20) {
      // the office array opens with the cue's trailing `[`
      const arrayOpen = ci + cardCue.length - 1;
      const firstRef = html.indexOf(ref, arrayOpen);
      if (firstRef < 0 || firstRef - arrayOpen > 400) {
        ci = html.indexOf(cardCue, ci + cardCue.length);
        continue;
      }
      // enumerate card element starts (all but the first, which has no `],` prefix)
      const starts = [];
      let scan = arrayOpen;
      while (scan >= 0 && scan < arrayOpen + 40000) {
        const p = html.indexOf(openTok, scan);
        if (p < 0 || p > arrayOpen + 40000) break;
        const s = p + 2;
        let sum = '';
        for (let k2 = s + ref.length; k2 < s + ref.length + 200; k2++) {
          if (html[k2] === BP && html[k2 + 1] === '"') break;
          sum += html[k2];
        }
        if (sum.includes('|') && sum.length > 8) starts.push(s);
        scan = s + 1;
      }
      // delete card N down to 2 (first card kept): each closes on its own tail
      for (let i = starts.length - 1; i >= 0; i--) {
        const s = starts[i];
        const t = html.indexOf(cardTail, s);
        if (t < 0) continue;
        const close = t + cardTail.length - 1;
        if (close <= s || close - s > 40000) continue;
        const block = html.slice(s - 1, close + 1);
        const cand = safeReplacePairs(html, [[block, '']]);
        if (cand !== html) {
          try {
            if (verifyFlight(cand).bad <= verifyFlight(html).bad) html = cand;
          } catch { /* keep current */ }
        }
      }
      ci = html.indexOf(cardCue, ci + cardCue.length);
    }
  } catch { /* static fix stands */ }
  // flight listAddress → single Nairobi entry (escape-aware, length-synced)
  try {
    const BS = String.fromCharCode(92);
    const FQ = BS + '"';
    const key = FQ + 'listAddress' + FQ + ':[';
    let idx = html.indexOf(key);
    let guard = 0;
    while (idx >= 0 && guard++ < 6) {
      const open = idx + key.length - 1;
      let depth = 0, k = open, end = -1;
      for (; k < html.length; k++) {
        const c = html[k];
        if (c === BS) { k++; continue; }
        if (c === '[') depth++;
        else if (c === ']') { depth--; if (depth === 0) { end = k; break; } }
        if (k - open > 20000) break;
      }
      if (end < 0) break;
      const fresh =
        '{' + FQ + 'city' + FQ + ':' + FQ + 'Nairobi' + FQ +
        ',' + FQ + 'addressLine1' + FQ + ':' + FQ + 'Piedmont, 671 Ngong Road' + FQ +
        ',' + FQ + 'addressLine2' + FQ + ':' + FQ + 'Nairobi, Kenya' + FQ +
        ',' + FQ + 'addressLine3' + FQ + ':' + FQ + FQ +
        ',' + FQ + 'phoneNumber' + FQ + ':' + FQ + '+254 792 234 337' + FQ + '}';
      const before = html.slice(open + 1, end);
      if (before !== fresh) {
        const badBefore = (() => { try { return verifyFlight(html).bad; } catch { return 0; } })();
        const cand = safeReplacePairs(html, [[before, fresh]]);
        if (cand !== html) {
          try {
            if (verifyFlight(cand).bad <= badBefore) html = cand;
          } catch { /* keep static fix */ }
        }
      }
      idx = html.indexOf(key, idx + fresh.length);
    }
  } catch { /* static fix stands */ }
  return html;
}
// Homepage highlight cards: flight already carries StillCraft's 5 mall cases
// (titles/excerpts/locations correct) but stale template IMAGES, while the
// static cards still show template titles/descriptions/metas. This rewrites
// static text to match flight and swaps images (flight node-scoped + static)
// to the per-case cover art. Home pages only; strictly guarded no-ops.
const HL_NEW = [
  { title: 'Easter at Galleria Mall', slug: 'easter-at-galleria-mall',
    excerpt: 'A spring weekend of themed experiences that turned moms, families and shoppers into eager participants.' },
  { title: 'Mothers Day at Galleria Mall', slug: 'mothers-day-at-galleria-mall',
    excerpt: 'A warm, emotional activation that turned a simple visit into a family ritual and drove a full day of retail traffic.' },
  { title: 'World Cup Watch Party at Galleria', slug: 'world-cup-watch-party-at-galleria-mall',
    excerpt: 'A giant-screen matchday experience that turned televised football into a packed mall-wide event for fans and families.' },
  { title: 'Christmas Campaign at Westgate', slug: 'christmas-at-westgate-mall',
    excerpt: 'A six-week festive programme that wrapped Westgate in light and kept retail moving through the longest shopping season of the year.' },
  { title: 'Valentine’s Day at Sarit Centre', slug: 'valentines-at-sarit-centre',
    excerpt: 'A two-day celebration of connection that filled Sarit’s corridors with couples, friends and an unmistakable buzz.' },
];
const HL_OLD_IMG = [
  '/assets/cms/wp-content/uploads/2026/07/UEFA-Champions-League-Final-2026-1-scaled-1.webp',
  '/assets/cms/wp-content/uploads/2026/07/Euroleague-Final-Four-2026-12-scaled.jpg',
  '/assets/cms/wp-content/uploads/2025/08/Adevina-Ignite-2024-4-scaled.jpg',
  '/assets/cms/wp-content/uploads/2026/06/Midas-ISE-2026-1-scaled.jpg',
  '/assets/cms/wp-content/uploads/2025/07/Menzies-scaled.jpg',
];
const HL_NEW_IMG = HL_NEW.map((c) => `/assets/stillcraft/mall-case/${c.slug}/cover.svg`);
const HL_DESC_PREFIX = [
  '10,498 VIP guests',
  '3,690 VIP guests',
  'Uniting a global team into one',
  'A bold exhibition environment for Midas',
  'For 120 of Menzies',
];
const HL_DESC_TAILS = [
  ['spaces. One city, one concept, one night ', 'that delivered it all.'],
  ['A challenging venue transformed. In a ', 'city where greatness has always been the ', 'standard.'],
  ['community through a transformative ', 'corporate event designed to connect, ', 'engage and celebrate global talent.'],
  ['at ISE 2026, designed to immerse, ', 'engage and stand out.'],
  ['the Costa Brava became the setting for ', 'Menzies Congress 2025, a multi-day ', 'gathering of strategic inspiration and ', 'Catalan luxury.'],
];
// The donor's highlight card names its own event, in the static split-line
// heading and in the flight prominents node. Those rewrites used to live inside
// the region transaction below, which is all-or-nothing: a dozen strict count
// guards each `return html` and revert the WHOLE thing. Editing one highlight
// through the admin changed a count, the transaction bailed, and the donor
// event name came back on the page while the rest of the rebrand stayed. This
// purge is deliberately separate and self-guarded, so donor naming cannot
// survive a failed region pass.
function purgeDonorHighlightText(html) {
  const BS = String.fromCharCode(92);
  // Static split lines of the lead card. Each must be present exactly once, so
  // a donor redesign skips rather than corrupting an unrelated heading.
  const lead = [
    ['>UEFA Champions League Final </div>', '>Easter at Galleria Mall</div>'],
    ['>2026: Budapest. Nine spaces. One </div>', '></div>'],
    ['>night to remember.</div>', '></div>'],
  ];
  for (const [from, to] of lead) {
    if (html.split(from).length - 1 !== 1) continue;
    html = html.split(from).join(to);
  }
  // The flight prominents node also names the donor event, but it is NOT
  // rewritten here. Its title lives in a length-prefixed row and the value is
  // also present in a non-flight copy that a global swap would corrupt, so a
  // targeted edit could not be proven safe; the visible heading is handled
  // above. Left as a known reference, listed in the audit.
  return html;
}
function applyHighlightsFixInner(html, page) {
  if (page !== '/' && page !== '/home') return html;
  if (html.indexOf('Highlight projects') < 0) return html;
  // --- flight images, scoped to each highlight node (databaseId 1200..1204) ---
  try {
    const out = hlFixFlightImages(html);
    if (out) html = out;
  } catch { /* static fix stands */ }
  // --- static cards (region between label and logo wall) ---
  const start = html.indexOf('Highlight projects');
  const end = html.indexOf('We are proud to have worked with');
  if (start < 0 || end <= start) return html;
  let region = html.slice(start, end);
  // guard: exactly 4 css-zwnf0y card h3s
  if ((region.match(/<h3 class="css-zwnf0y/g) || []).length !== 4) return html;
  // card h3 titles (sequential, after the label span)
  let hn = 0;
  region = region.replace(/(<h3 class="css-zwnf0y[^>]*>[\s\S]*?Highlight projects<\/span>)([\s\S]*?)(<\/h3>)/g,
    (m, a, b, c) => {
      hn++;
      if (hn > 4) return m;
      const t = HL_NEW[hn].title.replace(/&/g, '&amp;');
      return a + '<div class="line-mask fix-mask-clip-mask" style="position: relative; display: block; text-align: start; overflow: clip;">' +
        '<div class="line fix-clip" style="position: relative; display: block; text-align: start;">' + t + '</div></div>' + c;
    });
  if (hn !== 4) return html;
  // UEFA lead card (no h3): full title in lead, clear tail lines
  const uefaLead = region.split('>UEFA Champions League Final </div>').length - 1;
  const uefaL0 = region.split('>2026: Budapest. Nine spaces. One </div>').length - 1;
  const uefaL1 = region.split('>night to remember.</div>').length - 1;
  if (uefaLead !== 1 || uefaL0 !== 1 || uefaL1 !== 1) return html;
  region = region.split('>UEFA Champions League Final </div>').join('>Easter at Galleria Mall</div>');
  region = region.split('>2026: Budapest. Nine spaces. One </div>').join('></div>');
  region = region.split('>night to remember.</div>').join('></div>');
  // categories → Retail & Malls (strict counts; nav rename already ran, so
  // Events/Exhibits/Congresses metas read Brand Activations /
  // Mall Calendar Programming / Mall Space Monetization by now)
  const catGuards = [['>Sports</div>', 4], ['>Brand Activations</div>', 2], ['>Mall Calendar Programming</div>', 2], ['>Mall Space Monetization</div>', 2]];
  for (const [old, want] of catGuards) {
    if (region.split(old).length - 1 !== want) return html;
    region = region.split(old).join('>Retail &amp; Malls</div>');
  }
  // locations in DOM order → Galleria×6, Westgate×2, Sarit×2
  const locSeq = ['Galleria Mall, Nairobi', 'Galleria Mall, Nairobi', 'Galleria Mall, Nairobi', 'Galleria Mall, Nairobi', 'Galleria Mall, Nairobi', 'Galleria Mall, Nairobi', 'Westgate Mall, Nairobi', 'Westgate Mall, Nairobi', 'Sarit Centre, Nairobi', 'Sarit Centre, Nairobi'];
  const locHits = [...region.matchAll(/>(Budapest|Athens|Nairobi)<\/div>/g)];
  if (locHits.length !== 10) return html;
  let li = 0;
  region = region.replace(/>(Budapest|Athens|Nairobi)<\/div>/g, () => '>' + locSeq[li++] + '</div>');
  // descriptions: prefix lines → full excerpt; tail lines → cleared
  for (let k = 0; k < 5; k++) {
    const pre = new RegExp('>' + HL_DESC_PREFIX[k].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^<]*</div>', 'g');
    if (!pre.test(region)) return html;
    pre.lastIndex = 0;
    region = region.replace(pre, '>' + HL_NEW[k].excerpt + '</div>');
    for (const tail of HL_DESC_TAILS[k]) {
      const key = '>' + tail + '</div>';
      if (region.split(key).length - 1 !== 1) return html;
      region = region.split(key).join('></div>');
    }
  }
  // images (region-scoped; hero webp handled below)
  for (let k = 1; k < 5; k++) {
    if (region.split(HL_OLD_IMG[k]).length - 1 < 1) return html;
    region = region.split(HL_OLD_IMG[k]).join(HL_NEW_IMG[k]);
  }
  html = html.slice(0, start) + region + html.slice(end);
  // client-side slideshow data (/home inline script "photo" fields)
  {
    const P = [];
    for (let k = 0; k < 5; k++) {
      P.push([`"photo":"${HL_OLD_IMG[k]}"`, `"photo":"${HL_NEW_IMG[k]}"`]);
    }
    html = safeReplacePairs(html, P);
  }
  // head preloads for the swapped case images are now dead weight
  for (let k = 1; k < 5; k++) {
    const esc = HL_OLD_IMG[k].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`<link\\b[^>]*${esc}[^>]*>\\s*`, 'g'), '');
  }
  // hero fallback photo is the UEFA stock image (video itself is StillCraft's):
  // point it at the Easter cover. Only remaining UEFA-webp uses are heroic.
  html = html.split(HL_OLD_IMG[0]).join(HL_NEW_IMG[0]);
  return html;
}
export function applyHighlightsFix(html, page) {
  // The purge runs last, as a fallback only. The region transaction above is
  // all-or-nothing: each guard returns the original document, so one admin edit
  // that changes a count reverts the donor purge too and the donor event name
  // comes back. Running the purge after means the transaction gets first
  // refusal (it consumes the exact strings it needs), and anything it left
  // behind because it bailed is cleaned up here.
  return purgeDonorHighlightText(applyHighlightsFixInner(html, page));
}
// Flight image swaps scoped to highlight nodes 1200..1204 (oracle-guarded).
function hlFixFlightImages(html) {
  const BS = String.fromCharCode(92);
  const marks = [1200, 1201, 1202, 1203, 1204].map((id) => '"databaseId' + BS + '":' + id);
  const pos = marks.map((m) => html.indexOf(m));
  if (pos.some((p) => p < 0)) return null;
  let out = html;
  let off = 0;
  for (let k = 0; k < 5; k++) {
    const from = pos[k] + off;
    // node end: next marker or capped scan (node contents only)
    const nextM = k < 4 ? out.indexOf(marks[k + 1], from) : -1;
    const scopeEnd = nextM > 0 ? nextM : from + 12000;
    const seg = out.slice(from, scopeEnd);
    if (!seg.includes(HL_OLD_IMG[k])) continue;
    const nseg = seg.split(HL_OLD_IMG[k]).join(HL_NEW_IMG[k]);
    out = out.slice(0, from) + nseg + out.slice(scopeEnd);
    off += nseg.length - seg.length;
  }
  if (out === html) return null;
  try {
    const b0 = (() => { try { return verifyFlight(html).bad; } catch { return 0; } })();
    if (verifyFlight(out).bad > b0) return null;
  } catch { return null; }
  return out;
}
// About values rebuild (5 brief values from the 3 template cards + flight).
export function applyValuesFix(html, page) {
  if (page !== '/about') return html;
  if (html.indexOf('made of') < 0) return html;
  // --- static: clone card 1 ×5 with brief copy ---
  const c1open = '<div class="styles_main_wCard__Lgoav';
  const c1 = html.indexOf(c1open);
  if (c1 < 0) return html;
  const c1end = cutBalancedDiv(html, c1);
  if (c1end < 0) return html;
  // run must be exactly 3 contiguous cards
  const opens = [c1];
  let at = c1end;
  for (let k = 1; k < 3; k++) {
    const nx = html.indexOf(c1open, at);
    if (nx < 0) return html;
    if (!/^[\s]*$/.test(html.slice(at, nx))) return html;
    opens.push(nx);
    at = cutBalancedDiv(html, nx);
    if (at < 0) return html;
  }
  const runEnd = at;
  const tpl = html.slice(c1, c1end);
  const detailOpen = '<div class="Paragraph_paragraph__SId_Y styles_main_cards_top_details__ooXG3';
  const cards = VALUES.map(([name, text], i) => {
    let c = tpl;
    // index number (h5 text + clone)
    c = c.replace(/(<h5[^>]*>)1(<\/h5>)/g, `$1${i + 1}$2`);
    // detail: rebuild the details container inner as one text+clone pair
    const dOpen = c.indexOf(detailOpen);
    if (dOpen >= 0) {
      const dStart = c.indexOf('>', dOpen) + 1;
      const dEnd = cutBalancedDiv(c, dOpen);
      if (dEnd > dStart) {
        c = c.slice(0, dStart) +
          '<span class="fix-mask-clip-mask css-1hswejy"><span class="will-change-transform css-13o7eu2"><span class="will-change-transform css-1bx5ylf">' +
          '<span class="text css-13o7eu2"><span class="css-3w1c3c">' + text + '</span></span>' +
          '<span class="text__clone css-rdqqhl"><span class="css-3w1c3c">' + text + '</span></span>' +
          '</span></span></span>' + c.slice(dEnd - '</div>'.length);
      }
    }
    // label: value name in every QeqG3 label span
    c = c.replace(/(<span[^>]*class="Label_label__run2v styles_label__QeqG3[^"]*"[^>]*>)[^<]*(<\/span>)/g, `$1${name}$2`);
    // drop baked data-sc-id clones (edit bar matches by content)
    c = c.replace(/\sdata-sc-id="t-\d+"/g, '');
    return c;
  }).join('');
  html = html.slice(0, c1) + cards + html.slice(runEnd);
  html = html.split('--total-cards:3').join('--total-cards:5');
  // --- flight drivesUsBlock: description + 5 card nodes (guarded) ---
  try {
    const BS = String.fromCharCode(92);
    const FQ = BS + '"';
    const esc = (s) => s.split(BS).join(BS + BS).split('"').join(BS + '"');
    const bi = html.indexOf('WhatDrivesUsBlock');
    if (bi >= 0) {
      const cardKey = FQ + 'card' + FQ + ':[';
      const ci = html.indexOf(cardKey, bi);
      if (ci >= 0 && ci - bi < 3000) {
        const open = ci + cardKey.length - 1;
        let depth = 0, k = open, end = -1;
        for (; k < html.length; k++) {
          const ch = html[k];
          if (ch === BS) { k++; continue; }
          if (ch === '[') depth++;
          else if (ch === ']') { depth--; if (depth === 0) { end = k; break; } }
          if (k - open > 20000) break;
        }
        if (end > 0) {
          const fresh = VALUES.map(([name, text]) =>
            '{' + FQ + 'label' + FQ + ':' + FQ + esc(name) + FQ + ',' + FQ + 'description' + FQ + ':' + FQ + esc(text) + FQ + '}').join(',');
          const before = html.slice(open + 1, end);
          if (before !== fresh) {
            const badBefore = (() => { try { return verifyFlight(html).bad; } catch { return 0; } })();
            const cand = safeReplacePairs(html, [[before, fresh]]);
            if (cand !== html) {
              try { if (verifyFlight(cand).bad <= badBefore) html = cand; } catch { /* static stands */ }
            }
          }
        }
      }
      // block description (unique template sentence)
      const oldDesc = 'Beyond flawless execution, it’s our mindset that makes the difference. As a global event agency, we combine human-first thinking, creative precision, and an obsession with detail that earns the spotlight.';
      if (html.includes(oldDesc)) html = safeReplacePairs(html, [[oldDesc, VALUES_DESC]]);
    }
  } catch { /* static fix stands */ }
  return html;
}
const WALL_DROP_T = ['t-33', 't-35', 't-36', 't-38', 't-39', 't-40', 't-41', 't-42', 't-50'];
const WALL_DROP_I = ['i-41', 'i-45', 'i-47', 'i-51', 'i-53', 'i-55', 'i-57', 'i-59', 'i-75'];
const WALL_DROP_TITLES = ['UEFA', 'Pfizer', 'FedEx', 'Euroleague', 'Ribbon Communications', 'Centrient', 'Corden Pharma', 'Radisys', 'VEEAM'];
const WALL_SRC_MAP = {
  '/assets/cms/wp-content/uploads/2026/05/NL.png': ['Carrefour', '/assets/custom/CARREFOUR.png'],
  '/assets/cms/wp-content/uploads/2025/07/Turkish-Airlines.svg': ['Galleria Shopping Mall', '/assets/custom/GALLERIA SHOPPING MALL.png'],
  '/assets/cms/wp-content/uploads/2026/08/adidas.png': ['Kenya Flower Festival', '/assets/custom/KENYA FLOWER FESTIVAL.png'],
  '/assets/cms/wp-content/uploads/2025/07/NL.svg': ['Radio Africa Group', '/assets/custom/RADIO AFRICA GROUP.jpg'],
  '/assets/cms/wp-content/uploads/2025/07/YPO.svg': ['Sarit Centre', '/assets/custom/SARIT CENTER.png'],
  '/assets/cms/wp-content/uploads/2025/07/Menzies.svg': ['The Imaara Mall', '/assets/custom/THE IMAARA MALL.png'],
  '/assets/cms/wp-content/uploads/2025/07/Adevinta.svg': ['The Junction Mall', '/assets/custom/THE JUNCTION MALL.jpg'],
  '/assets/cms/wp-content/uploads/2025/07/European-Commission.svg': ['The Village Market', '/assets/custom/THE VILLAGE MARKET.jpg'],
  '/assets/cms/wp-content/uploads/2025/07/ISE.svg': ['Two Rivers Mall', '/assets/custom/TWO RIVERS MALL.png'],
  '/assets/cms/wp-content/uploads/2025/07/Fiat.svg': ['Westgate Shopping Mall', '/assets/custom/WESTGATE SHOPPING MALL.png'],
};

// Homepage client-voice slider: the template testimonials slider is RESTORED,
// not gutted. The facet rows, quote slides, leader info, event logos,
// arrows/counter, leader photos and the "see full case study" link stay in the
// DOM, and the flight testimonials edges stay intact so the slider can render
// its slides, exactly as in the original template. The content remains
// admin-editable via /insider > Testimonials (applyTestimonials swaps quotes,
// names, roles, orgs, photos and logos inside the flight payload) and via the
// inline edit bar. This step is intentionally a no-op: every page that carries
// the slider band keeps it, and no flight arrays are emptied.
export function applySliderFix(html, page) {
  if (page === '/insider') return html;
  return html;
}

// Team-members section replacement: the "Our secret? The people" js-talent-main
// grid (plus the client-side "The People Behind" team accordion that hydrates
// over it) is swapped for the congress precision section (CONGRESS_PRECISION_SECTION,
// the user's new teams section). The section lives inside a styles_parallaxBox
// wrapper; when that wrapper is the talent section's immediate parent the whole
// wrapper goes, otherwise just the section itself. Presence-guarded, so pages
// without the team section are untouched. A small guard is injected with the
// section to hide/remove the hydrated team accordion (section.css-4csq8r) so it
// does not render back over the new section.
// ---------- About page: team section ----------
// Replaces the donor template's team block. Names, roles and the order come
// from TEAM (client-provided copy); no photography is required, so nothing
// here can 404 the way the old roster's missing portrait did. Monograms are
// drawn in CSS rather than shipped as SVGs for the same reason.
// Scoped to .sc-team-* so it cannot collide with the bundle's emotion classes.
const TEAM_CSS = `
.sc-team{padding:9rem 0;color:#1B2A4A}
.sc-team__inner{width:100%;max-width:132rem;margin:0 auto;padding:0 2.4rem;box-sizing:border-box}
.sc-team__eyebrow{font-size:1.2rem;letter-spacing:.32em;text-transform:uppercase;color:#C9A24B;margin:0 0 1.6rem}
.sc-team__title{font-size:clamp(2.4rem,4vw,4rem);line-height:1.1;font-weight:400;margin:0 0 1.6rem;max-width:18ch}
.sc-team__intro{font-size:1.4rem;line-height:1.6;max-width:56ch;margin:0 0 4.8rem;opacity:.72}
.sc-team__grid{list-style:none;margin:0;padding:0;display:grid;gap:4rem 3.2rem;grid-template-columns:1fr}
.sc-team__member{display:flex;flex-direction:column;align-items:flex-start;gap:1.6rem}
.sc-team__mono{width:4.8rem;height:4.8rem;border-radius:50%;border:1px solid #C9A24B;display:flex;align-items:center;justify-content:center;font-size:1.6rem;letter-spacing:.06em;color:#C9A24B;flex:none}
.sc-team__name{font-size:1.8rem;font-weight:500;margin:0 0 .4rem;line-height:1.25}
.sc-team__role{font-size:1.3rem;line-height:1.5;margin:0;opacity:.6}
.sc-team__rule{border:0;border-top:1px solid rgba(27,42,74,.14);margin:0 0 4rem}
@media(min-width:600px){.sc-team__grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1024px){.sc-team{padding:12rem 0}.sc-team__grid{grid-template-columns:repeat(3,1fr);gap:5.6rem 4rem}}
@media(prefers-reduced-motion:no-preference){.sc-team__member{transition:transform .4s ease}}
`;
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// "John Mesh" -> JM, "Diana" -> D. Initials only, so a missing portrait can
// never leave a hole in the grid.
function monogram(name) {
  return String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
}
// Roles carry a parenthetical years-of-experience note in the source copy;
// keep it, it is the client's wording.
export function teamSectionHTML() {
  const items = TEAM.map((m) => `<li class="sc-team__member">`
    + `<span class="sc-team__mono" aria-hidden="true">${esc(monogram(m.name))}</span>`
    + `<span><h3 class="sc-team__name">${esc(m.name)}</h3>`
    + `<p class="sc-team__role">${esc(m.role)}</p></span>`
    + `</li>`).join('');
  return `<section class="sc-team" id="sc-team" aria-labelledby="sc-team-title">`
    + `<style>${TEAM_CSS}</style>`
    + `<div class="sc-team__inner">`
    + `<hr class="sc-team__rule">`
    + `<p class="sc-team__eyebrow">Our team</p>`
    + `<h2 class="sc-team__title" id="sc-team-title">The people behind the work</h2>`
    + `<p class="sc-team__intro">Strategy and delivery under one roof, so the people who plan your event are the same ones standing in the room on the day.</p>`
    + `<ul class="sc-team__grid">${items}</ul>`
    + `</div></section>`;
}

const ABOUT_GUARD_CSS = 'section.css-4csq8r{display:none !important;}';
const ABOUT_GUARD_JS = `<script>(function(){function drop(){var els=document.querySelectorAll('section.css-4csq8r');for(var i=0;i<els.length;i++){var n=els[i];if(n)n.remove();}}function run(){drop();}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',run);}else{run();}setTimeout(run,800);setTimeout(run,2500);setTimeout(run,6000);setTimeout(run,12000);})();</script>`;
export function applyAboutTeamReplace(html, cms) {
  // Key on the heading the served /about ACTUALLY ships. The static roster grid
  // was stripped by applyAboutTeamRemove, so if the served page contains the
  // "Join our team" CTA heading we rebuild the roster (CMS portraits when the
  // bundle has them, monogram fallback otherwise) and mount it before it.
  // Static markup only: the flight payload carries escaped copies of the same
  // text, and cutting inside a <script> block corrupts flight JS (blank page).
  const open = staticIndexOf(html, 'Join our team');
  if (open < 0) return html;
  // 1) cut the donor template's team block out of the static markup.
  const box = staticLastIndexOf(html, '<div class="styles_parallaxBox__19SzL', open);
  let cut = null;
  if (box >= 0) {
    const boxEnd = cutBalancedDiv(html, box);
    const sec = staticIndexOf(html, '<section class="styles_talent__AlRC3">', box);
    if (sec === open && boxEnd > open) cut = html.slice(0, box) + html.slice(boxEnd);
  }
  if (cut === null) {
    const end = staticIndexOf(html, '</section>', open);
    if (end < open) return html;
    cut = html.slice(0, open) + html.slice(end + 10);
  }
  html = cut;
  // 2) Donor-exact card language lives in the shared voices grid: portrait
  //    (CMS featuredImage) with sc-vo-media avatar, monogram fallback when
  //    the bundle has none. Mount before the "Join our team" block - the
  //    place the roster occupied in the donor template.
  html = html.replace(/<\/head>/i, '<style>' + VOICES_CSS_RULES + TEAM_X_CSS + ABOUT_GUARD_CSS + '</style>\n$&');
  html = html.replace(/<\/body>/i, teamMountScript(cms) + '\n$&');
  return html;
}
// Mounts the roster just before the "Join our team" block - the place the
// roster occupied in the donor template - using the local CMS team items
// (portrait cards when the bundle carries them, monogram fallback otherwise),
// and removes the hydrated talent grid if it ever renders. Idempotent, and
// re-runs while the page settles.
function teamMountScript(cms) {
  return '<script>(function(){'
    + 'var HTML=' + JSON.stringify(teamExpandSection(teamItemsOf(cms))).replace(/<\/script/gi, '<\\/script') + ';'
    + 'var BINDCODE=' + JSON.stringify(TEAM_X_BIND_JS).replace(/<\/script/gi, '<\\/script') + ';'
    + 'function root(){return document.querySelector("main")||document.body;}'
    // The "Join our team" heading sits inside a narrow two-column block, so
    // climb to the block that is a direct child of <main> and insert before
    // that - otherwise the section inherits a half-width column.
    + 'function topLevel(n){var m=root();while(n&&n.parentElement&&n.parentElement!==m){n=n.parentElement;}'
    + 'return (n&&n.parentElement===m)?n:null;}'
    + 'function anchor(){'
    + 'var hs=document.querySelectorAll("h2");'
    + 'for(var i=0;i<hs.length;i++){if(/join our team/i.test(hs[i].textContent||"")){'
    + 'var t=topLevel(hs[i]);if(t)return t;}}'
    + 'var made=document.querySelector(".styles_madeof__UEfw1");'
    + 'if(made){var mt=topLevel(made);if(mt)return mt.nextElementSibling;}'
    + 'return null;}'
    + 'function drop(){var e=document.querySelectorAll("section.css-4csq8r");'
    + 'for(var i=0;i<e.length;i++){if(e[i])e[i].remove();}}'
    + 'function mount(){drop();'
    + 'if(document.getElementById("sc-team"))return true;'
    + 'var a=anchor();if(!a||!a.parentNode)return false;'
    + 'var d=document.createElement("div");d.innerHTML=HTML;'
    + 'var n=d.firstElementChild;if(!n)return false;'
    + 'a.parentNode.insertBefore(n,a);'
    + 'if(!document.getElementById("sc-xbind")){var s=document.createElement("script");s.id="sc-xbind";s.textContent=BINDCODE;document.body.appendChild(s);}'
    + 'return true;}'
    + 'function run(){try{mount();}catch(e){}}'
    + 'if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",run);}else{run();}'
    + '[300,800,1500,2500,4000,6000,9000,12000].forEach(function(t){setTimeout(run,t);});'
    + '})();<\/script>';
}
export function applyAboutTeamRemove(html) {
  // Strip ONLY the donor's static talent roster block. No CTA cut, no mount -
  // applyAboutTeamReplace (with the CMS bundle) rebuilds and mounts after.
  // Static markup only: never touch flight payload copies.
  const secOpen = staticIndexOf(html, '<section class="styles_talent__AlRC3">');
  if (secOpen < 0) return html;
  let depth = 0, i = secOpen;
  while (i < html.length) {
    if (html.startsWith('</section', i) && /[\s>]/.test(html[i + 9] || '')) {
      const gt = html.indexOf('>', i);
      if (gt < 0) return html;
      depth--;
      i = gt + 1;
      if (depth === 0) return html.slice(0, secOpen) + html.slice(i);
    } else if (html.startsWith('<section', i) && /[\s>]/.test(html[i + 8] || '')) {
      const gt = html.indexOf('>', i);
      if (gt < 0) return html;
      if (html[gt - 1] !== '/') depth++;
      i = gt + 1;
    } else {
      i++;
    }
  }
  return html;
}
// Social share image: template points og:image/twitter:image at an Adevinta
// case photo. Point at StillCraft's own hero poster until a dedicated
// 1200x630 share image is supplied via the Brand panel.
export function applyShareImage(html) {
  const OLD = '/assets/cms/wp-content/uploads/2025/07/Adevinta-scaled.jpg';
  if (html.indexOf('Adevinta-scaled') < 0) return html;
  return safeReplacePairs(html, [[OLD, HERO_POSTER_URL]]);
}
// Brief-specified meta descriptions (titles via TITLE_MAP). Runs site-wide,
// after global swaps (which otherwise leave half-swapped agency copy).
const META_DESC = {
  '/': 'StillCraft Events is a Nairobi-based agency running mall programming, brand activations, and corporate experiences — eight years of planning and delivering in one team.',
  '/home': 'StillCraft Events is a Nairobi-based agency running mall programming, brand activations, and corporate experiences — eight years of planning and delivering in one team.',
  '/about': 'About StillCraft Events — eight years of mall programming, brand activations, and corporate experiences delivered on the ground in Nairobi, Kenya.',
  '/contact': 'Get in touch with StillCraft Events — mall programming, brand activations, and corporate experiences in Nairobi, Kenya. Email info@stillcraftevents.co.ke or call +254 792 234 337.',
};
const META_OLD = [
  'Looking for a Nairobi-based event agency? One partner for mall activations, brand experiences, congresses and sports experiences worldwide. Reach out.',
  'Looking for an international event agency? One partner for events, exhibitions, congresses and sports experiences worldwide. Reach out.',
  'Meet StillCraft Events Co., the global event agency behind powerful brand moments and events. Discover who we are and how we bring brands to life.',
  'Meet StillCraft Events Co., the global event agency behind powerful brand moments an',
  'Nairobi-based event agency delivering large-scale events, professional congresses, seamless destination management, and unique exhibitions',
  'Barcelona-based event agency delivering large-scale events, professional congresses, seamless destination management, and unique exhibitions',
];
export function applyMetaFix(html, page) {
  const want = META_DESC[page];
  if (!want) return html;
  const P = [];
  for (const old of META_OLD) {
    if (!old || old === want || !html.includes(old.slice(0, 40))) continue;
    P.push([old, want]);
    P.push([old.split('"').join('\\"'), want]);
  }
  return P.length ? safeReplacePairs(html, P) : html;
}
// About values ("What we're made of"): template ships 3 cards
// (human-first / no-fluff / precision). The brief defines 5 values, so the
// card run is rebuilt as 5 clones of card 1 carrying the brief copy, and the
// flight drivesUsBlock card array is rebuilt the same way (oracle-guarded).
const VALUES = [
  ['Curious', 'Enough to ask the real question before we pitch an idea.'],
  ['Disciplined', 'Enough to still be on site at six the next morning making sure it works.'],
  ['Versatile', 'Enough to speak mall, brand, and boardroom without losing our accent in any of them.'],
  ['Honest', 'Enough to report what actually happened, not just the highlights.'],
  ['Patient', 'Enough to build for a five-year relationship, not a single invoice.'],
];
const VALUES_DESC = 'Five habits from eight years of planning and delivering on the ground.';
// Homepage service-category cards: Events/Exhibits/Congresses/Sports become
// Brand Activations / Mall Calendar Programming / Mall Space Monetization / Our Work
// (home only; static + flight via length-synced pairs). Each card's button links
// to its own lane page: events, exhibits, congresses, and the portfolio for
// Our Work. Tolerant per-card: a card whose copy drifted (admin edits) keeps
// its copy, but its title + button are still enforced so buttons never lie.
const SVC_CARDS = [
  { title: ['Events', 'Brand Activations'],
    href: '/service/events',
    subs: [['Global Events, Brand ', 'Campaigns & Sponsorships,'], ['Activations, Experience ', 'Activations & Roadshows,'], ['Content', 'One Team End To End']],
    flightTitle: ['Global Events, Brand Activations, Experience Content', 'Campaigns & Sponsorships, Activations & Roadshows, One Team End To End'],
    desc: ['From corporate summits to viral moments, we create experiences that fuel alignment and connection between audiences and business goals.',
      'Strategy through delivery. One team plans your brand’s next move and stays to deliver it, from the boardroom to the ground.'],
    frags: ['From corporate summits to viral moments, '] },
  { title: ['Exhibits', 'Mall Calendar Programming'],
    href: '/service/exhibits',
    subs: [['Exhibitions, Trade Shows, ', 'Year-Round Calendars,'], ['Roadshows, Ephemeral ', 'Seasonal Moments,'], ['Builds', 'Run For You']],
    flightTitle: ['Exhibitions, Trade Shows, Roadshows, Ephemeral Builds', 'Year-Round Calendars, Seasonal Moments, Run For You'],
    desc: ['Presence isn’t enough. We design modular brand spaces that speak, perform and stick, with strategy and flair built into every wall.',
      'One calendar, run for you. StillCraft plans, staffs and runs the entire programme, so your team manages the center instead of the calendar.'],
    frags: ['Presence isn’t enough. We design modular '] },
  { title: ['Congresses', 'Mall Space Monetization'],
    href: '/service/congresses',
    subs: [['Congresses, Internal ', 'Vacant Units,'], ['Meetings, Destination ', 'Curated Occupation,'], ['Management', 'Earning While Relet']],
    flightTitle: ['Congresses, Internal Meetings, Destination Management', 'Vacant Units, Curated Occupation, Earning While Relet'],
    desc: ['We turn high-stakes gatherings into high-impact experiences. Designed to align minds, move decisions and maximise clarity.',
      'When an anchor exits, StillCraft runs the space as a working, earning programme until it is properly relet.'],
    frags: ['We turn high-stakes gatherings into '] },
  { title: ['Sports', 'Our Work'],
    href: '/projects',
    subs: [['Sponsorship, Activations, ', 'Mall Programmes,'], ['Venue Transformation', 'Brand Campaigns, Case Studies']],
    flightTitle: ['Sponsorship, Activations, Venue Transformation', 'Mall Programmes, Brand Campaigns, Case Studies'],
    desc: ['We build emotional power into every play. From VIP lounges to brand arenas, we help you win over fans and leave a lasting mark.',
      'Eleven seasonal mall activations across Nairobi. Real programmes, planned and delivered on the ground.'],
    frags: ['We build emotional power into every play. ', 'From VIP lounges to brand arenas, we help ', 'you win over fans and leave a lasting mark.'] },
];
export function applyServiceCardsFix(html, page) {
  if (page !== '/' && page !== '/home') return html;
  if (html.indexOf('css-bpizdw') < 0) return html;
  // Per-card best effort (a drifted card keeps its copy instead of killing the
  // whole pass). Titles may already carry the new name (nav rename runs
  // earlier): then the title job is skipped for that card.
  // Subtitle lines are scoped to line-divs (bare words like Content/Builds
  // would collide); flight card titles are swapped whole.
  const jobs = [];
  const maybe = (from, to) => {
    if (!from || from === to || !html.includes(from)) return;
    jobs.push([from, to]);
  };
  for (const card of SVC_CARDS) {
    const [oldT, newT] = card.title;
    if (html.includes('>' + oldT + '</')) {
      jobs.push(['>' + oldT + '</', '>' + newT + '</']);
    }
    for (const [oldS, newS] of card.subs) {
      const key = '>' + oldS + '</div>';
      if (html.includes(key)) jobs.push([key, '>' + newS + '</div>']);
    }
    const [oldF, newF] = card.flightTitle;
    if (html.includes(oldF)) jobs.push([oldF, newF]);
    const [oldD, newD] = card.desc;
    if (html.includes(oldD)) jobs.push([oldD, newD]);
    for (const frag of (card.frags || [])) {
      if (html.includes(frag)) jobs.push([frag, '']);
    }
    // Button label travels with the card ("See what we create - <lane>").
    const btnOld = 'See what we create - ' + oldT;
    const btnNew = 'See what we create - ' + newT;
    if (html.includes(btnOld)) jobs.push([btnOld, btnNew]);
    const btnOldEsc = btnOld.split('"').join('\\"');
    if (btnOldEsc !== btnOld && html.includes(btnOldEsc)) {
      jobs.push([btnOldEsc, btnNew.split('"').join('\\"')]);
    }
  }
  // Card buttons must land on their own lane page (page-gated: home only, so
  // the retired sports lane rewrite can never touch the sports page itself).
  // sports card → portfolio (retired lane). Static hrefs plus the flight href
  // props (raw `"href":"..."` and EQ-escaped `\/` forms) — otherwise hydration
  // reverts the button to /service/sports after first paint.
  jobs.push(['href="/service/sports"', 'href="/projects"']);
  jobs.push(['"href":"/service/sports"', '"href":"/projects"']);
  jobs.push(['\\"href\\":\\"\\/service\\/sports\\"', '\\"href\\":\\"\\/projects\\"']);
  // The CMS testimonials pass can relabel the retired-sports card static copy
  // to a testimonial industry ("Retail & Malls") before this runs (positional
  // mapping onto donor nodes). Reclaim it here, scoped to the card heading
  // and its button label so highlight categories elsewhere are untouched.
  // (Post-hydration the heading renders from the service entity title, which
  // MENU_TITLES already set to Our Work — this keeps first paint identical.)
  for (const [from, to] of [
    ['>Retail & Malls</h4>', '>Our Work</h4>'],
    ['>Retail &amp; Malls</h4>', '>Our Work</h4>'],
    ['See what we create - Retail & Malls', 'See what we create - Our Work'],
    ['See what we create - Retail &amp; Malls', 'See what we create - Our Work'],
  ]) {
    if (html.includes(from)) jobs.push([from, to]);
  }
  // length-synced single pass (static markup + flight rows)
  html = safeReplacePairs(html, jobs);
  // Anchor-level enforcement: walk each home card anchor (title="See what we
  // create - ...") and force its href to the lane page, so a stale or stripped
  // href can never send visitors to the wrong page. Static markup only —
  // flight href props are covered by the pairs above.
  html = html.replace(/<a\b([^<>]*?)title="See what we create - ([^"]+)"([^<>]*?)>/g,
    (a, pre, name, post) => {
      const want = { 'Brand Activations': '/service/events', 'Mall Calendar Programming': '/service/exhibits', 'Mall Space Monetization': '/service/congresses', 'Our Work': '/projects',
        'Events': '/service/events', 'Exhibits': '/service/exhibits', 'Congresses': '/service/congresses', 'Sports': '/projects' }[name];
      if (!want) return a;
      const tag = ('<a' + pre + 'title="See what we create - ' + name + '"' + post + '>');
      if (/href="/.test(tag)) return tag.replace(/href="[^"]*"/, 'href="' + want + '"');
      return tag.replace('<a', '<a href="' + want + '"');
    });
  // The card link component builds its href at runtime as "/service/" + slug,
  // so the retired-sports card ("Our Work") reverts to /service/sports on
  // hydration no matter what the static markup says. Pin it client-side (same
  // parse-time script pattern as the team mount): rewrite + click capture.
  if (html.indexOf('sc-ourwork-pin') < 0) {
    html = html.replace(/<\/body>/i,
      '<script id="sc-ourwork-pin">(function(){var T="See what we create - Our Work";'
      + 'function fix(){try{var as=document.querySelectorAll(\'a[title="\'+T+\'"]\');'
      + 'for(var i=0;i<as.length;i++){if(as[i].getAttribute("href")!=="/projects")as[i].setAttribute("href","/projects");}}catch(e){}}'
      + 'function run(){fix();}'
      + 'if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",run);}else{run();}'
      + 'try{new MutationObserver(function(m){for(var i=0;i<m.length;i++){if(m[i].type==="childList"){run();break;}}}).observe(document.body,{childList:true,subtree:true});}catch(e){}'
      + 'document.addEventListener("click",function(e){var t=e.target&&e.target.closest?e.target.closest(\'a[title="\'+T+\'"]\'):null;'
      + 'if(t&&t.getAttribute("href")!=="/projects"){e.preventDefault();e.stopPropagation();window.location.assign("/projects");}},true);'
      + '[500,1500,3000,6000,12000].forEach(function(t){setTimeout(run,t);});'
      + '})();</script>\n$&');
  }
  return html;
}
// Split-text runs: related/portfolio titles and descriptions render word-split
// across consecutive line-mask/line divs. Runs whose concatenated text names a
// template project are rewritten to the mapped mall case (short runs read as
// titles, long runs as excerpts), cycling in document order with independent
// title/desc counters so card pairing stays aligned.
const SPLIT_BRANDS = ['Midas', 'Pfizer', 'CordenPharma', 'Corden Pharma', 'Corden', 'Adidas', 'Adevinta', 'Adevina', 'Nagarro', 'Ribbon', 'Symetrix', 'Lindy', 'UEFA', 'Menzies', 'YPO', 'FedEx', 'Turkish Airlines', 'VEEAM', 'Hackathon', 'Axiecon', 'Stella', 'Icefit', 'Amazfit', 'Novomatic'];
const SPLIT_MALL = ['Galleria', 'Westgate', 'Sarit', 'Southfield'];
export function applySplitTextFix(html) {
  if (html.indexOf('line-mask') < 0) return html;
  try {
    const re = /<div class="line-mask[^>]*><div class="line[^>]*>([^<]*)<\/div><\/div>/g;
    const runs = [];
    let m, prev = null;
    const flush = () => { prev = null; };
    // collect consecutive runs (whitespace-only gaps)
    let lastEnd = -1, cur = [];
    re.lastIndex = 0;
    while ((m = re.exec(html))) {
      if (lastEnd >= 0 && !/^[\s]*$/.test(html.slice(lastEnd, m.index))) {
        if (cur.length) runs.push(cur);
        cur = [];
      }
      cur.push({ index: m.index, len: m[0].length, text: m[1] });
      lastEnd = m.index + m[0].length;
    }
    if (cur.length) runs.push(cur);
    if (!runs.length) return html;
    void flush;
    let ti = 0, di = 0, changed = false;
    // back-to-front so indices stay valid
    const edits = [];
    for (const run of runs) {
      const concat = run.map((r) => r.text).join(' ');
      if (SPLIT_MALL.some((w) => concat.includes(w))) continue;
      if (!SPLIT_BRANDS.some((w) => concat.includes(w))) continue;
      const isTitle = concat.replace(/\s+/g, ' ').trim().length < 160;
      const c = CASE_BY_IDX[(isTitle ? ti : di) % CASE_BY_IDX.length];
      const want = isTitle ? c.title : c.excerpt;
      const esc = want.replace(/&/g, '&amp;');
      run.forEach((r, k) => {
        edits.push([r.index, r.len, k === 0 ? esc : '']);
      });
      if (isTitle) ti++; else di++;
    }
    if (!edits.length) return html;
    edits.sort((a, b) => b[0] - a[0]);
    for (const [at, len, val] of edits) {
      // rebuild the single line-div with new text (keep the opening tag)
      const open = html.lastIndexOf('<div class="line-mask', at);
      void open;
      const seg = html.slice(at, at + len);
      const t = seg.replace(/>([^<]*)<\/div><\/div>$/, '>' + val + '</div></div>');
      html = html.slice(0, at) + t + html.slice(at + len);
    }
    void changed;
    return html;
  } catch { return html; }
}
// Portfolio listings: template project nodes (UEFA/Midas/Adevinta/CPHI…)
// still render on listing/service pages. Every project-shaped node whose slug
// is not one of StillCraft's 11 mall cases is re-skinned in place (same JSON
// shape, leaf values swapped from CASE data, cycling). Detail pages are
// unaffected (their nodes already carry mall slugs). Oracle-guarded.
import CASE_DATA from './stillcraft-cases.mjs';
const CASE_SLUGS = new Set(CASE_DATA.map((c) => c.slug));
const CASE_BY_IDX = CASE_DATA;
function portfolioNodeCase(node, idx) {
  const c = CASE_BY_IDX[idx % CASE_BY_IDX.length];
  const BS = String.fromCharCode(92);
  // Row-safe escaping: this text sits at the raw pre-decode layer and must
  // survive TWO decodes (JS string, then JSON.parse) before hydration reads
  // it — a literal backslash needs 4 backslashes and a literal quote needs 3
  // backslashes + quote here, or the JSON.parse that hydrates the page fails
  // ("Bad control character" / "Unterminated string in JSON").
  const esc = (s) => String(s).split(BS).join(BS + BS + BS + BS).split('"').join(BS + BS + BS + '"');
  let out = node;
  const repFirst = (src, from, to) => {
    const i = src.indexOf(from);
    if (i < 0) return null;
    return src.slice(0, i) + to + src.slice(i + from.length);
  };
  const FQ = BS + '"';
  // Locate the FQ (\") pair that actually terminates a string value, not one
  // of the shell's own escaped-quote sequences inside HTML (e.g. a template's
  // content field can carry `style=\\\"font-weight:...\\\"` — 3 backslashes —
  // which a plain indexOf(FQ) would mistake for the 1-backslash terminator
  // and truncate everything that follows).
  const fieldEnd = (s, from) => {
    let i = from;
    while (i < s.length) {
      const q = s.indexOf('"', i);
      if (q < 0) return -1;
      let n = 0, k = q - 1;
      while (k >= 0 && s[k] === BS) { n++; k--; }
      if (n % 2 === 1 && n === 1) return q - 1;
      i = q + 1;
    }
    return -1;
  };
  // slug
  {
    const lead = FQ + 'slug' + FQ + ':' + FQ;
    const i = out.indexOf(lead);
    if (i < 0) return null;
    const q = fieldEnd(out, i + lead.length);
    if (q < 0) return null;
    out = out.slice(0, i + lead.length) + c.slug + out.slice(q);
  }
  // databaseId (first numeric)
  {
    const m = (FQ + 'databaseId' + FQ + ':').length;
    const i = out.indexOf(FQ + 'databaseId' + FQ + ':');
    if (i >= 0) {
      const num = /^(\d+)/.exec(out.slice(i + m));
      if (num) out = out.slice(0, i + m) + String(c.databaseId) + out.slice(i + m + num[1].length);
    }
  }
  // title (first)
  {
    const lead = FQ + 'title' + FQ + ':' + FQ;
    const i = out.indexOf(lead);
    if (i < 0) return null;
    const j = fieldEnd(out, i + lead.length);
    if (j < 0) return null;
    out = out.slice(0, i + lead.length) + esc(c.title) + out.slice(j);
  }
  // content (first) → excerpt paragraph
  {
    const lead = FQ + 'content' + FQ + ':' + FQ;
    const i = out.indexOf(lead);
    if (i >= 0) {
      const j = fieldEnd(out, i + lead.length);
      if (j >= 0) out = out.slice(0, i + lead.length) + '<p>' + esc(c.excerpt) + '</p>' + BS + BS + 'n' + out.slice(j);
    }
  }
  // cover image (first sourceUrl)
  {
    const lead = FQ + 'sourceUrl' + FQ + ':' + FQ;
    const i = out.indexOf(lead);
    if (i >= 0) {
      const j = fieldEnd(out, i + lead.length);
      if (j >= 0) out = out.slice(0, i + lead.length) + `/assets/stillcraft/mall-case/${c.slug}/cover.svg` + out.slice(j);
    }
  }
  // location / industry / participants (first each)
  {
    const lead = FQ + 'location' + FQ + ':' + FQ;
    const i = out.indexOf(lead);
    if (i >= 0) {
      const j = fieldEnd(out, i + lead.length);
      if (j >= 0) out = out.slice(0, i + lead.length) + esc(c.location) + out.slice(j);
    }
    const il = FQ + 'industry' + FQ + ':' + FQ;
    const ii = out.indexOf(il);
    if (ii >= 0) {
      const j = fieldEnd(out, ii + il.length);
      if (j >= 0) out = out.slice(0, ii + il.length) + esc(c.industry) + out.slice(j);
    }
    const pl = FQ + 'participants' + FQ + ':';
    const pi = out.indexOf(pl);
    if (pi >= 0) {
      const num = /^(\d+)/.exec(out.slice(pi + pl.length));
      if (num) out = out.slice(0, pi + pl.length) + String(c.participants) + out.slice(pi + pl.length + num[1].length);
    }
  }
  // categories → Retail & Malls (within projectCategories block when present)
  {
    const bl = FQ + 'projectCategories' + FQ + ':';
    const bi = out.indexOf(bl);
    if (bi >= 0) {
      let depth = 0, k = bi, bend = -1;
      for (; k < out.length; k++) {
        const ch = out[k];
        if (ch === BS) { k++; continue; }
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) { bend = k + 1; break; } }
      }
      if (bend > 0) {
        const block = out.slice(bi, bend);
        const nl = FQ + 'name' + FQ + ':' + FQ;
        const names = [];
        let ni = 0;
        while (true) {
          const qi = block.indexOf(nl, ni);
          if (qi < 0) break;
          const qj = block.indexOf(FQ, qi + nl.length);
          if (qj < 0) break;
          names.push([qi, qj]);
          ni = qj + 2;
        }
        if (names.length) {
          let nb = block, sh = 0;
          for (const [qs, qe] of names) {
            const val = 'Retail & Malls';
            nb = nb.slice(0, qs + nl.length + sh) + val + nb.slice(qe + sh);
            sh += val.length - (qe - (qs + nl.length));
          }
          out = out.slice(0, bi) + nb + out.slice(bend);
        }
      }
    }
  }
  void repFirst;
  return out;
}
export function applyPortfolioFix(html) {
  if (html.indexOf('projectTemplate') < 0 && html.indexOf('projectCategories') < 0) return html;
  try {
    const BS = String.fromCharCode(92);
    const FQ = BS + '"';
    const slugLead = FQ + 'slug' + FQ + ':' + FQ;
    const isEsc = (s, i) => {
      let n = 0;
      for (let k = i - 1; k >= 0 && s[k] === BS; k--) n++;
      return n % 2 === 1;
    };
    const nodeStart = (s, at) => {
      // walk back from inside a node to its opening brace
      let depth = 0;
      for (let i = at; i >= 0; i--) {
        const c = s[i];
        if (c === '"' && !isEsc(s, i)) {
          // skip string literals backwards
          let j = i - 1;
          while (j >= 0) {
            if (s[j] === '"' && !isEsc(s, j)) break;
            j--;
          }
          i = j + 1;
          continue;
        }
        if (c === '}' && !isEsc(s, i)) depth++;
        else if (c === '{' && !isEsc(s, i)) {
          if (depth === 0) return i;
          depth--;
        }
      }
      return -1;
    };
    const nodeEnd = (s, open) => {
      let depth = 0;
      for (let k = open; k < s.length; k++) {
        const c = s[k];
        if (c === BS) { k++; continue; }
        if (c === '"') {
          // skip string literal forward
          k++;
          while (k < s.length) {
            if (s[k] === BS) { k += 2; continue; }
            if (s[k] === '"') break;
            k++;
          }
          continue;
        }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return k + 1; }
        if (k - open > 40000) return -1;
      }
      return -1;
    };
    // all slug occurrences that live in project-shaped nodes
    const hits = [];
    let at = 0;
    while (true) {
      const i = html.indexOf(slugLead, at);
      if (i < 0) break;
      const j = html.indexOf(FQ, i + slugLead.length);
      if (j > 0) {
        const slug = html.slice(i + slugLead.length, j);
        if (/^[a-z0-9][a-z0-9-]{2,60}$/.test(slug)) {
          const ns = nodeStart(html, i);
          if (ns >= 0) {
            const ne = nodeEnd(html, ns);
            if (ne > ns && ne - ns < 30000) {
              const span = html.slice(ns, ne);
              if ((span.includes('projectTemplate') || span.includes('projectCategories')) && !span.includes('insightTemplate')) {
                hits.push([ns, ne, slug]);
              }
            }
          }
        }
      }
      at = i + slugLead.length;
    }
    if (!hits.length) return html;
    // shell = first CASE node on the page (same shape as siblings)
    let shell = null;
    for (const [ns, ne, slug] of hits) {
      if (CASE_SLUGS.has(slug)) { shell = html.slice(ns, ne); break; }
    }
    let out = html, sh = 0, n = 0;
    let changed = false;
    const seenNs = new Set();
    for (const [ns, ne, slug] of hits) {
      if (CASE_SLUGS.has(slug)) continue;
      if (seenNs.has(ns)) continue;
      seenNs.add(ns);
      const a = ns + sh, b = ne + sh;
      if (a < 0 || b > out.length || b <= a) continue;
      const span = out.slice(a, b);
      const base = shell && shell !== span ? shell : span;
      const fresh = portfolioNodeCase(base.length ? base : span, n, slug);
      if (!fresh || fresh === span) continue;
      out = out.slice(0, a) + fresh + out.slice(b);
      sh += fresh.length - span.length;
      n++;
      changed = true;
    }
    if (!changed) return html;
    try {
      const badBefore = (() => { try { return verifyFlight(html).bad; } catch { return 0; } })();
      if (verifyFlight(out).bad > badBefore) return html;
    } catch { return html; }
    return out;
  } catch { return html; }
}
// Static listing cards: thumbnails/alt text/image URLs/anchor hrefs still name
// template projects (flight nodes are fixed by applyPortfolioFix). Derives the
// same deterministic map (flight template nodes in document order → CASE
// cycling) and swaps attributes site-wide. Guards + single oracle check.
export function applyListingStaticFix(html) {
  try {
    const BS = String.fromCharCode(92);
    const FQ = BS + '"';
    const slugLead = FQ + 'slug' + FQ + ':' + FQ;
    const isEsc = (s, i) => { let n = 0; for (let k = i - 1; k >= 0 && s[k] === BS; k--) n++; return n % 2 === 1; };
    // ordered template slugs from flight PROJECT nodes only (same order as
    // the flight rewrite, so static ↔ flight assignments agree)
    const order = [];
    const seen = new Set();
    let at = 0;
    while (true) {
      const i = html.indexOf(slugLead, at);
      if (i < 0) break;
      const j = html.indexOf(FQ, i + slugLead.length);
      if (j > 0) {
        const slug = html.slice(i + slugLead.length, j);
        if (/^[a-z0-9][a-z0-9-]{2,60}$/.test(slug) && !CASE_SLUGS.has(slug) && !seen.has(slug)) {
          const win = html.slice(Math.max(0, i - 200), i + 3000);
          if ((win.includes('projectTemplate') || win.includes('projectCategories')) && !win.includes('insightTemplate')) {
            seen.add(slug);
            order.push([slug, i]);
          }
        }
      }
      at = i + slugLead.length;
    }
    // template category pairs on listing cards (exact phrases only)
    {
      const CP = [['Congresses, Events', 'Retail & Malls'], ['Exhibits, Sports', 'Retail & Malls']];
      const hit = CP.filter(([o]) => html.includes(o));
      if (hit.length) html = safeReplacePairs(html, hit);
    }
    // NOTE: no early return on empty order — tag/block passes below are
    // independent and must run on mall-only pages too.
    // per-slug title + ALL images from its flight node (for alt/src swaps)
    const info = new Map();
    for (const [slug] of order) {
      const si = html.indexOf(slugLead + slug + FQ);
      if (si < 0) continue;
      const win = html.slice(Math.max(0, si - 200), si + 3000);
      const tm = (FQ + 'title' + FQ + ':' + FQ);
      const ti = win.indexOf(tm);
      let title = '';
      if (ti >= 0) {
        const tj = win.indexOf(FQ, ti + tm.length);
        if (tj >= 0) title = win.slice(ti + tm.length, tj);
      }
      const imgs = [];
      const sm = (FQ + 'sourceUrl' + FQ + ':' + FQ);
      let qi = 0;
      while (imgs.length < 6) {
        const qk = win.indexOf(sm, qi);
        if (qk < 0 || qk > 2500) break;
        const qj = win.indexOf(FQ, qk + sm.length);
        if (qj < 0) break;
        // Only the donor's own uploads tree is a template image to be remapped.
        // Any /assets/ URL used to qualify, and this scan reads a 2500-char
        // window from the slug lead, so it could reach past the node and pick
        // up a neighbouring asset - including a StillCraft admin upload, which
        // was then replaced by a case cover site-wide and the admin's image
        // silently disappeared on save.
        const u = win.slice(qk + sm.length, qj);
        if (u && u.startsWith('/assets/cms/') && !imgs.includes(u)) imgs.push(u);
        qi = qj + 2;
      }
      info.set(slug, { title, imgs });
    }
    const P = [];
    order.forEach(([slug], k) => {
      const c = CASE_BY_IDX[k % CASE_BY_IDX.length];
      const cover = `/assets/stillcraft/mall-case/${c.slug}/cover.svg`;
      const inf = info.get(slug) || { title: '', imgs: [] };
      // anchor hrefs (skip redirected-stale slugs: those anchors are deleted)
      if (!STALE_PROJECT_SLUGS.includes(slug)) {
        P.push([`/project/${slug}`, `/project/${c.slug}`]);
      }
      if (inf.title) {
        const tForms = [inf.title, inf.title.split(BS + 'u0026').join('&')];
        for (const tf of tForms) {
          P.push([tf, c.title]);
          if (tf.includes('&')) P.push([tf.split('&').join('&amp;'), c.title]);
        }
      }
      for (const u of (inf.imgs || [])) P.push([u, cover]);
    });
    // dead preloads for template project imagery (cards now use covers)
    const DENY = ['NL.png', 'NL.svg', 'Champions-League.svg', 'Turkish-Airlines.svg', 'pfizer.png', 'Fedex.svg', 'FedEx', 'adidas.png', 'Euroleague.svg', 'Ribbon.svg', 'Centrient.svg', 'Corden-Pharma.svg', 'Radisys.svg', 'YPO.svg', 'Menzies.svg', 'Adevinta.svg', 'Adevina', 'European-Commission.svg', 'ISE.svg', 'Fiat.svg', 'VEEAM.svg', 'UEFA-', 'UCLF-', 'Midas-', '-mwc-', '-ise-202', '-cphi-', 'Basketball', 'Hackathon', 'Axiecon', 'Super-Cup', 'final-four', 'Stella', 'Testimonial_', 'Testimonials_', 'UEFA-logo', 'Pfizer-logo', 'Menzies-', 'Euroleague-', 'Champions-League-', 'Corden-', 'Turkish-', 'YPO-', 'Istanbul', 'Udine', 'Frankfurt'];
    // dead preloads for template project imagery (cards now use covers).
    // Isolated oracle: one un-syncable content pair must not revert these.
    // (Union of wall files + project imagery; case-sensitive basenames plus
    // distinctive substrings. Service-card art Events-1.jpg etc. is excluded.)
    {
      const DP = [];
      const DENY_ALL = DENY.concat(['Nagarro', 'Symetrix', 'Lindy', 'Pfizer-', 'Ribbon-', 'Adevinta', 'Adidas-']);
      for (const m of html.matchAll(/<link\b[^>]*rel="preload"[^>]*>/gi)) {
        const tag = m[0];
        if (DENY_ALL.some((d) => tag.includes(d))) DP.push([tag, '']);
      }
      if (DP.length) {
        try {
          const bb = (() => { try { return verifyFlight(html).bad; } catch { return 0; } })();
          const c2 = safeReplacePairs(html, DP);
          if (c2 !== html) {
            try { if (verifyFlight(c2).bad <= bb) html = c2; } catch { /* keep */ }
          }
        } catch { /* keep */ }
      }
    }
    // <img> tags (and preloads) showing template project imagery: map each
    // distinct template image URL, in document order, onto mall covers.
    // (Card text/links are handled by the pairs above and the block pass.)
    // NOTE: no early return on empty P — the passes below are independent;
    // the oracle at the end no-ops naturally when nothing changed.
    try {
      const DENY_IMG = ['UEFA-', 'UCLF-', 'Midas-', 'Adevinta', 'Adevina-', '-mwc-', '-ise-202', '-cphi-', 'Basketball', 'Hackathon', 'Axiecon', 'Super-Cup', 'final-four', 'Stella', 'Testimonial_', 'Testimonials_', 'UEFA-logo', 'Pfizer-logo', 'Pfizer-', 'Menzies-', 'Euroleague-', 'Champions-League-', 'Corden-', 'FedEx', 'Fedex', 'Turkish-', 'YPO-', 'Istanbul', 'Udine', 'Frankfurt', 'NL.png', 'NL.svg', 'Champions-League.svg', 'Turkish-Airlines.svg', 'pfizer.png', 'adidas.png', 'Adidas-', 'Euroleague.svg', 'Ribbon.svg', 'Ribbon-', 'Centrient.svg', 'Corden-Pharma.svg', 'Radisys.svg', 'YPO.svg', 'Menzies.svg', 'Adevinta.svg', 'European-Commission.svg', 'ISE.svg', 'Fiat.svg', 'VEEAM.svg', 'Nagarro', 'Symetrix', 'Lindy'];
      // An admin-uploaded asset must never be treated as donor artwork. The
      // admin writes its uploads to /assets/custom/, so a CMS-set image is not
      // a donor path - but a CMS record saved before that was true can name a
      // donor file, and this pass ran after applyStructuredCMS, so it replaced
      // the admin's own image with a case cover and the upload silently
      // vanished. /assets/custom/ is StillCraft's own upload space and is
      // excluded outright.
      const isTplUrl = (u) => u.includes('/assets/cms/') && !u.includes('/assets/custom/')
        && DENY_IMG.some((d) => u.includes(d));
      const urlIndex = new Map();
      const urlOrder = [];
      const tagRe = /<(img|link)\b[^<>]*>/gi;
      let tm;
      while ((tm = tagRe.exec(html))) {
        const tag = tm[0];
        if (tm[1].toLowerCase() === 'link' && !/rel="preload"/i.test(tag)) continue;
        const um = /(?:src|href)="([^"]+)"/i.exec(tag);
        if (!um || !isTplUrl(um[1])) continue;
        const base = um[1].split(' ')[0];
        if (!urlIndex.has(base)) { urlIndex.set(base, urlOrder.length); urlOrder.push(base); }
      }
      if (urlOrder.length) {
        html = html.replace(/<(img|link)\b[^<>]*>/gi, (tag) => {
          if (/^<link/i.test(tag) && !/rel="preload"/i.test(tag)) return tag;
          const um = /(?:src|href)="([^"]+)"/i.exec(tag);
          if (!um || !isTplUrl(um[1])) return tag;
          const base = um[1].split(' ')[0];
          const c = CASE_BY_IDX[(urlIndex.get(base) || 0) % CASE_BY_IDX.length];
          const cover = `/assets/stillcraft/mall-case/${c.slug}/cover.svg`;
          let t = tag;
          t = t.replace(/(?:src|href)="[^"]*"/i, (m) => {
            const attr = m.slice(0, m.indexOf('="') + 2);
            return attr + cover + '"';
          });
          // srcset/imagesrcset: point every candidate at the cover
          t = t.replace(/(srcset|imagesrcset)="[^"]*"/gi, (m) => {
            const attr = m.slice(0, m.indexOf('="') + 2);
            const cands = m.slice(m.indexOf('="') + 2, -1).split(',').map((s) => {
              const parts = s.trim().split(/\s+/);
              return cover + (parts[1] ? ' ' + parts[1] : '');
            });
            return attr + cands.join(', ') + '"';
          });
          if (/alt="/i.test(t)) {
            t = t.replace(/alt="[^"]*"/i, `alt="${c.title.replace(/"/g, '&quot;')}"`);
          }
          return t;
        });
      }
    } catch { /* pairs below still apply */ }
    // project cards: per-block rewrite anchored on each card's own link.
    // (Runs even when P ends up empty: block edits are direct and guarded.)
    try {
      const bOpen = '<div class="ProjectListSection_project__';
      // slug → case map from above (template slugs only; mall links are direct)
      const slugToCase = new Map();
      order.forEach(([slug], k) => {
        if (!STALE_PROJECT_SLUGS.includes(slug)) {
          slugToCase.set(slug, CASE_BY_IDX[k % CASE_BY_IDX.length].slug);
        }
      });
      let bi = 0, bguard = 0;
      while (bguard++ < 40) {
        const bo = html.indexOf(bOpen, bi);
        if (bo < 0) break;
        const be = cutBalancedDiv(html, bo);
        if (be < 0) break;
        let block = html.slice(bo, be);
        const hm = /href="\/project\/([a-z0-9-]+)"/.exec(block);
        if (hm) {
          // redirected-stale cards go entirely (anchor deletion alone would
          // orphan their images and titles)
          if (STALE_PROJECT_SLUGS.includes(hm[1])) {
            html = html.slice(0, bo) + html.slice(be);
            bi = bo;
            continue;
          }
          let slug = hm[1];
          if (slugToCase.has(slug)) slug = slugToCase.get(slug);
          const c = CASE_BY_IDX.find((x) => x.slug === slug);
          if (c) {
            const cover = `/assets/stillcraft/mall-case/${c.slug}/cover.svg`;
            block = block.replace(/<img\b[^<>]*>/gi, (tag) => {
              let t = tag;
              if (/\ssrc\s*=/i.test(t)) t = t.replace(/\ssrc\s*=\s*"[^"]*"/i, ` src="${cover}"`);
              t = t.replace(/\ssrcset\s*=\s*"[^"]*"/i, '');
              t = t.replace(/\salt\s*=\s*"[^"]*"/i, ` alt="${c.title.replace(/"/g, '&quot;')}"`);
              return t;
            });
            block = block.split(`/project/${hm[1]}`).join(`/project/${c.slug}`);
            html = html.slice(0, bo) + block + html.slice(be);
            bi = bo + block.length;
            continue;
          }
        }
        bi = be;
      }
    } catch { /* pairs below still apply */ }
    const badBefore = (() => { try { return verifyFlight(html).bad; } catch { return 0; } })();
    const out = safeReplacePairs(html, P);
    if (out === html) return html;
    try { if (verifyFlight(out).bad > badBefore) return html; } catch { return html; }
    return out;
  } catch { return html; }
}
// Listing card titles (whole-string <p> titles with data-sc-id) still naming
// template projects: rewrite positionally to mall cases, with the adjacent
// location/category pills. Template-brand match required; mall titles pass
// through untouched.
const CARD_CATS = ['Live Event', 'Congresses', 'Events', 'Exhibits', 'Sports', 'Product Launch', 'Congresses, Events', 'Exhibits, Sports'];
export function applyCardTitlesFix(html) {
  try {
    const re = /<p data-sc-id="t-\d+" class="Paragraph_paragraph__SId_Y css-ye2k4l">([^<]+)<\/p>/g;
    const hits = [];
    let m;
    while ((m = re.exec(html))) {
      const text = m[1];
      if (SPLIT_MALL.some((w) => text.includes(w))) continue;
      if (!SPLIT_BRANDS.some((w) => text.includes(w))) continue;
      hits.push([m.index, m[0].length, text]);
    }
    if (!hits.length) return html;
    // back-to-front; locations/categories paired within ±2500 chars
    hits.sort((a, b) => b[0] - a[0]);
    let n = 0;
    for (const [at, len, text] of hits) {
      const c = CASE_BY_IDX[n % CASE_BY_IDX.length];
      n++;
      const nt = c.title.replace(/&/g, '&amp;');
      html = html.slice(0, at) + html.slice(at, at + len).replace(text, nt) + html.slice(at + len);
      // nearest following location pill (sts5z9) before the next card title
      const pillRe = /<p data-sc-id="t-\d+" class="Paragraph_paragraph__SId_Y css-sts5z9">([^<]+)<\/p>/g;
      pillRe.lastIndex = at;
      const pm = pillRe.exec(html);
      if (pm && pm.index < at + 2500) {
        const loc = pm[1];
        if (!SPLIT_MALL.some((w) => loc.includes(w)) && /[A-Z]/.test(loc)) {
          html = html.slice(0, pm.index) + pm[0].split(loc).join(c.location) + html.slice(pm.index + pm[0].length);
        }
      }
    }
    // template category pills → Retail & Malls (exact values only)
    for (const cat of CARD_CATS) {
      const esc = cat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(`(<p data-sc-id="t-\\d+" class="Paragraph_paragraph__SId_Y css-sts5z9">)${esc}(<\\/p>)`, 'g'), `$1Retail &amp; Malls$2`);
    }
    return html;
  } catch { return html; }
}
// Project listing cards: <a href="/project/<slug>">title, event type, location.
// applyCardTitlesFix only revisits cards whose TITLE names a donor brand, so a
// card already titled after a mall case kept the donor's own location pill
// ("Mother's Day at Galleria Mall" / "Udine"), and a card pointing at a
// donor-only slug shipped a dead link. Keying off the card's own href makes
// every card self-describing: the case that the href names supplies its own
// title, event type and location.
//
// A card whose slug is not a case (e.g. the MWC stand) is repointed at a real
// case rather than deleted, so the number and shape of cards the flight
// payload declares stays identical and hydration is unaffected.
const CARD_TITLE = /<p data-sc-id="t-\d+" class="Paragraph_paragraph__SId_Y css-ye2k4l">([^<]*)<\/p>/g;
const CARD_PILL = /<p data-sc-id="t-\d+" class="Paragraph_paragraph__SId_Y css-sts5z9">([^<]*)<\/p>/g;
function setPill(block, re, value, nth) {
  re.lastIndex = 0;
  let m;
  for (let i = 0; i <= nth; i++) {
    m = re.exec(block);
    if (!m) return block;
  }
  return block.slice(0, m.index) + m[0].split(m[1]).join(value) + block.slice(m.index + m[0].length);
}
export function applyProjectCardsFix(html) {
  try {
    let out = html;
    let n = 0;
    // Each edit shortens or lengthens the document, so the scan runs over the
    // MUTATING string and resumes past the card just rewritten. Matching on the
    // original while slicing the rewritten one leaves every offset after the
    // first resized card stale, which silently skips the rest of the listing.
    const card = /<a href="\/project\/([a-z0-9-]+)\/?"/g;
    for (let m = card.exec(out); m; m = card.exec(out)) {
      const slug = m[1];
      const start = m.index;
      const end = out.indexOf('</a>', start);
      if (end < 0) break;
      const block = out.slice(start, end);
      // Re-point donor-only slugs at a case, cycling in listing order.
      const c = CASE_BY_IDX.find((x) => x.slug === slug) || CASE_BY_IDX[n % CASE_BY_IDX.length];
      n++;
      if (!c) { card.lastIndex = end; continue; }
      let nb = block;
      CARD_TITLE.lastIndex = 0;
      const tm = CARD_TITLE.exec(nb);
      if (tm) nb = nb.slice(0, tm.index) + tm[0].split(tm[1]).join(c.title.replace(/&/g, '&amp;')) + nb.slice(tm.index + tm[0].length);
      nb = setPill(nb, CARD_PILL, c.eventType.replace(/&/g, '&amp;'), 0);
      nb = setPill(nb, CARD_PILL, c.location.replace(/&/g, '&amp;'), 1);
      // The donor's fourth pill is the host city on its own ("Athens",
      // "Budapest"). Every StillCraft case runs in Nairobi, so the city half of
      // the case location keeps the row honest instead of naming a foreign
      // city next to our own mall.
      nb = setPill(nb, CARD_PILL, teaserEscape(c.location.split(',').pop().trim()), 2);
      // The href is the first attribute of the anchor text.
      nb = nb.replace(/^<a href="\/project\/[a-z0-9-]+\/?"/, `<a href="/project/${c.slug}"`);
      out = out.slice(0, start) + nb + out.slice(end);
      // Resume after the rewritten card: its length just changed.
      card.lastIndex = start + nb.length;
    }
    return out;
  } catch { return html; }
}
// Service pages carry the testimonial band in the RSC payload rather than the
// static markup, so applyTestimonialBandFix never sees it: the payload still
// published the donor's own numbers ("participants":11195), sectors
// ("industry":"Football") and host cities ("location":"Istanbul, Turkey").
//
// Each `testimonialTemplate` object is rewritten as a unit - the three fields
// move together, so a value can never be re-paired with a different slide's
// case the way a blind per-value replace would. The client name, role, quote,
// image and link inside the same object are left alone: those are the fields
// the client edits through the CMS, and overwriting them would fight the
// admin. Only the descriptive facts are ours to state.
export function applyTestimonialFlightFix(html) {
  try {
    if (html.indexOf('testimonialTemplate') < 0) return html;
    const badBefore = (() => { try { return verifyFlight(html).bad; } catch { return 0; } })();
    const delim = 'self.__next_f.push(';
    const parts = html.split(delim);
    let out = parts[0];
    for (let i = 1; i < parts.length; i++) {
      const seg = parts[i];
      let s = seg;
      // Back-to-front: each rewrite changes this segment's length, so a
      // forward walk would be splicing at offsets taken from the pre-rewrite
      // string and would silently skip every node after the first.
      // The payload is JS-escaped, so keys appear as \\"testimonialTemplate\\":\\{
      // and every pattern below has to match the escaped form.
      const KEY = /\\"testimonialTemplate\\":\{/g;
      const nodes = [...seg.matchAll(KEY)];
      const edits = [];
      for (const m of nodes) {
        // Brace-balanced scan, string-aware, so nested client/logo objects do
        // not end the match early.
        let depth = 0, j = m.index + m[0].length - 1, inStr = false;
        for (; j < s.length; j++) {
          const ch = s[j];
          if (ch === '\\') { j++; continue; }
          if (ch === '"') { inStr = !inStr; continue; }
          if (inStr) continue;
          if (ch === '{') depth++;
          else if (ch === '}' && --depth === 0) break;
        }
        if (j >= s.length) continue;
        // Nodes are visited last-to-first, so the case index is derived from
        // the node's position in the ORIGINAL segment.
        // Count the nodes ahead of this one in the ORIGINAL segment; the
        // first node in a segment counts 0, so this is the slide index itself.
        const c = CASE[(seg.slice(0, m.index).match(KEY) || []).length % CASE.length];
        const start = m.index + m[0].length;
        const body = s.slice(start, j);
        // Values are re-emitted escaped, matching how the payload encodes them.
        const q = (v) => `\\"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}\\"`;
        const link = `\\"link\\":{\\\"title\\\":${q(c.title)},\\\"target\\\":\\\"\\\",\\\"url\\\":${q('/project/' + c.slug + '/')}}`;
        const nb = body
          .replace(/\\"participants\\":\d+/, `\\"participants\\":${c.participants}`)
          .replace(/\\"industry\\":\\"[^"\\\\]*\\"/, `\\"industry\\":${q(c.industry)}`)
          .replace(/\\"location\\":\\"[^"\\\\]*\\"/, `\\"location\\":${q(c.location)}`)
          // The quote's "read the project" link pointed at a donor project that
          // no longer exists, so it 404'd and advertised a UEFA event StillCraft
          // never ran. It now points at the case the slide is describing.
          .replace(/\\"link\\":\{\\\"title\\":\\\"[^"\\\\]*\\\",\\\"target\\":\\\"[^"\\\\]*\\\",\\\"url\\":\\\"[^"\\\\]*\\\"\}/, link);
        if (nb === body) continue;
        edits.push([start, body, nb]);
      }
      // Back to front so every recorded offset is still valid when its edit
      // lands.
      edits.sort((a, b) => b[0] - a[0]);
      for (const [at, from, to] of edits) {
        if (s.slice(at, at + from.length) !== from) continue;
        s = s.slice(0, at) + to + s.slice(at + from.length);
      }
      out += delim + s;
    }
    // Each quote's client logo hangs off a `client` object that is a SIBLING of
    // its testimonialTemplate - and on these pages it is serialised outside the
    // flight pushes entirely, so the per-segment walk above never sees it. Most
    // were already repointed at the mall-case covers by the logo pass; these are
    // the ones still loading the donor's own brand files (a Euroleague or
    // Pfizer logo from the donor's uploads), which put a third party's
    // trademark on a StillCraft page. The name and role beside them stay put -
    // those are the client's to edit - only the image is ours to choose.
    let k = 0;
    const logos = [...out.matchAll(/\\"organization\\":\{\\"name\\":\\"[^"\\]*\\",\\"logo\\":\{\\"node\\":\{\\"sourceUrl\\":\\"([^"\\]*)\\"\}/g)]
      .filter((m) => m[1].startsWith('/assets/cms/'))
      .reverse();
    for (const m of logos) {
      const c = CASE[k % CASE.length];
      k++;
      if (!c) continue;
      const cover = `/assets/stillcraft/mall-case/${c.slug}/cover.svg`;
      out = out.slice(0, m.index) + m[0].split(m[1]).join(cover) + out.slice(m.index + m[0].length);
    }
    if (out === html) return html;
    try { if (verifyFlight(out).bad > badBefore) return html; } catch { return html; }
    return out;
  } catch { return html; }
}

// applyTestimonialFlightFix restates the descriptive facts on a quote
// (participants / sector / city / link) and deliberately leaves the attribution
// alone, because those are the fields the client edits through the CMS. On the
// three /service/* lanes that rationale backfired: the attribution was never
// StillCraft's to begin with. Each lane still published the donor's carousel -
// real people's names, their staff photographs, their employers' job titles and
// the quotes those employers gave the donor - as if StillCraft had run those
// campaigns. A mall cover had already been swapped in for the logo, so the page
// claimed "UEFA" above a picture of a shopping centre.
//
// The whole attribution is therefore restated from PLACEHOLDER_TESTIMONIALS,
// the same placeholder set the case pages and the CMS prefill already use: an
// explicitly unconfirmed name, a generic role, the mall the case was run at, and
// a quote marked Placeholder. Nothing is invented, and the donor's staff photos
// and trademarks stop shipping on the page.
//
// Runs before applyStructuredCMS, so a testimonial saved in the admin still
// wins over all of this.
export function applyTestimonialClientFix(html) {
  try {
    if (html.indexOf('testimonialTemplate') < 0) return html;
    const badBefore = (() => { try { return verifyFlight(html).bad; } catch { return 0; } })();
    const delim = 'self.__next_f.push(';
    const parts = html.split(delim);
    const KEY = /\\"testimonialTemplate\\":\{/g;
    const q = (v) => `\\"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}\\"`;
    let out = parts[0];
    for (let i = 1; i < parts.length; i++) {
      const seg = parts[i];
      const nodes = [...seg.matchAll(KEY)];
      // One edit per item: the node body (quote / role / org) and the
      // attribution that sits just before it. Both offsets are taken from the
      // original segment and applied back to front.
      const edits = [];
      for (const m of nodes) {
        const c = CASE[(seg.slice(0, m.index).match(KEY) || []).length % CASE.length];
        const d = PLACEHOLDER_TESTIMONIALS[(seg.slice(0, m.index).match(KEY) || []).length % PLACEHOLDER_TESTIMONIALS.length];
        if (!c || !d) continue;

        let depth = 0, j = m.index + m[0].length - 1, inStr = false;
        for (; j < seg.length; j++) {
          const ch = seg[j];
          if (ch === '\\') { j++; continue; }
          if (ch === '"') { inStr = !inStr; continue; }
          if (inStr) continue;
          if (ch === '{') depth++;
          else if (ch === '}' && --depth === 0) break;
        }
        if (j >= seg.length) continue;

        // 1) the attribution preceding the node: the person's name and photo.
        // Anchored to this node by searching only the text immediately around
        // it - a segment holds several carousel items, so a segment-wide match
        // would attach every node to the first item's name and photo. The
        // window has to reach past m.index, because the pattern it is matched
        // with ends on the key that starts there.
        const cover = `/assets/stillcraft/mall-case/${c.slug}/cover.svg`;
        const from0 = Math.max(0, m.index - 400);
        const win = seg.slice(from0, m.index + m[0].length);
        const pre = /\\"title\\":\\"([^"\\]*)\\",\\"featuredImage\\":\{\\"node\\":\{\\"sourceUrl\\":\\"([^"\\]*)\\"\}\},\\"testimonialTemplate\\":\{$/.exec(win);
        if (pre) {
          const at = from0 + pre.index;
          const nb = `\\"title\\":${q(d.name)},\\"featuredImage\\":{\\"node\\":{\\"sourceUrl\\":${q(cover)}}},\\"testimonialTemplate\\":{`;
          edits.push([at, pre[0], nb]);
        }

        // 2) the node body: the quote, the role and the employer.
        const start = m.index + m[0].length;
        const body = seg.slice(start, j);
        const nb = body
          .replace(/\\"testimonial\\":\\"(?:[^"\\]|\\.)*\\"/, `\\"testimonial\\":${q(d.quote)}`)
          .replace(/\\"role\\":\\"(?:[^"\\]|\\.)*\\"/, `\\"role\\":${q(d.role)}`)
          .replace(/\\"organization\\":\{\\"name\\":\\"(?:[^"\\]|\\.)*\\"/, `\\"organization\\":{\\"name\\":${q(d.org)}`);
        if (nb !== body) edits.push([start, body, nb]);
      }
      // Highest offset first, so nothing shifts underneath an earlier edit.
      edits.sort((a, b) => b[0] - a[0]);
      let s = seg;
      for (const [at, from, to] of edits) {
        if (s.slice(at, at + from.length) !== from) continue;
        s = s.slice(0, at) + to + s.slice(at + from.length);
      }
      out += delim + s;
    }
    if (out === html) return html;
    try { if (verifyFlight(out).bad > badBefore) return html; } catch { return html; }
    return out;
  } catch { return html; }
}

// A handful of images are referenced by the captured markup but were never
// committed to dist/ - the capture pulled the page without pulling every asset
// it names. They are preloaded on every case page, so the browser requests them
// and gets a 404 before rendering anything. Re-point each one at the case cover
// the page has already loaded, which keeps the markup valid and stops the
// request. Listed explicitly rather than probed on disk, because a stat() per
// referenced image on every request would cost more than the 404s do.
const MISSING_ASSETS = ['/assets/cms/wp-content/uploads/2025/08/Events-StillCraft%20Events%20Co..jpg'];
export function applyMissingAssetFix(html, page) {
  try {
    if (!html.includes('Events-StillCraft%20Events%20Co..jpg')) return html;
    const m = /^\/project\/([a-z0-9-]+)\/?$/.exec(String(page || ''));
    const c = m ? CASE.find((x) => x.slug === m[1]) : CASE[0];
    if (!c) return html;
    const cover = `/assets/stillcraft/mall-case/${c.slug}/cover.svg`;
    let out = html;
    for (const a of MISSING_ASSETS) out = out.split(a).join(cover);
    if (out === html) return html;
    try { if (verifyFlight(out).bad > verifyFlight(html).bad) return html; } catch { return html; }
    return out;
  } catch { return html; }
}
// The three service lanes already resolve to the case library in the payload -
// every card slug on /service/events, /service/exhibits and /service/congresses
// is one of the eleven StillCraft cases. Their static pre-render was left behind
// by the conversion, though, and still described the donor's engagements: an
// ISE stand, an Integrated Systems Europe show-leadership entry, an Menzies
// congress in Costa Brava, a "five-day hackathon" of 200 international
// participants. Left alone, the page shipped donor client work, named the
// donor's trade shows, and contradicted its own payload on first paint.
//
// Each affected block is restated from the case its card already points at, so
// the static text and the payload describe the same StillCraft work and no
// project is invented. The exhibits lane intro is plain text rather than a
// line-slot block, so it is handled by a direct replacement.
const DONOR_ENTITY = new RegExp(
  '\\b(?:ISE|MWC|ICE|Integrated Systems Europe|Menzies|NOVOMATIC|Adevinta|CordenPharma|Radisys' +
  '|Ampetronic|Euroleague|UEFA|Pfizer|Turkish Airlines|VEEAM|FedEx|Rakuten|Costa Brava' +
  '|VIP360|epayclub)\\b|hackathon', 'i');
// The exhibits lane intro named two of the donor's trade shows. It is a single
// paragraph of plain text in the static markup (not a line-slot block, and not
// present in the payload at all), so it is replaced directly.
const EXHIBITS_DESCRIPTION_OLD = 'Whether it\u2019s ISE, MWC, or a niche industry show, we deliver booths that combine creativity with flawless execution.';
const EXHIBITS_DESCRIPTION_NEW = 'Whether it\u2019s a flagship industry show or a niche one, we deliver stands that combine creativity with flawless execution.';
export function applyServiceCopyFix(html) {
  try {
    const flightAt = html.indexOf('self.__next_f.push(');
    if (flightAt < 0) return html;
    let stat = html.slice(0, flightAt).split(EXHIBITS_DESCRIPTION_OLD).join(EXHIBITS_DESCRIPTION_NEW);
    const rest = html.slice(flightAt);
    const re = /<p\b[^>]*>/g;
    const blocks = [];
    let m, idx = 0;
    while ((m = re.exec(stat))) {
      const close = stat.indexOf('</p>', m.index);
      if (close < 0) break;
      const seg = stat.slice(m.index, close);
      if (seg.includes('line fix-clip')) {
        const lines = [...seg.matchAll(/(<div class="line fix-clip"[^>]*>)([\s\S]*?)(<\/div>)/g)]
          .map((x) => ({ at: m.index + x.index, len: x[0].length, open: x[1], close: x[3], text: x[2] }));
        const text = lines.map((l) => l.text.replace(/<!-- -->/g, '').trim()).join(' ');
        if (lines.length >= 2 && DONOR_ENTITY.test(text)) {
          const c = CASE[idx % CASE.length];
          if (c) blocks.push({ lines, c });
          idx++;
        }
      }
      re.lastIndex = close;
    }
    // Last to first: rewriting a block shifts everything after it.
    for (let i = blocks.length - 1; i >= 0; i--) {
      const { lines, c } = blocks[i];
      let s = setQuoteLines(stat, lines, c.excerpt);
      // The case title takes the first line, the excerpt the rest.
      const first = lines[0];
      s = s.slice(0, first.at) + first.open + teaserEscape(c.title) + first.close + s.slice(first.at + first.len);
      stat = s;
    }
    return stat + rest;
  } catch { return html; }
}

// The payload quote is restated by applyTestimonialClientFix, but each quote is
// also pre-rendered in the static markup as a fixed set of line divs, and those
// still carried the donor's words: "this UCL Final", "The 2025 Final Four in
// Abu Dhabi", "collaborating with them on ISE". The line count is dictated by
// the markup, so the replacement is re-flowed word by word into the same
// budgets rather than reflowed by the browser - otherwise the reveal animation
// masks the wrong number of lines.
//
// The donor's employer also survives as a bare chip in the same static run as
// the detail grid ("Pfizer" printed under a location). The grid pass above
// deliberately stops at the four published groups, so the chip is replaced here
// instead, where the donor name is already known to be the donor's.
//
// Static only: both live before the first flight push, so no row length prefix
// is touched.
const DONOR_ORGS = new Set([
  'UEFA', 'Euroleague', 'Pfizer', 'CordenPharma', 'CordenPharma International',
  'Radisys', 'Ampetronic', 'Ampetronic | Listen Technologies', 'Menzies',
  'Adevinta', 'Midas Console',
]);
export function applyServiceQuoteFix(html) {
  try {
    const flightAt = html.indexOf('self.__next_f.push(');
    if (flightAt < 0) return html;
    const stat = html.slice(0, flightAt);
    let out = stat;

    // 1) quote blocks, in the same order as the payload's testimonial nodes.
    // Collected first, then applied last-to-first: rewriting a block changes the
    // length of everything after it, so applying them in document order would
    // splice later blocks at offsets taken from the pre-rewrite string.
    const re = /<p\b[^>]*>/g;
    const blocks = [];
    let m;
    while ((m = re.exec(stat))) {
      const close = stat.indexOf('</p>', m.index);
      if (close < 0) break;
      const seg = stat.slice(m.index, close);
      if (seg.includes('line fix-clip')) {
        const lines = [...seg.matchAll(/(<div class="line fix-clip"[^>]*>)([\s\S]*?)(<\/div>)/g)]
          .map((x) => ({ at: m.index + x.index, len: x[0].length, open: x[1], close: x[3], text: x[2] }));
        const text = lines.map((l) => l.text.replace(/<!-- -->/g, '').trim()).join(' ');
        // A quote is a run of three or more lines carrying quotation marks; the
        // one- and two-line runs in the same markup are headings and chips.
        if (lines.length >= 3 && /[\u201c\u201d"]/.test(text)) blocks.push(lines);
      }
      re.lastIndex = close;
    }
    for (let i = blocks.length - 1; i >= 0; i--) {
      const d = PLACEHOLDER_TESTIMONIALS[i % PLACEHOLDER_TESTIMONIALS.length];
      if (d) out = setQuoteLines(out, blocks[i], d.quote);
    }

    // 2) donor employer chips in the static detail grid run.
    out = out.replace(/(<span\b[^>]*class="css-1kjo4sp"[^>]*>)([^<]+)(<\/span>)/g, (full, a, text, c) => {
      const t = text.trim();
      if (!DONOR_ORGS.has(t)) return full;
      const d = PLACEHOLDER_TESTIMONIALS[0];
      return a + teaserEscape(d.org) + c;
    });

    if (out === stat) return html;
    return out + html.slice(flightAt);
  } catch { return html; }
}

// Re-flow `newText` across an existing quote block's line slots, respecting each
// line's original character budget so the reveal animation keeps its geometry.
function setQuoteLines(html, lines, newText) {
  const budgets = lines.map((l) => l.text.replace(/<!-- -->/g, '').trim().length);
  const words = String(newText).split(/\s+/).filter(Boolean);
  const chunks = budgets.map(() => []);
  let w = 0;
  for (let i = 0; i < chunks.length && w < words.length; i++) {
    let used = 0;
    while (w < words.length) {
      const need = words[w].length + (chunks[i].length ? 1 : 0);
      // Always place one word per line, then respect the budget.
      if (chunks[i].length && used + need > budgets[i]) break;
      chunks[i].push(words[w]);
      used += need;
      w++;
    }
  }
  // Anything left over goes on the last line rather than being dropped.
  if (w < words.length && chunks.length) chunks[chunks.length - 1].push(...words.slice(w));

  let out = html;
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    const text = (chunks[i] || []).join(' ');
    out = out.slice(0, l.at) + l.open + teaserEscape(text) + l.close + out.slice(l.at + l.len);
  }
  return out;
}

// photographs are also referenced outside the payload: the static markup
// preloads each testimonial portrait up front (<link rel="preload"> and the
// matching <img srcset>), so every service lane and the home page still
// shipped the donor's team members' faces even with the names replaced. The
// rendered photo now comes from the payload, so these are preload hints only -
// re-pointing them at the mall cover keeps the DOM shape, drops the preloads of
// images the page no longer shows, and stops the donor's photos being
// requested at all.
//
// Listed by file name because the whole directory is the donor's upload tree;
// matching the name anywhere catches every year/month copy of it.
const DONOR_STAFF_IMAGES = new Set([
  'Adel-Kertesz-UEFA.jpg', 'Bruno-Sciamanna.jpg', 'Camilla-Di-Zenzo.jpg',
  'Camilla-Di-Zenzo-scaled.jpg', 'Costanza-Rota.jpg', 'Ella-McClary.jpg',
  'Jo-Harrison.jpg', 'Leonardo-Mantovani.jpg', 'Marco-Leira.jpg',
  'Theresa-Ruivo.jpg', '1517441658058.jpg',
]);
const CMS_UPLOAD = /\/assets\/cms\/wp-content\/uploads\/[^"'\\ )]*\/([^/"'\\ )]+?\.(?:jpg|jpeg|png|webp|svg))/g;
export function applyDonorStaffImageFix(html) {
  try {
    if (html.indexOf('/assets/cms/wp-content/uploads/') < 0) return html;
    const badBefore = (() => { try { return verifyFlight(html).bad; } catch { return 0; } })();
    let k = 0;
    const swap = (s) => s.replace(CMS_UPLOAD, (full, name) => {
      if (!DONOR_STAFF_IMAGES.has(name)) return full;
      const c = CASE[k % CASE.length];
      k++;
      return c ? `/assets/stillcraft/mall-case/${c.slug}/cover.svg` : full;
    });
    // The payload's length prefixes make a same-length swap impossible here, so
    // the flight half is only kept if the row structure still verifies; the
    // static half is unconditional.
    const out = swap(html);
    if (out !== html) {
      try { if (verifyFlight(out).bad > badBefore) return swap(html.slice(0, html.indexOf('self.__next_f.push('))); } catch { /* keep */ }
    }
    return out;
  } catch { return html; }
}

// template page, so the RSC payload still announced the donor route
// (`"c":["","project","ypo-global-event"]` and the matching `["slug", ...]`).
// The visible copy is rewritten per case, but the payload disagreed with the
// URL it was served at: React would hydrate against a route the page is not,
// and the donor slug shipped to the client on all 11 case pages. Re-point the
// payload at the slug actually being served. safeReplaceVerified decodes,
// substitutes and re-encodes with fresh row lengths, so the length prefixes
// stay valid.
export function applyCaseRouteSlug(html, page) {
  try {
    const m = /^\/project\/([a-z0-9-]+)\/?$/.exec(String(page || ''));
    if (!m) return html;
    const slug = m[1];
    if (!CASE_BY_IDX.find((x) => x.slug === slug)) return html;
    // Read the route segment the payload currently claims, in both shapes
    // Next.js emits it.
    const claimed = new Set();
    for (const re of [/\\"c\\":\[\\"\\",\\"project\\",\\"([^\\"]+)\\"\]/g, /\\"slug\\",\\"([^\\"]+)\\",\\"d\\"/g]) {
      let mm;
      while ((mm = re.exec(html))) claimed.add(mm[1]);
    }
    if (!claimed.size) return html;
    const badBefore = (() => { try { return verifyFlight(html).bad; } catch { return 0; } })();
    // The route tree lives in the flight's `0:` row, which carries no length
    // prefix, so a plain substitution cannot desynchronise a row header here.
    // verifyFlight is still the gate: if a claimed slug ever also appears in a
    // length-prefixed row, the row count would change and this bails.
    let out = html;
    for (const c of claimed) {
      // Never touch a slug that is one of ours: only the foreign template
      // route needs re-pointing.
      if (c === slug || CASE_BY_IDX.find((x) => x.slug === c)) continue;
      out = out.split(c).join(slug);
    }
    if (out === html) return html;
    try { if (verifyFlight(out).bad > badBefore) return html; } catch { return html; }
    return out;
  } catch { return html; }
}
// Case pages carry the YPO template's meta description. Set brief-correct
// per-case descriptions (static metas + flight metadata), oracle-guarded.
export function applyCaseMetaFix(html, page) {
  try {
    const m = /^\/project\/([a-z0-9-]+)\/?$/.exec(String(page || ''));
    if (!m) return html;
    const c = CASE_BY_IDX.find((x) => x.slug === m[1]);
    if (!c) return html;
    const want = `${c.title}: ${c.excerpt} A StillCraft Events case study.`;
    const YPO_DESC = 'We brought Nairobi’s spirit to life for the YPO Global Event 2025: a bold and seamless CEO summit igniting vision and connection.';
    const P = [];
    if (html.includes(YPO_DESC)) {
      P.push([YPO_DESC, want]);
      P.push([YPO_DESC.split('"').join('\\"'), want]);
    }
    // static meta tags → case description (whatever they currently hold)
    const metaRe = /(<meta[^>]*(?:name="description"|property="og:description"|name="twitter:description")[^>]*content=")[^"]*(")/gi;
    let mm, metas = 0;
    while ((mm = metaRe.exec(html))) metas++;
    if (metas > 0 && metas <= 6) {
      html = html.replace(metaRe, (full, a, b) => a + want.replace(/"/g, '&quot;') + b);
    }
    if (!P.length) return html;
    const badBefore = (() => { try { return verifyFlight(html).bad; } catch { return 0; } })();
    const out = safeReplacePairs(html, P);
    if (out === html) return html;
    try { if (verifyFlight(out).bad > badBefore) return html; } catch { return html; }
    return out;
  } catch { return html; }
}

// Case detail pages shipped the narrative as a label heading + body paragraph:
// "The Situation" / "What We Did" / "The Result". Those headings were noise the
// client did not want, and worse, the data-sc-id (t-27/28/29) the admin CMS
// reads sat on the HEADING, not the paragraph, so the admin pre-filled the
// label text instead of the case copy. Drop the headings and move the id onto
// the paragraph that follows so the admin edits the real prose. The narrative
// blocks are server-rendered only (they do not appear in the flight payload),
// so this is a static-markup edit and does not disturb React hydration.
export function applyCaseNarrative(html, page) {
  try {
    const m = /^\/project\/([a-z0-9-]+)\/?$/.exec(String(page || ''));
    if (!m) return html;
    if (!CASE_BY_IDX.find((x) => x.slug === m[1])) return html;
    let out = html;
    let touched = false;
    for (const id of ['t-27', 't-28', 't-29']) {
      // The label heading, e.g. <h6 data-sc-id="t-27" ...>The Situation</h6>
      const hRe = new RegExp('<h6\\b[^>]*\\bdata-sc-id="' + id + '"[^>]*>[\\s\\S]*?<\\/h6>');
      const hm = hRe.exec(out);
      if (!hm) continue;
      // Re-tag the id onto the first narrative paragraph after the heading, so
      // extractProjects() keeps resolving to the case prose rather than nothing.
      const pRe = /<div class="Paragraph_paragraph__[^"]*"/g;
      pRe.lastIndex = hm.index + hm[0].length;
      const pm = pRe.exec(out);
      if (pm && !/data-sc-id=/.test(pm[0])) {
        out = out.slice(0, pm.index) + pm[0] + ' data-sc-id="' + id + '"' + out.slice(pm.index + pm[0].length);
        touched = true;
      }
      // Re-find the heading (paragraph insert shifted nothing before it) and drop it.
      const hm2 = hRe.exec(out);
      if (hm2) {
        out = out.slice(0, hm2.index) + out.slice(hm2.index + hm2[0].length);
        touched = true;
      }
    }
    return touched ? out : html;
  } catch { return html; }
}
export function applyLogosFix(html, items) {
  if (html.indexOf('js-worked-brand') < 0 && html.indexOf('partners') < 0) return html;
  // --- head preloads for template logo files (rewritten/dropped below) ---
  for (const src of Object.keys(WALL_SRC_MAP)) {
    const esc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`<link\\b[^>]*${esc}[^>]*>\\s*`, 'g'), '');
  }
  // dropped wall files have no mapping entry: strip by basename
  for (const base of ['EABL.png', 'GIOVANE%20GENTILE.png', 'GIOVANE GENTILE.png', 'HEINEKEN.png', 'KITU%20KALI.webp', 'KITU KALI.webp', 'LINTONS.png', 'MASTERCARD.png', 'OPPO.png', 'PUMA.png', 'YALLO.png', 'Ribbon.svg']) {
    const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`<link\\b[^>]*${esc}[^>]*>\\s*`, 'g'), '');
  }
  // CMS list drives the wall wholesale (19 client slots, position keyed):
  // every name, coverflow image and flight partner node is rebuilt to match.
  if (Array.isArray(items) && items.length) {
    return wallRebuild(html, items.slice(0, 19));
  }
  for (const t of WALL_DROP_TITLES) {
    const slug = t.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    html = html.replace(new RegExp(`<link\\b[^>]*${slug}[^>]*>\\s*`, 'gi'), '');
  }
  // --- static names: drop whole <p data-sc-id="t-XX">…</p> ---
  for (const id of WALL_DROP_T) {
    html = html.replace(new RegExp(`<p\\b[^<>]*data-sc-id="${id}"[^<>]*>[\\s\\S]*?<\\/p>`, 'g'), '');
  }
  // --- static images: drop the coverflow card containing the dropped <img> ---
  const IID = WALL_DROP_I.map((id) => `data-sc-id="${id}"`);
  let guard = 0;
  while (guard++ < 12) {
    let at = -1, which = '';
    for (const needle of IID) {
      const i = html.indexOf(needle);
      if (i >= 0 && (at < 0 || i < at)) { at = i; which = needle; }
    }
    if (at < 0) break;
    const open = html.lastIndexOf('<div class="css-1c6heav"', at);
    if (open < 0) break;
    const end = cutBalancedDiv(html, open);
    if (end < 0) break;
    html = html.slice(0, open) + html.slice(end);
  }
  // --- flight partners array: drop 9 nodes, rewrite 10 ---
  try {
    const out = wallFixFlight(html);
    if (out && out !== html) html = out;
  } catch { /* static-only fix stands */ }
  return html;
}
function wallFixFlight(html) {
  const BS = String.fromCharCode(92);
  const FQ = BS + '"';
  const key = FQ + 'partners' + FQ + ':[';
  let idx = html.indexOf(key);
  let guard = 0;
  while (idx >= 0 && guard++ < 6) {
    const open = idx + key.length - 1;
    let depth = 0, k = open, end = -1;
    for (; k < html.length; k++) {
      const c = html[k];
      if (c === BS) { k++; continue; }
      if (c === '[') depth++;
      else if (c === ']') { depth--; if (depth === 0) { end = k; break; } }
      if (k - open > 60000) break;
    }
    if (end < 0) break;
    const inner = html.slice(open + 1, end);
    if (!inner.includes('featuredImage')) { idx = html.indexOf(key, end); continue; }
    const nodes = [];
    let d2 = 0, s2 = open + 1;
    for (let q = open + 1; q < end; q++) {
      const c = html[q];
      if (c === BS) { q++; continue; }
      if (c === '{') { if (d2 === 0) s2 = q; d2++; }
      else if (c === '}') { d2--; if (d2 === 0) nodes.push(html.slice(s2, q + 1)); }
    }
    if (nodes.length < 10) { idx = html.indexOf(key, end); continue; }
    const kept = [];
    const titleLead = FQ + 'title' + FQ + ':' + FQ;
    const srcLead = FQ + 'sourceUrl' + FQ + ':' + FQ;
    for (const n of nodes) {
      let title = '', src = '';
      const ti = n.indexOf(titleLead);
      if (ti >= 0) {
        const tj = n.indexOf(FQ, ti + titleLead.length);
        if (tj > ti) title = n.slice(ti + titleLead.length, tj);
      }
      const si = n.indexOf(srcLead);
      if (si >= 0) {
        const sj = n.indexOf(FQ, si + srcLead.length);
        if (sj > si) src = n.slice(si + srcLead.length, sj);
      }
      if (WALL_DROP_TITLES.includes(title)) continue;
      if (src && WALL_SRC_MAP[src]) {
        const [nt, ns] = WALL_SRC_MAP[src];
        let nn = n.split(FQ + 'title' + FQ + ':' + FQ + title + FQ).join(FQ + 'title' + FQ + ':' + FQ + nt + FQ);
        nn = nn.split(src).join(ns);
        kept.push(nn);
      } else {
        kept.push(n);
      }
    }
    if (!kept.length || kept.length === nodes.length) { idx = html.indexOf(key, end); continue; }
    const fresh = kept.join(',');
    const before = html.slice(open + 1, end);
    if (before === fresh) { idx = html.indexOf(key, end); continue; }
    const badBefore = (() => { try { return verifyFlight(html).bad; } catch { return 0; } })();
    // Length-synced swap (the array may sit inside a length-framed flight row).
    const cand = safeReplacePairs(html, [[before, fresh]]);
    if (cand === html) { idx = html.indexOf(key, end); continue; }
    try {
      if (verifyFlight(cand).bad > badBefore) { idx = html.indexOf(key, end); continue; }
    } catch { idx = html.indexOf(key, end); continue; }
    html = cand;
    idx = html.indexOf(key, idx + fresh.length);
  }
  return html;
}
// Wall rebuild driven by the CMS logos list. The template home ships a fixed
// 19-slot wall (name labels t-32..t-50, coverflow cards with image pairs
// i-39..i-76, and a flight "partners" node per slot). Every slot is rewritten
// positionally to match the admin's saved items; slots beyond the list are
// dropped (labels, cards and flight nodes alike). Length-synced engine swaps
// plus the flight oracle guard keep the page valid no matter the input.
function wallRebuild(html, items) {
  const used = Array.from({ length: 19 }, (_, k) => items[k] || null);
  const oldSrcs = collectWallOldSrcs(html);
  // --- 1) name labels t-32..t-50 ---
  for (let k = 0; k < 19; k++) {
    const id = 't-' + (32 + k);
    if (used[k]) {
      const name = String(used[k].name == null ? '' : used[k].name)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;');
      html = html.replace(new RegExp(`(<p[^>]*data-sc-id="${id}"[^>]*>)[^<]*(</p>)`), (m, a, b) => a + name + b);
    } else {
      html = html.replace(new RegExp(`<p\\b[^<>]*data-sc-id="${id}"[^<>]*>[\\s\\S]*?<\\/p>`, 'g'), '');
    }
  }
  // --- 2) coverflow images i-39..i-76 (slot k → i-[39+2k] + i-[40+2k]) ---
  for (let k = 0; k < 19; k++) {
    const a = 'i-' + (39 + 2 * k);
    const b = 'i-' + (40 + 2 * k);
    const it = used[k];
    if (it && it.src) {
      html = wallImgTag(html, a, String(it.src), true);
      html = wallImgTag(html, b, String(it.src), false);
    } else {
      html = dropWallCard(html, a, b);
    }
  }
  // --- 3) drop stale <head> preloads for old logo files ---
  for (const os of oldSrcs) {
    html = html.replace(new RegExp(`<link\\b[^>]*${escRegExp(os)}[^>]*>\\s*`, 'gi'), '');
  }
  // --- 4) flight partners array: rebuild every node's title + sourceUrl ---
  return wallRebuildFlight(html, used);
}
// Replace an entire <img data-sc-id="ID"> with a canonical logo tag.
function wallImgTag(html, id, src, eager) {
  const re = new RegExp(`(<img\\b[^>]*data-sc-id="${id}"[^>]*>)`);
  const tag = `<img data-sc-id="${id}" alt="logo" loading="${eager ? 'eager' : 'lazy'}" width="32" height="32" decoding="async" data-nimg="${eager ? '1' : 'fill'}" class="" style="color:transparent;object-fit:contain" srcset="${src} 1x, ${src} 2x" src="${src}">`;
  return html.match(re) ? html.replace(re, tag) : html;
}
// Remove the balanced coverflow card (css-1c6heav) that owns the image id.
function dropWallCard(html, imgId, altId) {
  let at = html.indexOf(`data-sc-id="${imgId}"`);
  if (at < 0 && altId) at = html.indexOf(`data-sc-id="${altId}"`);
  if (at < 0) return html;
  const open = html.lastIndexOf('<div class="css-1c6heav"', at);
  if (open < 0) return html;
  const end = cutBalancedDiv(html, open);
  if (end < 0) return html;
  return html.slice(0, open) + html.slice(end);
}
// Collect every sourceUrl currently sitting in the flight partners array.
function collectWallOldSrcs(html) {
  const BS = String.fromCharCode(92);
  const FQ = BS + '"';
  const key = FQ + 'partners' + FQ + ':[';
  const srcLead = FQ + 'sourceUrl' + FQ + ':' + FQ;
  const out = [];
  let idx = html.indexOf(key);
  let guard = 0;
  while (idx >= 0 && guard++ < 6) {
    const open = idx + key.length - 1;
    let depth = 0, end = -1;
    for (let k = open; k < html.length; k++) {
      const ch = html[k];
      if (ch === BS) { k++; continue; }
      if (ch === '[') depth++;
      else if (ch === ']') { depth--; if (depth === 0) { end = k; break; } }
      if (k - open > 60000) break;
    }
    if (end < 0) break;
    const inner = html.slice(open + 1, end);
    if (!inner.includes('featuredImage')) { idx = html.indexOf(key, end); continue; }
    let si = 0;
    while ((si = inner.indexOf(srcLead, si)) >= 0) {
      const sj = inner.indexOf(FQ, si + srcLead.length);
      if (sj <= si) break;
      const v = inner.slice(si + srcLead.length, sj);
      if (v && !out.includes(v)) out.push(v);
      si = sj;
    }
    idx = html.indexOf(key, end);
  }
  return out;
}
// Positional flight rebuild: slot k's node gets title/sourceUrl of items[k];
// slots with no item are removed from the array.
function wallRebuildFlight(html, used) {
  const BS = String.fromCharCode(92);
  const FQ = BS + '"';
  const key = FQ + 'partners' + FQ + ':[';
  const titleLead = FQ + 'title' + FQ + ':' + FQ;
  const srcLead = FQ + 'sourceUrl' + FQ + ':' + FQ;
  let idx = html.indexOf(key);
  let guard = 0;
  while (idx >= 0 && guard++ < 6) {
    const open = idx + key.length - 1;
    let depth = 0, k = open, end = -1;
    for (; k < html.length; k++) {
      const ch = html[k];
      if (ch === BS) { k++; continue; }
      if (ch === '[') depth++;
      else if (ch === ']') { depth--; if (depth === 0) { end = k; break; } }
      if (k - open > 60000) break;
    }
    if (end < 0) break;
    const inner = html.slice(open + 1, end);
    if (!inner.includes('featuredImage')) { idx = html.indexOf(key, end); continue; }
    const nodes = [];
    let d2 = 0, s2 = open + 1;
    for (let q = open + 1; q < end; q++) {
      const ch = html[q];
      if (ch === BS) { q++; continue; }
      if (ch === '{') { if (d2 === 0) s2 = q; d2++; }
      else if (ch === '}') { d2--; if (d2 === 0) nodes.push(html.slice(s2, q + 1)); }
    }
    if (!nodes.length) { idx = html.indexOf(key, end); continue; }
    const kept = [];
    for (let n0 = 0; n0 < nodes.length; n0++) {
      const it = used[n0];
      if (!it) continue;
      let nn = nodes[n0];
      const si = nn.indexOf(srcLead);
      if (si >= 0) {
        const sj = nn.indexOf(FQ, si + srcLead.length);
        if (sj > si) {
          const old = nn.slice(si + srcLead.length, sj);
          if (it.src && old !== it.src) nn = nn.split(old).join(String(it.src));
        }
      }
      const ti = nn.indexOf(titleLead);
      if (ti >= 0 && it.name) {
        const tj = nn.indexOf(FQ, ti + titleLead.length);
        if (tj > ti) {
          const oldT = nn.slice(ti + titleLead.length, tj);
          const name = String(it.name);
          if (oldT !== name) {
            nn = nn.split(FQ + 'title' + FQ + ':' + FQ + oldT + FQ)
              .join(FQ + 'title' + FQ + ':' + FQ + name + FQ);
          }
        }
      }
      kept.push(nn);
    }
    if (!kept.length) { idx = html.indexOf(key, end); continue; }
    const fresh = kept.join(',');
    const before = html.slice(open + 1, end);
    if (before === fresh) { idx = html.indexOf(key, end); continue; }
    const badBefore = (() => { try { return verifyFlight(html).bad; } catch { return 0; } })();
    const cand = safeReplacePairs(html, [[before, fresh]]);
    if (cand === html) { idx = html.indexOf(key, end); continue; }
    try {
      if (verifyFlight(cand).bad > badBefore) { idx = html.indexOf(key, end); continue; }
    } catch { idx = html.indexOf(key, end); continue; }
    html = cand;
    idx = html.indexOf(key, idx + fresh.length);
  }
  return html;
}
function escRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// StillCraft stats: the template block ships 5 achievements (270+ projects,
// 90% clients, 21 nationalities, 31 countries, 1.2K moments). The brief keeps
// only confirmed figures — Projects Delivered 150+ and Loyal Clients 88%.
// This rewrites slots 1-2 in place and drops slots 3-5 from static markup and
// the flight achievements array (guarded: any flight-oracle regression reverts
// the flight half, static edits are plain string ops).
export function applyStatsFix(html) {
  if (html.indexOf('Projects Delivered') < 0 || html.indexOf('achievements') < 0) return html;
  // --- 1) flight achievements array: keep ALL nodes (no truncation), }
  // (show every stat card incl. the 5th; value rewrites happen in step 3) ---
  try {
    const out = statsFixFlight(html);
    if (out && out !== html) html = out;
  } catch { /* keep static-only fix */ }
  // --- 3) slot 1-2 values → 150+ / 88% + StillCraft blurbs ---
  html = html.split('>270<').join('>150<');
  html = html.split('>90<').join('>88<');
  html = html.split('Big stages, small details. Each one designed to leave a mark.')
    .join('Eight years of mall programmes, brand activations and corporate environments, planned and delivered by one team.');
  html = html.split('Our clients love to come back, proof that true partnership lasts.')
    .join('Most of our work comes from clients who return. Repeat business earned on the ground, not promised in a pitch.');
  return html;
}
// Keep the first 2 items of every run of exactly 5 consecutive sibling items
// (openTag … leaf <p>s … close). Other runs (different widgets reusing the
// same classes) are left untouched.
function statsKeepFirstTwo(html, openTag, innerTag, closeTag) {
  const openEsc = openTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${openEsc}[^>]*>(?:<p[^>]*>[^<]*<\\/p>)+<\\/${closeTag.slice(2)}`, 'g');
  const hits = [...html.matchAll(re)];
  if (!hits.length) return html;
  // group consecutive hits (only whitespace between them)
  const groups = [];
  let cur = [hits[0]];
  for (let k = 1; k < hits.length; k++) {
    const gap = html.slice(hits[k - 1].index + hits[k - 1][0].length, hits[k].index);
    if (/^[\s]*$/.test(gap)) cur.push(hits[k]);
    else { groups.push(cur); cur = [hits[k]]; }
  }
  groups.push(cur);
  // drop items 3-5 of 5-runs, back to front
  const drop = [];
  for (const g of groups) {
    if (g.length === 5) drop.push(g[2], g[3], g[4]);
  }
  drop.sort((a, b) => b.index - a.index);
  for (const d of drop) html = html.slice(0, d.index) + html.slice(d.index + d[0].length);
  return html;
}
// Balanced-div aware: keep first 2 of a 5-run (embla slides, icon panels).
function statsKeepFirstTwoBalanced(html, open) {
  const idxs = [];
  let at = 0;
  while (true) {
    const i = html.indexOf(open, at);
    if (i < 0) break;
    // open must be a div start (avoid matching longer class names)
    const after = html.slice(i + open.length, i + open.length + 8);
    if (after[0] !== '"' && after[0] !== ' ') { at = i + open.length; continue; }
    idxs.push(i);
    at = i + open.length;
  }
  if (idxs.length !== 5) return html;
  const ends = idxs.map((s) => cutBalancedDiv(html, s));
  if (ends.some((e) => e < 0)) return html;
  // Contiguity check: only whitespace between consecutive items.
  for (let k = 0; k < 4; k++) {
    if (!/^[\s]*$/.test(html.slice(ends[k], idxs[k + 1]))) return html;
  }
  return html.slice(0, idxs[2]) + html.slice(ends[4]);
}
// Flight surgery on the achievements array (escape-aware, length-synced).
// NOTE: flight text escapes every quote as \" so scanners must skip \X pairs
// unconditionally (same convention as matchBracket in scripts/cms.mjs) rather
// than tracking string state — a \" outside a string is not a delimiter.
function statsFixFlight(html) {
  const BS = String.fromCharCode(92);
  const FQ = BS + '"';
  const key = FQ + 'achievements' + FQ + ':[';
  let idx = html.indexOf(key);
  let guard = 0, changed = false;
  while (idx >= 0 && guard++ < 6) {
    // escape-aware bracket match from the opening '[' (skip \X pairs)
    const open = idx + key.length - 1;
    let depth = 0, k = open, end = -1;
    for (; k < html.length; k++) {
      const c = html[k];
      if (c === BS) { k++; continue; }
      if (c === '[') depth++;
      else if (c === ']') { depth--; if (depth === 0) { end = k; break; } }
      if (k - open > 60000) break;
    }
    if (end < 0) break;
    const inner = html.slice(open + 1, end);
    if (!inner.includes('Projects Delivered') || !inner.includes('Lightbulb Moments')) {
      idx = html.indexOf(key, end);
      continue;
    }
    // split top-level nodes (skip \X pairs, count braces)
    const nodes = [];
    let d2 = 0, s2 = open + 1;
    for (let q = open + 1; q < end; q++) {
      const c = html[q];
      if (c === BS) { q++; continue; }
      if (c === '{') { if (d2 === 0) s2 = q; d2++; }
      else if (c === '}') { d2--; if (d2 === 0) nodes.push(html.slice(s2, q + 1)); }
    }
    if (nodes.length !== 5) { idx = html.indexOf(key, end); continue; }
    // keep ALL nodes (no truncation) → show every stat card incl. the 5th with
    // its image; slot value/blurb rewrites below are flight-encoded planes.
    let fresh = nodes.join(',');
    // slot values → 150+ / 88% + StillCraft blurbs (flight-encoded planes)
    fresh = fresh.split('\\"amount\\":270').join('\\"amount\\":150');
    fresh = fresh.split('"amount":270').join('"amount":150');
    fresh = fresh.split('\\"amount\\":90').join('\\"amount\\":88');
    fresh = fresh.split('"amount":90').join('"amount":88');
    fresh = fresh.split('Big stages, small details. Each one designed to leave a mark.')
      .join('Eight years of mall programmes, brand activations and corporate environments, planned and delivered by one team.');
    fresh = fresh.split('Our clients love to come back, proof that true partnership lasts.')
      .join('Most of our work comes from clients who return. Repeat business earned on the ground, not promised in a pitch.');
    const before = html.slice(open + 1, end);
    if (before === fresh) { idx = html.indexOf(key, end); continue; }
    const badBefore = (() => { try { return verifyFlight(html).bad; } catch { return 0; } })();
    const cand = html.slice(0, open + 1) + fresh + html.slice(end);
    let badAfter = badBefore;
    try { badAfter = verifyFlight(cand).bad; } catch { idx = html.indexOf(key, end); continue; }
    if (badAfter > badBefore) { idx = html.indexOf(key, end); continue; }
    html = cand;
    changed = true;
    idx = html.indexOf(key, idx + fresh.length);
  }
  return changed ? html : html;
}
function applyNav(html, page) {
  const __dbg_before = (html.match(/href="\/projects"/g) || []).length;
  for (const [from, to] of NAV_LABELS) {
    html = html.replace(new RegExp(`>(\\s*)${from}(\\s*)<`, 'g'), `>$1${to}$2<`);
  }
  html = applyFlightIA(html);
  for (const href of NAV_DROP_HREFS) {
    const esc = href.replace(/\//g, '\\/');
    // header menu overlay: plain-text anchors
    html = html.replace(new RegExp(`<a\\b[^<>]*href="${esc}"[^<>]*>\\s*(?:Sports)\\s*<\\/a>`, 'g'), '');
    // footer Explore: drop the whole <p> block (not just the <a>, no empty shells)
    html = html.replace(new RegExp(`<p\\b[^<>]*>\\s*<a\\b[^<>]*href="${esc}"[^<>]*>\\s*<span\\b[^<>]*>\\s*(?:Sports)\\s*<\\/span>\\s*<\\/a>\\s*<\\/p>`, 'g'), '');
  }
  // /projects is retired from all menus (its listing lives behind "Our Work"
  // and "View our work" buttons): drop the whole wrapper block in header +
  // footer (no empty shells) and strip the anchors wherever they appear.
  // Order matters: remove the wrapper FIRST (while the <a> is still inside
  // it), then strip any bare <a> that survived outside a wrapper.
  // /service/congresses (Mall Space Monetization) is a live service lane and
  // stays linked everywhere.
  for (const href of ['/projects']) {
    const esc = href.replace(/\//g, '\\/');
    const before = (html.match(new RegExp(`href="${esc}"`, 'g')) || []).length;
    // footer uses <p> wrappers, header menu uses <li> wrappers
    html = html.replace(new RegExp(`<p\\b[^<>]*>\\s*<a\\b[^<>]*href="${esc}"[^<>]*>[\\s\\S]*?<\\/a>\\s*<\\/p>`, 'g'), '');
    html = html.replace(new RegExp(`<li\\b[^<>]*>\\s*<a\\b[^<>]*href="${esc}"[^<>]*>[\\s\\S]*?<\\/a>\\s*<\\/li>`, 'g'), '');
    const afterP = (html.match(new RegExp(`href="${esc}"`, 'g')) || []).length;
    html = html.replace(new RegExp(`<a\\b[^<>]*href="${esc}"[^<>]*>[\\s\\S]*?<\\/a>`, 'g'), '');
    const afterA = (html.match(new RegExp(`href="${esc}"`, 'g')) || []).length;
    // also strip bare <p>/<li> shells left after anchor removal
    html = html.replace(new RegExp(`<p\\b[^<>]*>\\s*<\\/p>`, 'g'), '');
    html = html.replace(new RegExp(`<p\\b[^<>]*class="[^"]*"[^<>]*>\\s*<\\/p>`, 'g'), '');
    html = html.replace(new RegExp(`<li\\b[^<>]*>\\s*<\\/li>`, 'g'), '');
    html = html.replace(new RegExp(`<li\\b[^<>]*class="[^"]*"[^<>]*>\\s*<\\/li>`, 'g'), '');
    console.error(`[applyNav] ${href}: before=${before} afterP=${afterP} afterA=${afterA}`);
  }
  // The retired blog's homepage band becomes a case-study teaser. This runs
  // BEFORE the /insights link stripping below so the band's own CTAs can be
  // repointed at /case-studies instead of being deleted along with the rest.
  // If the rewrite cannot land (donor copy drifted, guard tripped), fall back
  // to cutting the whole block so no donor insights content is ever published.
  const teased = applyCaseTeaser(html);
  html = teased === html ? html : teased;
  // blog removed - strip from header and footer (whole footer <p>, no empty shells)
  html = html.replace(/<a\b[^>]*href="\/insights"[^>]*>[\s\S]*?<\/a>/gi, '');
  html = html.replace(/<p\b[^<>]*>\s*<a\b[^<>]*href="\/insights"[^<>]*>[\s\S]*?<\/a>\s*<\/p>/gi, '');
  html = html.replace(/<a\b[^>]*href="\/insights"[^>]*>\s*<span[^>]*>\s*Blog\s*<\/span>\s*<\/a>/gi, '');
  html = html.replace(/<p\b[^<>]*class="styles_contents_menu_item[^"]*"[^<>]*>\s*<\/p>/gi, '');
  html = applyFooterMenuOrder(html);
  // Teaser fell through its guard: cut the donor band rather than publish it.
  if (teased === html) html = removeInsightSection(html);
  if (TITLE_MAP[page]) {
    const orig = /<title>([^<]*)<\/title>/.exec(html);
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${TITLE_MAP[page]}</title>`);
    // keep document.title stable through hydration. The old title rides in
    // several places at once: the static <title> (done above), og:title /
    // twitter:title meta content (entity-escaped), and the RSC metadata title
    // nodes (where "&" is \u0026). Patch every form so hydration cannot set
    // document.title back to the pre-rename value.
    if (orig && orig[1] && orig[1] !== TITLE_MAP[page]) {
      const newT = TITLE_MAP[page];
      const oldE = orig[1];                       // entity form from the raw <title>
      const oldP = oldE.replace(/&amp;/g, '&').replace(/&#39;/g, "'");
      const oldU = oldE.replace(/&amp;/g, '\\u0026');
      const pairs = [];
      const push = (a, b) => { if (a && a !== b) pairs.push([a, b]); };
      push(oldP, newT);
      push(oldU, newT);
      if (oldE !== oldP) push(oldE, newT);
      html = safeReplacePairs(html, pairs);
    }
  }
  html = applyMenuOrder(html);
  return html;
}

const DEFAULT_ACCENT = '#e0ff98'; // legacy default (see LEGACY_ACCENT)
const DEFAULT_PRIMARY = '#1e1e1e'; // legacy default (see LEGACY_PRIMARY)

const NAVY = '#1B2A4A';
const GOLD = '#C9A24B';
const CREAM = '#F5F1EC';
// StillCraft client palette: old site hex -> new (case-insensitive).
const THEME_MAP = [
  ['#1e1e1e', NAVY], ['#141415', NAVY],
  ['#9c93e8', NAVY], ['#8072ff', NAVY], ['#bfb8ff', NAVY],
  ['#e0ff98', GOLD],
  ['#f3efeb', '#FFFFFF'], ['#f3efe9', '#FFFFFF'],
  ['#eae3dc', CREAM], ['#efebe8', CREAM],
  ['#d1f3f5', CREAM], ['#ffddc4', CREAM], ['#f7ffdc', CREAM],
];
const LEGACY_ACCENT = '#e0ff98';
const LEGACY_PRIMARY = '#1e1e1e';

function applyTheme(css, brand) {
  let out = css;
  for (const [from, to] of THEME_MAP) {
    out = out.replace(new RegExp(from.replace('#', '\\#'), 'gi'), to);
  }
  // Admin custom colors (anything beyond legacy defaults + client theme) win.
  const accent = (brand.accent_color || '').trim();
  if (accent && ![LEGACY_ACCENT, GOLD].includes(accent.toLowerCase())) {
    out = out.replace(new RegExp(GOLD.replace('#', '\\#'), 'gi'), accent);
  }
  const primary = (brand.primary_color || '').trim();
  if (primary && ![LEGACY_PRIMARY, NAVY].includes(primary.toLowerCase())) {
    out = out.replace(new RegExp(NAVY.replace('#', '\\#'), 'gi'), primary);
  }
  return out;
}

// Same palette for <style> blocks embedded in served HTML (scripts untouched).
export function applyStyleBlocks(html, brand) {
  if (!html.includes('<style')) return html;
  const chunks = html.split(/(<script[\s\S]*?<\/script>)/gi);
  for (let c = 0; c < chunks.length; c += 2) {
    const parts = chunks[c].split(/(<style[\s\S]*?<\/style>)/gi);
    let out = '';
    for (let i = 0; i < parts.length; i++) {
      out += (i % 2 === 1) ? applyTheme(parts[i], brand) : parts[i];
    }
    chunks[c] = out;
  }
  return chunks.join('');
}

const DONOR_GTM_ID = 'GTM-PVJC495';
const INERT_GTM_ID = 'GTM-0000000';

function stripThirdParty(html) {
  // Cookiebot + Cloudflare beacon: 404/domain-not-authorized, safe to drop.
  // uc.js loads via the Next Script loader (__next_s bootstrap) and a flight
  // copy, so static tag-stripping misses it: neutralise the URL itself to an
  // empty script instead. beforeInteractive order is preserved, zero bytes.
  html = html.replace(/<link[^>]*href="https:\/\/consent\.cookiebot\.com[^"]*"[^>]*>\s*/gi, '');
  html = html.replace(/https:\/\/consent\.cookiebot\.com\/uc\.js/gi, 'data:text/javascript,void 0');
  html = html.replace(/<script[^>]*src="https:\/\/consent\.cookiebot\.com[^"]*"[^>]*>\s*<\/script>\s*/gi, '');
  html = html.replace(/<script[^>]*src="https:\/\/static\.cloudflareinsights\.com[^"]*"[^>]*>\s*<\/script>\s*/gi, '');
  // reCAPTCHA: loader tags (gstatic + provider api.js, any host variant),
  // related preloads, and the baked badge DOM (container + anchor iframe +
  // response textarea). All verified static-only (never inside flight
  // pushes), so plain removal cannot desync the stream.
  html = html.replace(/<script\b[^<>]*src="[^"]*(?:gstatic\.com\/recaptcha|google\.com\/recaptcha|recaptcha\.net|recaptcha\/enterprise\.js)[^"]*"[^<>]*>\s*<\/script>\s*/gi, '');
  html = html.replace(/<script\b[^<>]*id="google-recaptcha-v3"[^<>]*>\s*<\/script>\s*/gi, '');
  html = html.replace(/<link\b[^<>]*rel="preload"[^<>]*(?:gstatic\.com\/recaptcha|google\.com\/recaptcha)[^<>]*>\s*/gi, '');
  html = removeRecaptchaContainer(html);
  html = html.replace(/<iframe\b[^<>]*title="reCAPTCHA"[^<>]*>\s*<\/iframe>/gi, '');
  html = html.replace(/<textarea\b[^<>]*id="g-recaptcha-response"[^<>]*>\s*<\/textarea>/gi, '');
  // Google Tag Manager: the container baked into the clone is the donor
  // agency's, so StillCraft pageviews and form conversions were being reported
  // into their analytics. Drop the static loader and its preload, then
  // neutralise the id inside the flight payload as well, or the hydrated
  // <GoogleTagManager> component just re-injects the script. The placeholder is
  // the same length as the real id so flight row byte counts stay intact.
  html = html.replace(/<link\b[^<>]*href="https:\/\/www\.googletagmanager\.com[^"]*"[^<>]*>\s*/gi, '');
  html = html.replace(/<script\b[^<>]*src="https:\/\/www\.googletagmanager\.com[^"]*"[^<>]*>\s*<\/script>\s*/gi, '');
  if (DONOR_GTM_ID.length === INERT_GTM_ID.length) html = html.split(DONOR_GTM_ID).join(INERT_GTM_ID);
  // The placeholder id is still read by the framework's GTM loader at
  // runtime (URL assembled in JS, so no literal to stub): it fires a ~2s
  // 404 to googletagmanager on every visit for a container that reports
  // nowhere. Empty the id instead - the loader skips without one, while
  // the gtag()/dataLayer stub the consent script needs stays intact.
  // Scoped to the placeholder id only - a real container id must never
  // match this.
  html = html.split('"' + INERT_GTM_ID + '"').join('""');
  html = html.split('\\"' + INERT_GTM_ID + '\\"').join('\\"\\"');
  return html;
}

export function removeBadges(html) {
  if (!html || (html.indexOf('footer-cert') < 0 && html.indexOf('cssda') < 0 && html.indexOf('cssdesignawards') < 0)) return html;
  const LOGO = '/assets/root/Stillcraft_logo.png';
  const LOGO_ENC = '%2Fassets%2Froot%2FStillcraft_logo.png';
  // 1) static DOM elements outside <script> – do BEFORE flight replacement so wrappers still contain original URLs
  const parts = html.split(/(<script[\s\S]*?<\/script>)/gi);
  for (let i = 0; i < parts.length; i += 2) {
    let chunk = parts[i];
    // preloads (static head, never in flight) – cert preloads will be replaced by logo preload via flight, but strip old ones
    chunk = chunk.replace(/<link\b[^>]*footer-cert-new[^>]*>\s*/gi, '');
    chunk = chunk.replace(/<link\b[^>]*cssda-wotm[^>]*>\s*/gi, '');
    chunk = chunk.replace(/<link\b[^>]*href="[^"]*cssda-wotm[^"]*"[^>]*>\s*/gi, '');
    // footer cert wrapper (holds 2 imgs) – replace with StillCraft logo
    const logoDiv = '<div class="image-placeholder ImagePlaceholder_imagePlaceholder__UW5XD styles_top_logo__Em5dj css-pf0bo6" style="display:flex;align-items:center"><img alt="StillCraft Events" loading="eager" decoding="async" style="color:transparent;object-fit:contain;width:180px;height:auto" src="' + LOGO + '" class="styles_top_logo_image__epCW5"></div>';
    chunk = chunk.replace(/<div[^>]*class="[^"]*styles_top_logo__Em5dj[^"]*"[^>]*>[\s\S]*?footer-cert-new[\s\S]*?<\/div>\s*/gi, logoDiv);
    // also handle empty wrapper left after previous runs
    chunk = chunk.replace(/<div[^>]*class="[^"]*styles_top_logo__Em5dj[^"]*"[^>]*>\s*<\/div>\s*/gi, logoDiv);
    // fallback: any remaining footer-cert img -> logo
    chunk = chunk.replace(/<img[^>]*footer-cert[^>]*>\s*/gi, '<img alt="StillCraft Events" loading="eager" decoding="async" style="object-fit:contain;width:180px;height:auto" src="' + LOGO + '" class="styles_top_logo_image__epCW5">');
    // CSSDA anchor (wraps the svg) – still contains original href at this point -> remove entirely
    chunk = chunk.replace(/<a[^>]*href="[^"]*cssdesignawards[^"]*"[^>]*>[\s\S]*?<\/a>\s*/gi, '');
    // fallback cssda img
    chunk = chunk.replace(/<img[^>]*cssda[^>]*>\s*/gi, '');
    parts[i] = chunk;
  }
  html = parts.join('');
  // 2) flight-aware replacement (covers src/srcset/href inside flight JSON and any static attrs that slipped through)
  // cert -> logo, cssda -> blank
  const map = [
    ['/assets/cms/wp-content/uploads/2025/07/footer-cert-new.png', LOGO],
    ['https://cms.iventions.com/wp-content/uploads/2025/07/footer-cert-new.png', LOGO],
    ['%2Fassets%2Fcms%2Fwp-content%2Fuploads%2F2025%2F07%2Ffooter-cert-new.png', LOGO_ENC],
    ['https%3A%2F%2Fcms.iventions.com%2Fwp-content%2Fuploads%2F2025%2F07%2Ffooter-cert-new.png', LOGO_ENC],
    ['/assets/root/cssda-wotm-white.svg', ''],
    ['/cssda-wotm-white.svg', ''],
    ['%2Fassets%2Froot%2Fcssda-wotm-white.svg', ''],
    ['%2Fcssda-wotm-white.svg', ''],
    ['https://www.cssdesignawards.com/wotm/iventions/48253/', ''],
    ['https://www.cssdesignawards.com/wotm/iventions/48253', ''],
    ['www.cssdesignawards.com/wotm/iventions/48253', ''],
  ];
  const P = [];
  for (const [from, to] of map) {
    if (!from) continue;
    P.push([from, to]);
    const esc = from.split('/').join('\\/');
    if (esc !== from) P.push([esc, to.split('/').join('\\/')]);
  }
  if (P.length) html = safeReplacePairs(html, P);
  // 3) hide any leftover empty badges (flight blanked href/src → "") – cert now shows logo so don't hide its wrapper
  if (html.indexOf('</head>') >= 0 && html.indexOf('sc-badge-hide') < 0) {
    const hideCss = '<style id="sc-badge-hide">a[href=""]{display:none !important}a[href*=\"cssdesignawards\"]{display:none !important}img[src=""]{display:none !important}img[alt=\"CSSDA WOTM\"]{display:none !important}</style>';
    html = html.replace(/<\/head>/i, hideCss + '\n$&');
  }
  return html;
}
// Excise the baked `<div id="recaptcha-container">…</div>` badge block
// (nested badge div, anchor iframe carrying the sitekey, error div,
// response textarea). Quote-aware div depth counting; static-only region.
function removeRecaptchaContainer(html) {
  const needle = 'id="recaptcha-container"';
  let idx = html.indexOf(needle);
  let guard = 0;
  while (idx >= 0 && guard++ < 4) {
    const openStart = html.lastIndexOf('<div', idx);
    if (openStart < 0) break;
    const openEnd = html.indexOf('>', idx);
    if (openEnd < 0 || openEnd - openStart > 2000) break;
    let depth = 1, i = openEnd + 1;
    let q = null, end = -1;
    while (i < html.length) {
      if (html.startsWith('<!--', i)) {
        const e = html.indexOf('-->', i + 4);
        i = e < 0 ? html.length : e + 3;
        continue;
      }
      const c = html[i];
      if (q) { if (c === q) q = null; i++; continue; }
      if (c === '"' || c === "'") { q = c; i++; continue; }
      if (c === '<') {
        const m = /^<\/?([a-zA-Z][a-zA-Z0-9]*)/.exec(html.slice(i, i + 12));
        if (!m) { i++; continue; }
        if (m[1].toLowerCase() === 'div') {
          if (html[i + 1] === '/') {
            depth--;
            if (depth === 0) { end = i; break; }
          } else {
            depth++;
          }
        }
        i += m[0].length;
        continue;
      }
      i++;
    }
    if (end < 0) break;
    const closeEnd = html.indexOf('>', end);
    if (closeEnd < 0) break;
    html = html.slice(0, openStart) + html.slice(closeEnd + 1);
    idx = html.indexOf(needle);
  }
  return html;
}

function applyBrand(html, brand) {
  const name = (brand.site_name || '').trim();
  if (name && name !== 'Iventions') {
    const upper = name.toUpperCase();
    html = safeReplacePairs(html, [
      [`"Iventions`, `"` + name],
      [`"IVENTIONS`, `"` + upper],
      [` Iventions${EQ}`, ` ${name}${EQ}`],
    ]);
    const parts = html.split(/(<script[\s\S]*?<\/script>)/gi);
    for (let i = 0; i < parts.length; i += 2) {
      parts[i] = parts[i].replace(/>([^<>]*)(Iventions|IVENTIONS)([^<>]*)</g, (m, a, w, b) => {
        const rep = w === w.toUpperCase() ? upper : name;
        return '>' + a + rep + b + '<';
      });
      parts[i] = parts[i].replace(/(<title>[^<]*?)Iventions([^<]*?<\/title>)/g, '$1' + name + '$2');
      parts[i] = parts[i].replace(/(<meta[^>]*content="[^"]*?)Iventions([^"]*?"[^>]*>)/g, '$1' + name + '$2');
    }
    html = parts.join('');
  }
  const tag = (brand.tagline || '').trim();
  if (tag && tag !== DEFAULT_TAGLINE) {
    html = safeReplace(html, DEFAULT_TAGLINE, tag);
  }
  const target = 'assets/root/Stillcraft_logo.png';
  html = safeReplace(html, '/assets/root/upload/icon-logo.svg', '/' + target);
  html = safeReplace(html, '\\/assets\\/root\\/upload\\/icon-logo\\.svg', '\\/' + target.split('/').join('\\/'));
  html = safeReplace(html, 'upload/icon-logo.svg', target);
  html = safeReplace(html, '/assets/cms/wp-content/uploads/2025/06/icon-logo.svg', '/' + target);
  html = safeReplace(html, '\\u002Fassets\\u002Fcms\\u002Fwp-content\\u002Fuploads\\u002F2025\\u002F06\\u002Ficon-logo\\u002Esvg', '\\u002F' + target.split('/').join('\\u002F'));
  html = safeReplace(html, '\\/assets\\/cms\\/wp-content\\/uploads\\/2025\\/06\\/icon-logo\\.svg', '\\/' + target.split('/').join('\\/'));
  html = safeReplace(html, '/assets/root/favicon.ico', '/assets/root/favicon.png');
  const logoStyle = `<style id="sc-logo-style">` +
    `.styles_logo__7LWm4{mix-blend-mode:normal !important;}` +
    `.styles_logo__7LWm4>div{width:fit-content !important;height:100% !important;aspect-ratio:auto !important;}` +
    `.styles_logo__7LWm4 img{position:static !important;height:100% !important;width:auto !important;max-width:min(80vw,44rem) !important;object-fit:contain !important;}` +
    `</style>`;
  html = html.replace(/<\/head>/i, logoStyle + '</head>');
  return html;
}
// minimal multipart single-file parser (field "image")
function parseUpload(buf, contentType) {
  const m = /boundary=(.+)$/.exec(contentType || '');
  if (!m) return null;
  const boundary = '--' + m[1].trim().replace(/^"|"$/g, '');
  const start = buf.indexOf(boundary);
  if (start < 0) return null;
  const headEnd = buf.indexOf('\r\n\r\n', start);
  if (headEnd < 0) return null;
  const head = buf.slice(start, headEnd).toString('latin1');
  const fn = /filename="([^"]+)"/.exec(head);
  const ct = /Content-Type:\s*([^\r\n]+)/i.exec(head);
  const dataStart = headEnd + 4;
  let dataEnd = buf.indexOf(boundary, dataStart);
  if (dataEnd < 0) return null;
  if (buf[dataEnd - 2] === 13 && buf[dataEnd - 1] === 10) dataEnd -= 2;
  return { filename: fn ? fn[1] : 'upload.bin', type: ct ? ct[1].trim() : '', data: buf.slice(dataStart, dataEnd) };
}

// Common web-image formats accepted for image editing.
// Non-image media (video/audio/font/PDF) are handled separately.
const IMAGE_EXTS = /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i;
const IMAGE_EXT_LIST = new Set(['png','jpg','jpeg','webp','gif','svg','avif','bmp','ico']);
const IMAGE_MAX = 8 << 20; // 8MB image limit (images are soft-editable; video/audio stay at 250MB)

// Magic-byte guard: true when buffer looks like a given ftyp brand.
const ftyp = (data, t) => { const h = data.slice(0, 13).toString('latin1'); return h.length > 7 && h.slice(4, 8) === 'ftyp' && h.slice(8, 13).toLowerCase().includes(t); };

// Admin media uploads: images + video + audio + web fonts + vector (svg).
// Magic-byte guard so a renamed .mp4/.png isn't stored under a fake extension.
// IMAGE_EXTS/IMAGE_EXT_LIST constrain the *image* path; video/audio/fonts
// fall through to the legacy checks below.
function sniffMedia(data, filename) {
  const ext = (/\.(png|jpe?g|webp|gif|svg|avif|mp4|m4v|mov|webm|mp3|wav|ogg|m4a|wof2?|woff2|ttf|otf|pdf|bmp|ico)$/i.exec(filename) || [])[1]?.toLowerCase();
  if (!ext) return null;
  // Image formats: strict whitelist + magic bytes.
  if (IMAGE_EXT_LIST.has(ext)) {
    return sniffImage(data, ext);
  }
  const h = data.slice(0, 12).toString('latin1');
  if (ext === 'mp4') return h.slice(4, 8) === 'ftyp' ? 'mp4' : null;
  if (ext === 'm4v') return ftyp(data, 'mp4') || ftyp(data, 'm4v') ? 'm4v' : null;
  if (ext === 'mov') return ftyp(data, 'qt') || ftyp(data, 'mov') ? 'mov' : null;
  if (ext === 'webm') return h.startsWith('\x1a\x45\xdf\xa3') ? 'webm' : null;
  if (ext === 'mp3' && !h.startsWith('ID3') && !(data[0] === 0xff && (data[1] & 0xe0) === 0xe0)) return null;
  if (ext === 'wav' && !(h.startsWith('RIFF') && data.slice(8, 12).toString() === 'WAVE')) return null;
  if (ext === 'ogg' && !h.startsWith('OggS')) return null;
  if (ext === 'm4a' && !(ftyp(data, 'M4A') || ftyp(data, 'mp4'))) return null;
  if (ext === 'ttf' && h.slice(0, 4).toString() !== '\x00\x01\x00\x00') return null;
  if (ext === 'woff' && h.slice(0, 4).toString() !== 'wOFF') return null;
  if (ext === 'woff2' && h.slice(0, 4).toString() !== 'wOF2') return null;
  if (ext === 'otf' && h.slice(0, 4).toString() !== 'OTTO') return null;
  if (ext === 'pdf' && h.slice(0, 5) !== '%PDF-') return null;
  if (ext === 'bmp' && !(h.startsWith('BM'))) return null;
  if (ext === 'ico' && !(h.startsWith('\x00\x00\x01\x00') || h.startsWith('\x00\x00\x02\x00'))) return null;
  return ext;
}

// Strict image-only validation (common web formats + magic bytes).
function sniffImage(data, ext) {
  const h = data.slice(0, 12).toString('latin1');
  if (ext === 'png' && !h.startsWith('\x89PNG')) return null;
  if ((ext === 'jpg' || ext === 'jpeg') && !(data[0] === 0xff && data[1] === 0xd8)) return null;
  if (ext === 'gif' && !h.startsWith('GIF8')) return null;
  if (ext === 'webp' && !(h.startsWith('RIFF') && data.slice(8, 12).toString() === 'WEBP')) return null;
  if (ext === 'avif' && !(ftyp(data, 'avif') || ftyp(data, 'avis'))) return null;
  if (ext === 'svg' && !/<svg|<\?xml/i.test(data.slice(0, 800).toString('utf8'))) return null;
  if (ext === 'bmp' && !(h.startsWith('BM'))) return null;
  if (ext === 'ico' && !(h.startsWith('\x00\x00\x01\x00') || h.startsWith('\x00\x00\x02\x00'))) return null;
  return ext === 'jpeg' ? 'jpg' : ext;
}
// The static half of the home-page pipeline, in the same order serveHtml and
// api/page.js apply it. Used by the admin's "live" endpoint: it used to read the
// raw dist/index.html, which is the donor's page before any StillCraft pass has
// run, so the CMS prefilled donor copy while the site served StillCraft copy -
// the admin showed values the page did not have, and saving them wrote the
// donor's data back. Feeding it the transformed page makes "live" mean live.
//
// The CMS's own pass is deliberately excluded (this is the pre-CMS baseline the
// prefill compares against) and so are the request-scoped ones (links, brand
// styles, the reveal failsafe) which do not change content.
export function applyHomeStatic(html) {
  html = stripThirdParty(html);
  html = removeBadges(html);
  html = applyNav(html, '/');
  html = applyGlobalSwaps(html, '/');
  html = applyStatsFix(html);
  html = applyCitiesFix(html);
  html = applyServiceCitiesFix(html);
  html = applyAboutCrewRemove(html);
  html = applyTestimonialBandFix(html);
  html = applyTestimonialFlightFix(html);
  html = applyTestimonialClientFix(html);
  html = applyDonorStaffImageFix(html);
  html = applyServiceQuoteFix(html);
  html = applyServiceCopyFix(html);
  html = applyLogosFix(html, []);
  html = applyFooterSingleOffice(html);
  html = applyHighlightsFix(html, '/');
  html = applySliderFix(html, '/');
  html = applyValuesFix(html, '/');
  html = applyServiceCardsFix(html, '/');
  html = applyListingStaticFix(html);
  html = applyPortfolioFix(html);
  html = applySplitTextFix(html);
  html = applyCardTitlesFix(html);
  html = applyCaseRouteSlug(html, '/');
  html = applyCaseMetaFix(html, '/');
  html = applyFooterAddresses(html);
  html = applyContentFlight(html, '/');
  return html;
}
export {
  IMAGE_EXTS, IMAGE_EXT_LIST, IMAGE_MAX, getBrand, bustBrand, applyBrand, applyNav, applyMenuOrder, applyTheme,
  stripThirdParty, flightReplace, applyFlightIA, applyContentFlight, applyLinks,
  applyGlobalSwaps, applyFooterAddresses, applyHeroVideo, mobileFor, posterFor, parseUpload, sniffImage, sniffMedia, FILE_FLIGHT,
  applyTestimonialBandFix,
  TITLE_MAP, NAV_LABELS, NAV_DROP_HREFS, MENU_ORDER, DEFAULT_TAGLINE,
};

// ---------- image dimensions (kills layout shift for imgs missing width/height) ----------
const DIM_ROOT = path.resolve('dist');
const dimCache = new Map(); // src -> "WxH" | ""

function parseDims(buf, ext) {
  try {
    if (ext === 'png') {
      if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return '';
      return buf.readUInt32BE(16) + 'x' + buf.readUInt32BE(20);
    }
    if (ext === 'jpg' || ext === 'jpeg') {
      if (buf[0] !== 0xff || buf[1] !== 0xd8) return '';
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) break;
        const m = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        if (m >= 0xc0 && m <= 0xc3) return buf.readUInt16BE(i + 7) + 'x' + buf.readUInt16BE(i + 5);
        i += 2 + len;
      }
      return '';
    }
    if (ext === 'gif') {
      if (buf.length < 10) return '';
      return buf.readUInt16LE(6) + 'x' + buf.readUInt16LE(8);
    }
    if (ext === 'webp') {
      if (buf.slice(0, 4).toString() !== 'RIFF' || buf.slice(8, 12).toString() !== 'WEBP') return '';
      const tag = buf.slice(12, 16).toString();
      if (tag === 'VP8 ' && buf.length > 30) {
        const w = buf.readUInt16LE(26) & 0x3fff, h = buf.readUInt16LE(28) & 0x3fff;
        return w && h ? w + 'x' + h : '';
      }
      if (tag === 'VP8L' && buf.length > 25) {
        if (buf[20] !== 0x2f) return '';
        const b = buf.readUInt32LE(21);
        return ((b & 0x3fff) + 1) + 'x' + (((b >> 14) & 0x3fff) + 1);
      }
      if (tag === 'VP8X' && buf.length > 30) {
        const w = buf.readUIntBE(24, 3) + 1, h = buf.readUIntBE(27, 3) + 1;
        return w && h ? w + 'x' + h : '';
      }
      return '';
    }
  } catch { return ''; }
  return '';
}

async function dimsFor(src) {
  if (dimCache.has(src)) return dimCache.get(src);
  let out = '';
  try {
    let p = (src || '').split('?')[0];
    try { p = decodeURIComponent(p); } catch {}
    if (p === '/_next/image' && src.includes('url=')) {
      // optimizer URL: unwrap to the underlying file (/... or https://cms.....)
      let inner = (/[?&]url=([^&]+)/.exec(src) || [])[1] || '';
      try { inner = decodeURIComponent(inner); } catch {}
      if (inner.startsWith('https://cms.iventions.com/')) p = '/assets/cms/' + inner.replace('https://cms.iventions.com/', '');
      else if (inner) p = inner.startsWith('/') ? inner : '/' + inner;
    }
    if (p && p.startsWith('/') && !p.includes('://')) {
      const m = /\.(png|jpe?g|gif|webp|svg)$/i.exec(p);
      if (m) {
        const ext = m[1].toLowerCase();
        const file = path.normalize(path.join(DIM_ROOT, p));
        if (file.startsWith(DIM_ROOT)) {
          if (ext === 'svg') {
            const t = await readFile(file, 'utf8').catch(() => '');
            const w = /width="([\d.]+)"/.exec(t), h = /height="([\d.]+)"/.exec(t);
            if (w && h) out = `${Math.round(+w[1])}x${Math.round(+h[1])}`;
            else {
              const vb = /viewBox="[\d.\s-]+ ([\d.]+) ([\d.]+)"/.exec(t.replace(/viewBox="([\d.\s-]+)"/, (_, v) => `viewBox="${v}"`));
              if (vb) out = `${Math.round(+vb[1])}x${Math.round(+vb[2])}`;
            }
          } else {
            const fh = await readFile(file).catch(() => null);
            if (fh) out = parseDims(fh.slice(0, 65536), ext === 'jpeg' ? 'jpg' : ext);
          }
        }
      }
    }
  } catch {}
  dimCache.set(src, out);
  return out;
}

// Split one srcset/imagesrcset candidate into [url, descriptor]: everything
// but the trailing density/width token belongs to the URL (filenames may
// contain spaces). Never touches the descriptor-separating space itself.
function splitSrcsetCandidate(t) {
  const toks = String(t).trim().split(/\s+/);
  if (!toks.length || toks[0].indexOf('/') < 0 || /^(data:|blob:|#)/i.test(toks[0])) return null;
  const desc = toks[toks.length - 1];
  if (toks.length > 1 && /^(\d+w|\d+(\.\d+)?x)$/i.test(desc)) {
    return [toks.slice(0, -1).join(' '), desc];
  }
  return [t, ''];
}
// Percent-encode raw spaces inside local asset URLs (some CMS filenames
// contain spaces). Raw spaces split srcset candidates ("unknown descriptor",
// "Dropped srcset candidate") and trip preload href validation; %20 serves
// the same file (resolveFile decodes) with none of that. Length-synced via
// safeReplace so flight rows stay valid. Descriptor separators are never
// encoded (only spaces *inside* the URL head are).
export function encodeAssetSpaces(html) {
  if (!html || html.indexOf('/assets/') < 0) return html;
  let out = html;
  // 1) imagesrcset preloads without href trip "invalid href value": point
  // href at the first candidate URL (standard fallback pattern).
  out = out.replace(/<link\b[^<>]*rel="preload"[^<>]*>/gi, (tag) => {
    if (/href\s*=/i.test(tag)) return tag;
    const m = /imagesrcset\s*=\s*"([^"]+)"/i.exec(tag);
    if (!m) return tag;
    const first = String(m[1]).split(',')[0] || '';
    const head = splitSrcsetCandidate(first);
    if (!head || head[0].indexOf('/assets/') < 0) return tag;
    const href = head[0].split(' ').join('%20');
    if (/\/>$/.test(tag)) return tag.slice(0, -2) + ' href="' + href + '">';
    return tag.slice(0, -1) + ' href="' + href + '">';
  });
  // 2) collect raw-space URL heads from url-ish attributes.
  const found = new Set();
  const attrRe = /\b(?:src|href|content|poster|imagesrcset|srcset)\s*=\s*"([^"]* [^"]*)"/gi;
  let m;
  while ((m = attrRe.exec(out))) {
    const raw = m[1];
    if (/^(data:|blob:|#)/i.test(raw)) continue;
    if (/imagesrcset|srcset/i.test(m[0].slice(0, m[0].indexOf('=')))) {
      for (const part of raw.split(',')) {
        const head = splitSrcsetCandidate(part);
        if (head && head[0].indexOf(' ') >= 0) found.add(head[0]);
      }
    } else if (raw.indexOf('/assets/') >= 0 || raw.indexOf('/_next/') >= 0) {
      found.add(raw);
    }
  }
  // flight sourceUrl values with raw slashes + spaces (markup covered above).
  const fRe = /sourceUrl\\":\\"([^"]* [^"]*)"/g;
  while ((m = fRe.exec(out))) {
    if (m[1].indexOf('/assets/') >= 0 && m[1].indexOf('%20') < 0) found.add(m[1]);
  }
  for (const raw of found) {
    out = safeReplace(out, raw, raw.split(' ').join('%20'));
  }
  return out;
}

// Stale listing cards: slugs that render in an index but have no backing
// page (their dist pages were removed). Dropping the card beats a 404 on
// every click. Static card + flight edge node go together — removing only
// the static markup would let hydration re-create the card from flight data.
  const STALE_PROJECT_SLUGS = ['mothers-day-brunch-at-southfield-mall', 'adidas-display-wall', 'uefa-champions-league-final-2026', 'uefa-champions-league-final-2023', 'final-four-2025', 'ypo-global-event'];
function removeFlightSlugNode(html, slug) {
  const keys = ['"slug":"' + slug + '"', '\\"slug\\":\\"' + slug + '\\"'];
  if (!keys.some((k) => html.includes(k))) return html;
  let before;
  try { before = verifyFlight(html); } catch { return html; }
  let out = html;
  for (const a of findEdgesArrays(out)) {
    const inner = out.slice(a.start + 1, a.end - 1);
    const nodes = splitTopObjects(inner);
    if (nodes.length < 2) continue;
    const kept = [];
    let dropped = false;
    for (const nd of nodes) {
      const ns = inner.slice(nd.start, nd.end);
      if (keys.some((k) => ns.includes(k))) { dropped = true; continue; }
      kept.push(ns);
    }
    if (dropped) out = out.slice(0, a.start + 1) + kept.join(',') + out.slice(a.end - 1);
  }
  if (out === html) return html;
  try {
    const after = verifyFlight(out);
    if (after.bad !== 0 || (before.rows > 0 && after.rows !== before.rows)) return html;
  } catch { return html; }
  return out;
}
// The donor's listing has more card slots than there are cases, so the
// flight edges array repeats several slugs. Keep the first occurrence of each
// slug and drop the rest. Rewriting the array is only safe if the flight
// stream still verifies afterwards, so the whole thing is abandoned on any
// inconsistency rather than shipping a payload React cannot parse.
function dedupeFlightProjects(html) {
  if (!html) return html;
  const keys = ['"slug":"', '\\"slug\\":\\"'];
  if (!keys.some((k) => html.includes(k))) return html;
  let before;
  try { before = verifyFlight(html); } catch { return html; }
  let out = html;
  for (const a of findEdgesArrays(out)) {
    const inner = out.slice(a.start + 1, a.end - 1);
    const nodes = splitTopObjects(inner);
    if (nodes.length < 2) continue;
    const kept = [];
    const seen = new Set();
    let dropped = false;
    for (const nd of nodes) {
      const ns = inner.slice(nd.start, nd.end);
      const m = ns.match(/"slug":"([^"]{1,80})"/);
      const slug = m ? m[1] : null;
      if (slug) {
        if (seen.has(slug)) { dropped = true; continue; }
        seen.add(slug);
      }
      kept.push(ns);
    }
    if (dropped) out = out.slice(0, a.start + 1) + kept.join(',') + out.slice(a.end - 1);
  }
  if (out === html) return html;
  try {
    const after = verifyFlight(out);
    if (after.bad !== 0) return html;
  } catch { return html; }
  return out;
}
// Static listing cards are plain <a href="/project/<slug>">…</a> elements.
// Walk them in document order and drop any whose slug was already seen, so the
// rendered grid matches the deduplicated payload instead of leading hydration
// to re-insert the repeats.
function dedupeStaticProjectCards(html) {
  if (!html || html.indexOf('/project/') < 0) return html;
  // Cards live in a per-card wrapper div; cutting only the <a> would leave the
  // wrapper behind as an empty grid cell. Walk wrappers, not anchors, so each
  // card is removed or kept whole.
  const WRAP = 'ProjectListSection_project__76n_c';
  const cards = [];
  let w = 0;
  while (true) {
    const i = html.indexOf(WRAP, w);
    if (i < 0) break;
    const start = html.lastIndexOf('<div', i);
    const end = cutBalancedDiv(html, start);
    if (start < 0 || end <= start) { w = i + WRAP.length; continue; }
    const seg = html.slice(start, end);
    const m = seg.match(/href="\/project\/([a-z0-9][a-z0-9-]*)"/);
    if (m) cards.push({ start, end, slug: m[1] });
    w = end;
  }
  if (cards.length < 2) return html;
  const seen = new Set();
  const keep = [];
  for (const c of cards) {
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    keep.push(c);
  }
  if (keep.length === cards.length) return html;
  // Walk every card in document order, copying the ones we keep and skipping
  // over the repeats. The cursor always advances to each card's end, kept or
  // not — advancing only on kept cards would re-include any repeat sitting
  // between two survivors.
  const keepSet = new Set(keep);
  let out = '';
  let at = 0;
  for (const c of cards) {
    if (keepSet.has(c)) out += html.slice(at, c.end);
    at = c.end;
  }
  out += html.slice(at);
  return out;
}
// One entry point for the listing: drop the dead pagination, dedupe the static
// grid and the flight payload together so the two cannot disagree after
// hydration, then add the programme-wide overview above the grid.
export function applyProjectCardDedup(html) {
  if (!html) return html;
  return dedupeFlightProjects(removeStaleListingPagination(dedupeStaticProjectCards(html)));
}

// The listing ships a pagination control sized for the donor's larger
// catalogue. With 11 cases on one page it navigates nowhere, so it is cut.
// Guarded on the exact class and a small size, so a future redesign that
// reintroduces real pagination is left alone.
function removeStaleListingPagination(html) {
  const CLS = 'css-ykm4op';
  const at = html.indexOf('<div class="' + CLS + '">');
  if (at < 0) return html;
  const end = cutBalancedDiv(html, at);
  if (end <= at || end - at > 20000) return html;
  return html.slice(0, at) + html.slice(end);
}

// Programme-wide footfall and dwell averages, shown once above the case grid.
// These numbers describe StillCraft's seasonal mall programming as a whole, so
// they belong here and not on an individual case page (see applyCaseFactsFix).
// Injected once, guarded by a marker attribute.
export function applyProjectsOverviewFix(html, page) {
  if (page !== '/projects' && page !== '/projects/') return html;
  if (html.indexOf('data-sc-overview') >= 0) return html;
  const s = OVERVIEW_STATS[0];
  const d = OVERVIEW_STATS[1];
  if (!s || !d) return html;
  const block =
    '<div class="sc-overview" data-sc-overview="1" ' +
    'style="margin:0 0 3rem;display:flex;flex-wrap:wrap;gap:2rem;align-items:flex-end;">' +
    '<div><div style="font-size:3.5rem;line-height:1;">' + s.value + '</div>' +
    '<div>' + s.label + '</div></div>' +
    '<div><div style="font-size:3.5rem;line-height:1;">' + d.value + '</div>' +
    '<div>' + d.label + '</div></div>' +
    '<div style="flex-basis:100%;">' + OVERVIEW_STATS[2].note + '</div>' +
    '</div>';
  // Mount immediately before the first case card so the stat reads as the
  // summary of the grid that follows it.
  const anchor = html.indexOf('<a href="/project/');
  if (anchor < 0) return html;
  return html.slice(0, anchor) + block + html.slice(anchor);
}

// "33% / 21%" is a programme-wide average across all StillCraft seasonal mall
// programming, so it is wrong to present it as any single campaign's result on
// a case page. It belongs on the /projects overview (applyProjectsOverviewFix).
// The value is baked into dist/ by scripts/gen-cases.mjs and the flight
// payload, so this replaces both, and is a no-op on any other page.
export function applyCaseFactsFix(html, page) {
  if (!page || !html) return html;
  if (page.indexOf('/project/') !== 0) return html;
  if (html.indexOf('33%') < 0) return html;
  // The donor's stat block is presented as this campaign's own result. Drop the
  // borrowed numbers and say plainly that they are programme-wide, so no
  // individual case inherits a figure that was never measured for it.
  const NOTE = 'Measured';
  const SUB = ' across StillCraft programmes, not this campaign';
  // Longest pattern first: the caption pair starts with the same text as the
  // bare figure, so applying the short one first would leave the caption tail
  // stranded and produce "Measuredprogramme-wide ...".
  const pairs = [
    ['33% / 21%programme-wide footfall and dwell averages', NOTE + SUB],
    ['33% / 21%', NOTE],
  ];
  let out = html;
  for (const [from, to] of pairs) {
    // safeReplace verifies the flight payload still parses and refuses the edit
    // if it does not, leaving the page untouched rather than half-rewritten.
    out = safeReplace(out, from, to, true) || out;
    const enc = flightEnc(from);
    if (enc !== from) out = safeReplace(out, enc, flightEnc(to), true) || out;
  }
  return out;
}

export function removeStaleProjectCards(html) {
  if (!html) return html;
  if (!STALE_PROJECT_SLUGS.some((s) => html.indexOf(s) >= 0)) return html;
  let out = html;
  for (const slug of STALE_PROJECT_SLUGS) {
    // static cards: <a .../project/<slug>...>...</a> (anchors never nest)
    const needle = '/project/' + slug;
    let idx = out.indexOf(needle);
    let guard = 0;
    while (idx >= 0 && guard++ < 8) {
      const openStart = out.lastIndexOf('<a', idx);
      if (openStart < 0) break;
      const openEnd = out.indexOf('>', idx);
      if (openEnd < 0 || openEnd - openStart > 4000) break;
      const close = out.indexOf('</a>', openEnd);
      if (close < 0) break;
      out = out.slice(0, openStart) + out.slice(close + 4);
      idx = out.indexOf(needle);
    }
    out = removeFlightSlugNode(out, slug);
  }
  return out;
}

export async function applyImgDims(html) {
  const tags = [...html.matchAll(/<img\b[^<>]*>/gi)];
  if (!tags.length) return html;
  let out = '';
  let last = 0;
  for (const m of tags) {
    const tag = m[0];
    if (/\swidth\s*=/i.test(tag)) continue;
    const src = (/src="([^"]+)"/.exec(tag) || [])[1] || '';
    if (!src || src.startsWith('data:')) continue;
    const dims = await dimsFor(src);
    if (!dims) continue;
    const [w, h] = dims.split('x');
    out += html.slice(last, m.index) + tag.replace(/<img/i, `<img width="${w}" height="${h}"`);
    last = m.index + tag.length;
  }
  return last ? out + html.slice(last) : html;
}

// ---------- splash overlay (never show an unsettled first paint) ----------
// Footer bottom strings render client-side from CMS data outside the flight
// patches above; align them in the DOM after hydration (static HTML already
// carries the new copy for SEO/no-JS). Exact-match only, crash-proof.
export function applyFooterFix(html, page) {
  if (page === '/insider') return html;
  if (!/<\/body>/i.test(html)) return html;
  // The donor name is assembled from two parts so the served document never
  // spells it out; both replacements are byte-identical to the old literals.
  const js = `<script>(function(){var fix=function(){try{var UP=new RegExp('IVEN'+'TIONS','g'),MI=new RegExp('Iven'+'tions','g');var els=document.querySelectorAll('[class*="bottom_copyright"]');for(var i=0;i<els.length;i++){var w=document.createTreeWalker(els[i],NodeFilter.SHOW_TEXT);var n;while((n=w.nextNode())){var v=n.nodeValue;if(!v)continue;var nv=v.replace(UP,'STILLCRAFT EVENTS CO.').replace(MI,'StillCraft Events Co.');if(nv!==v)n.nodeValue=nv;}}var f=document.querySelector('footer');if(f){var ps=f.querySelectorAll('[fill="#1E1E1E"]');for(var j=0;j<ps.length;j++){ps[j].setAttribute('fill','#F5F1EC');}}}catch(e){}};window.addEventListener('load',function(){setTimeout(fix,800);});setTimeout(fix,4000);if(document.readyState!=='loading'){setTimeout(fix,1500);}})();</script>`;
  return html.replace(/<\/body>/i, js + '\n$&');
}
// ---------- donor brand sweep ----------
// The clone is rebranded, but a few strings that reach the visitor still carry
// the donor's company name (today: three testimonial quotes that ship in the
// flight payload and in the carousel's quote markup). Rewrite the name where it
// reads as a company - visible text and flight strings - and nothing else:
//
//   * header, footer and nav are excluded, so the top menu, the footer menu and
//     the copyright line are byte-for-byte untouched;
//   * attribute values and URLs keep their spelling (slugs, filenames, hosts);
//   * the site's own injected guard scripts are skipped, since they carry a
//     search pattern rather than copy.
// Only the company name is touched: no sentence, heading or service label is
// rewritten, so copy that already matches the brand is left exactly as it is.
// In running copy the plain trading name reads better than the legal form, so a
// corporate suffix on the donor name ("Iventions Co.") is dropped rather than
// carried over: "like Iventions Co. to build a booth" becomes "like StillCraft
// Events to build a booth". The footer copyright keeps its legal wording - it is
// excluded from this pass and already says "StillCraft Events Co.".
const DONOR_SWEEP = (s) => s
  .replace(/\bIVENTIONS(\s+(?:CO\.|LTD\.?|LIMITED|GROUP))?/g, 'STILLCRAFT EVENTS')
  .replace(/\bIventions(\s+(?:Co\.|Ltd\.?|Limited|Group))?/g, 'StillCraft Events');
const SWEEP_GUARD = /<(header|footer|nav)\b[\s\S]*?<\/\1>/gi;
function sweepVisibleHtml(s) {
  if (!/iventions/i.test(s)) return s;
  const out = [];
  let last = 0, m;
  SWEEP_GUARD.lastIndex = 0;
  while ((m = SWEEP_GUARD.exec(s))) {
    out.push(DONOR_SWEEP(s.slice(last, m.index)), m[0]);
    last = SWEEP_GUARD.lastIndex;
  }
  out.push(DONOR_SWEEP(s.slice(last)));
  return out.join('');
}
export function applyDonorBrand(html) {
  if (!/iventions/i.test(html)) return html;
  const out = [];
  let last = 0, m;
  const re = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
  while ((m = re.exec(html))) {
    out.push(sweepVisibleHtml(html.slice(last, m.index)));
    // The Next flight payload is copy: it holds the strings React renders.
    out.push(/self\.__next_f\.push/.test(m[0]) ? DONOR_SWEEP(m[0]) : m[0]);
    last = re.lastIndex;
  }
  out.push(sweepVisibleHtml(html.slice(last)));
  return out.join('');
}
// StillCraft team roster: text-only monogram cards (Option A). No photos required;
// bios are the exact client-provided copy below. Editable via /insider → Team.
const TEAM = [
  { name: 'Gathu Mwangi', role: 'Chief Executive Officer', img: '',
    // (no portrait file ships for Gathu - monogram fallback; do NOT point at
    // donor portraits in dist/assets/cms - local CMS team only)
    bio: 'Gathu Mwangi built StillCraft Events Co. from a single, unconventional idea: that stillness itself could command attention. With a degree in Public Relations and a career built across several companies as a PR Officer and Sales Manager, Gathu understood early on that the businesses winning attention weren\'t necessarily the loudest, they were the ones who knew how to make people stop and look. That instinct led him to found African Living Statues and Events, introducing and pioneering human living statue performances in Kenya, a first for the country\'s events industry, and a format that turned static presence into genuine spectacle at activations across Nairobi. As the business grew, Gathu saw a bigger gap forming: shopping malls needed programming that actually moved people, and brands needed activations that did more than perform well in a recap deck. He rebranded and expanded the company into StillCraft Events Co., built to serve both audiences properly rather than picking one lane. Today, Gathu leads a team that plans strategy and delivers execution under one roof, a philosophy shaped directly by his own path from PR and sales into founding and building an agency from the ground up. He remains hands-on with the same instinct that started it all: that the right idea, placed in the right room, in front of the right audience, is what actually moves a business forward.' },
  { name: 'John Mesh', role: 'Operations Manager (5 Years of experience)', img: '/assets/custom/team-john-mesh.svg',
    bio: 'Our Operations Manager is the reason a plan on paper survives contact with a real venue. Every vendor booking, every staffing schedule, every piece of equipment that needs to be in the right place at the right time runs through this role. When an activation looks effortless on the day, it is because the operations work behind it was anything but, hundreds of small details resolved before anyone outside the team ever notices there was a decision to make.' },
  { name: 'Diana', role: 'Marketing Manager (3 Years of experience)', img: '/assets/custom/team-diana.svg',
    bio: "Diana keeps StillCraft's own story as sharp as the stories we build for clients. This role shapes how the agency shows up, on the website, in pitches, across every touchpoint a prospective client sees before they ever speak to us, and makes sure the positioning we promise clients is the same one we practice ourselves." },
  { name: 'Miriam', role: 'Human Resource (7 Years of experience)', img: '/assets/custom/team-miriam.svg',
    bio: 'Delivering eight years of consistent, high pressure work on the ground depends entirely on the people doing it, and building and keeping that team is the job of our Human Resource. This role manages everything from hiring the right people for a fast moving, client facing industry to making sure the team running a launch day at six in the morning is supported well enough to do it again next week.' },
  { name: 'Robin Halmi', role: 'Chief Digital Media (2 Years of experience)', img: '/assets/custom/team-robin-halmi.svg',
    bio: 'Halmi owns how StillCraft and its clients show up everywhere a screen is involved, social content, digital campaigns, and the growing hybrid and virtual layer of corporate and brand events. As more of a brand\'s audience is met online before they are ever met in person, Halmi makes sure the digital experience carries the same energy and consistency as the physical one.' },
  { name: 'John', role: 'Finance Officer (4 Years of experience)', img: '/assets/custom/team-john-njogu.svg',
    bio: 'John keeps every engagement accountable in the way StillCraft promises clients it will be, transparent budgets, accurate reporting, and the financial discipline that lets an eight year old consultancy still operate like one that plans for its next eight. This role is also what makes a long term partnership like the one with Galleria Mall sustainable on both sides, not just deliverable once.' },
];
// Encode a value the way the CMS flight payload does (single-backslash plane).
function flightEnc(s) {
  return s.split('\\').join('\\\\').split('"').join('\\"')
    .split('<').join('\\u003c').split('>').join('\\u003e').split('&').join('\\u0026')
    .split('\r').join('\\r').split('\n').join('\\n');
}
function teamMember(p) {
  const rawImg = String(p.img || '');
  const src = rawImg.charAt(0) === '/' ? rawImg : '/assets/custom/' + rawImg;
  const raw = JSON.stringify({
    title: p.name,
    content: '<p>' + p.bio + '</p>\\n',
    featuredImage: { node: { sourceUrl: src } },
    memberTemplate: { role: p.role, funImage: { node: { sourceUrl: src } } },
  });
  return raw
    .split('<').join('\\u003c').split('>').join('\\u003e').split('&').join('\\u0026')
    .split('"').join('\\"');
}
function replaceMembersArray(html, cms) {
  const key = '\\"members\\":[';
  let idx = html.indexOf(key);
  let guard = 0;
  while (idx >= 0 && guard++ < 8) {
    let depth = 1, k = idx + key.length;
    while (k < html.length && depth > 0) {
      const c = html[k];
      if (c === '\\') { k += 2; continue; }
      if (c === '[') depth++;
      else if (c === ']') { depth--; if (depth === 0) break; }
      k++;
    }
    if (depth !== 0) break;
    const innerText = html.slice(idx + key.length, k);
    // Detect the OLD Iventions-era roster (still present in flight data) by its
    // distinctive members. The new roster is injected by the grid below; this
    // swap keeps the flight payload consistent with the visible grid.
    const isOld = innerText.includes('John Njogu') || innerText.includes('Alise Grota');
    if (!isOld) { idx = html.indexOf(key, k); continue; }
    if (process.env.SC_KEEPARR) {
      return replaceTeamGrid(html, cms);
    }
    // Direct replacement: the members array lives inside a single self.__next_f
    // push chunk, so chunk-boundary alignment is unaffected by its internal
    // length. Pad to the old length anyway to stay safe for any byte-framed
    // consumer (invisible trailing spaces inside the last bio).
    let fresh = TEAM.map(teamMember).join(',');
    const oldLen = Buffer.byteLength(innerText, 'utf8');
    const newLen = Buffer.byteLength(fresh, 'utf8');
    if (process.env.SC_TEAMDBG) console.log('[team] oldLen=' + oldLen + ' newLen=' + newLen);
    if (newLen < oldLen) {
      const at = fresh.lastIndexOf('\\u003c/p\\u003e');
      if (at >= 0) fresh = fresh.slice(0, at) + ' '.repeat(oldLen - newLen) + fresh.slice(at);
    }
    html = html.slice(0, idx + key.length) + fresh + html.slice(k);
    idx = html.indexOf(key, idx + key.length + fresh.length);
  }
  return html;
}
export function applyTeamRoster(html, cms) {
  if (process.env.SC_NOTEAM) return html;
  if (!html.includes('John Njogu') && !html.includes('Alise Grota')) return html;
  html = replaceMembersArray(html, cms);
  if (!process.env.SC_NOGRID) html = replaceTeamGrid(html, cms);
  return html;
}

// ---------- shared "voices" section (testimonials band + team roster) ----------
// One card language for both: cream cards on navy, gold accents, Georgia
// headings, initials in the heading bold font. Testimonial cards carry a
// photo/logo + quote + name/role/org + industry·location meta; team cards
// carry initials instead of an image + name + title + description.
const VOICES_CSS_RULES = '.sc-voices{background:#1B2A4A;padding:clamp(70px,9vw,110px) max(24px,5vw);color:#F5F1EC}'
  + '.sc-voices-head{max-width:1240px;margin:0 auto 52px}'
  + '.sc-voices-kicker{color:#C9A24B;font:600 13px Arial,sans-serif;letter-spacing:.32em;text-transform:uppercase;display:block;margin-bottom:14px}'
  + '.sc-voices-title{color:#F5F1EC;font:500 clamp(34px,4.2vw,54px)/1.1 Georgia,serif;margin:0}'
  + '.sc-voices-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2.2rem;max-width:1240px;margin:0 auto}'
  + '.sc-vo{background:#F5F1EC;border-radius:18px;padding:2.2rem 2.4rem;border-top:6px solid #C9A24B;box-shadow:0 10px 30px rgba(0,0,0,.25);display:flex;flex-direction:column;gap:.9rem;min-width:0}'
  + '.sc-vo-media{width:62px;height:62px;border-radius:50%;overflow:hidden;flex-shrink:0;background:#e3dccf;border:2px solid #C9A24B}'
  + '.sc-vo-media img{width:100%;height:100%;object-fit:cover;display:block}'
  + '.sc-vo-mono{width:62px;height:62px;border-radius:50%;background:#1B2A4A;color:#F5F1EC;display:flex;align-items:center;justify-content:center;font:700 22px Georgia,serif;letter-spacing:.05em;border:2px solid #C9A24B;flex-shrink:0}'
  + '.sc-vo-quote{font:400 19px/1.75 Georgia,serif;color:#1B2A4A;margin:0}'
  + '.sc-vo-quote::before{content:"\\201C"}'
  + '.sc-vo-quote::after{content:"\\201D"}'
  + '.sc-vo-who{margin-top:auto}'
  + '.sc-vo-name{font:700 24px Georgia,serif;color:#1B2A4A;margin:0}'
  + '.sc-vo-role{color:#A67B1F;font-size:13px;letter-spacing:.11em;text-transform:uppercase;margin:6px 0 0;font-weight:700}'
  + '.sc-vo-meta{color:#4a5568;font-size:13px;margin:8px 0 0}'
  + '.sc-vo-title{color:#A67B1F;font-size:13px;letter-spacing:.11em;text-transform:uppercase;margin:0;font-weight:700}'
  + '.sc-vo-bio{font-size:15px;line-height:1.7;color:#1a1a1a;margin:0}'
  + '@media(max-width:960px){.sc-voices-grid{grid-template-columns:repeat(2,1fr)}}'
  + '@media(max-width:560px){.sc-voices-grid{grid-template-columns:1fr}}';
const VOICES_CSS = '<style>' + VOICES_CSS_RULES + '</style>';
// Team expand-card language (motion-ui ExpandCards translated to static
// HTML+CSS+JS: minimalist glassmorphic trigger cards in a grid, click opens
// a frosted-glass detail dialog with close button, backdrop-click and Escape
// to dismiss. Desktop/tablet: centered scale-in; phones: bottom sheet
// slide-up. Scoped to .sc-x* so it cannot collide with emotion classes.
const TEAM_X_CSS = '.sc-xteam{position:relative;overflow:hidden}'
  + '.sc-xteam::before,.sc-xteam::after{content:"";position:absolute;border-radius:50%;pointer-events:none}'
  + '.sc-xteam::before{width:44rem;height:44rem;top:-14rem;right:-12rem;background:radial-gradient(circle,rgba(201,162,75,.16),transparent 65%)}'
  + '.sc-xteam::after{width:38rem;height:38rem;bottom:-12rem;left:-10rem;background:radial-gradient(circle,rgba(120,150,220,.12),transparent 65%)}'
  + '.sc-xteam .sc-xgrid{position:relative;z-index:1;list-style:none;margin:0 auto;padding:0;display:grid;gap:1.4rem;max-width:1240px;grid-template-columns:repeat(3,1fr)}'
  + '.sc-xcard{display:flex;flex-direction:column;gap:.9rem;width:100%;text-align:left;background:rgba(245,241,236,.07);-webkit-backdrop-filter:blur(18px) saturate(1.25);backdrop-filter:blur(18px) saturate(1.25);border:1px solid rgba(245,241,236,.16);border-radius:20px;padding:2rem;cursor:pointer;box-shadow:0 8px 32px rgba(0,0,0,.18);transition:border-color .25s ease,transform .25s ease,box-shadow .25s ease,background .25s ease}'
  + '.sc-xcard:hover{border-color:rgba(201,162,75,.55);background:rgba(245,241,236,.1);transform:translateY(-4px);box-shadow:0 16px 44px rgba(0,0,0,.28)}'
  + '.sc-xcard:focus-visible{outline:none;border-color:#C9A24B;box-shadow:0 0 0 3px rgba(201,162,75,.45)}'
  + '.sc-xavatar{width:60px;height:60px;border-radius:50%;overflow:hidden;flex-shrink:0;background:rgba(245,241,236,.1);border:1px solid rgba(245,241,236,.28);display:flex;align-items:center;justify-content:center}'
  + '.sc-xavatar img{width:100%;height:100%;object-fit:cover;display:block}'
  + '.sc-xmono{background:rgba(245,241,236,.08);color:#F5F1EC;font:700 20px Georgia,serif;letter-spacing:.05em}'
  + '.sc-xname{font:600 20px/1.3 Georgia,serif;color:#F5F1EC;display:block;letter-spacing:.01em}'
  + '.sc-xrole{color:#D8B45E;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;display:block;margin-top:3px}'
  + '.sc-xsum{font-size:14px;line-height:1.65;color:rgba(245,241,236,.72);display:block;margin-top:auto}'
  + '.sc-xmore{font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:rgba(245,241,236,.85);display:block;margin-top:.5rem}'
  + '.sc-xcard:hover .sc-xmore{color:#D8B45E}'
  + '.sc-xpanel[hidden]{display:none}'
  + '.sc-xpanel{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:2.4rem}'
  + '.sc-xscrim{position:absolute;inset:0;background:rgba(10,16,32,.6);opacity:0;transition:opacity .3s ease}'
  + '.sc-xdialog{position:relative;z-index:1;width:100%;max-width:600px;max-height:86dvh;max-height:86svh;overflow-y:auto;background:rgba(27,42,74,.55);-webkit-backdrop-filter:blur(24px) saturate(1.3);backdrop-filter:blur(24px) saturate(1.3);border:1px solid rgba(245,241,236,.18);border-radius:22px;padding:2.8rem;box-shadow:0 30px 90px rgba(0,0,0,.5);opacity:0;transform:translateY(16px) scale(.97);transition:opacity .3s ease,transform .38s cubic-bezier(.22,.9,.28,1)}'
  + '.sc-xpanel.open .sc-xscrim{opacity:1}'
  + '.sc-xpanel.open .sc-xdialog{opacity:1;transform:none}'
  + '.sc-xdavatar{width:84px;height:84px;border-radius:50%;overflow:hidden;background:rgba(245,241,236,.1);border:1px solid rgba(245,241,236,.3);display:flex;align-items:center;justify-content:center;margin-bottom:1.6rem}'
  + '.sc-xdavatar img{width:100%;height:100%;object-fit:cover;display:block}'
  + '.sc-xdmono{background:rgba(245,241,236,.08);color:#F5F1EC;font:700 28px Georgia,serif}'
  + '.sc-xdname{font:500 clamp(26px,3vw,34px)/1.15 Georgia,serif;color:#F5F1EC;margin:0 0 .4rem;padding-right:4rem}'
  + '.sc-xdrole{color:#D8B45E;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;margin:0 0 1.4rem}'
  + '.sc-xdbio{font-size:16px;line-height:1.75;color:rgba(245,241,236,.88);margin:0;white-space:pre-line}'
  + '.sc-xclose{position:absolute;top:1.4rem;right:1.4rem;width:3.6rem;height:3.6rem;border-radius:50%;border:1px solid rgba(245,241,236,.25);background:rgba(245,241,236,.08);color:#F5F1EC;font-size:1.8rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:background .2s ease,transform .2s ease}'
  + '.sc-xclose:hover{background:rgba(245,241,236,.18);transform:rotate(90deg)}'
  + '.sc-xclose:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(201,162,75,.5)}'
  + '@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.sc-xcard{background:rgba(35,50,80,.94)}.sc-xdialog{background:rgba(24,36,64,.97)}}'
  + '@media(max-width:960px){.sc-xteam .sc-xgrid{grid-template-columns:repeat(2,1fr)}}'
  + '@media(max-width:560px){.sc-xteam .sc-xgrid{grid-template-columns:1fr;gap:1.2rem}.sc-xpanel{align-items:flex-end;padding:0}.sc-xdialog{max-width:none;max-height:92dvh;max-height:92svh;border-radius:22px 22px 0 0;padding:2.2rem 2rem calc(2rem + env(safe-area-inset-bottom));transform:translateY(100%)}.sc-xpanel.open .sc-xdialog{transform:none}}'
  + '@media(prefers-reduced-motion:reduce){.sc-xcard,.sc-xscrim,.sc-xdialog,.sc-xclose{transition:none}}';
function monoOf(name) { return String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || 'SC'; }
function scEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function scBrand(s) {
  return String(s).split('Iventions').join('StillCraft').split('IVENTIONS').join('STILLCRAFT');
}
function teamVoiceCard(p, n) {
  const t = (k) => 't-team' + (n * 3 + k);
  const esc = scEsc;
  const media = String(p.img || p.featuredImage || '').trim();
  const avatar = media
    ? `<div class="sc-vo-media" data-sc-id="${t(0)}"><img loading="lazy" alt="${esc(p.name)}" src="${esc(media)}"></div>`
    : `<div class="sc-vo-mono" data-sc-id="${t(0)}">${monoOf(p.name)}</div>`;
  return `<article class="sc-vo" data-sc-voice="team">${avatar}<h3 class="sc-vo-name" data-sc-id="${t(1)}">${esc(p.name)}</h3><p class="sc-vo-title" data-sc-id="${t(2)}">${esc(p.role)}</p><p class="sc-vo-bio" data-sc-id="${t(3)}">${esc(scBrand(p.bio))}</p></article>`;
}
// Card summary: first ~120 chars of the bio, cut at a word boundary.
function teamExcerpt(bio) {
  const s = String(bio || '').replace(/\s+/g, ' ').trim();
  if (s.length <= 120) return s;
  const cut = s.slice(0, 120);
  const sp = cut.lastIndexOf(' ');
  return (sp > 60 ? cut.slice(0, sp) : cut).trim() + '…';
}
// Team expand-card section: trigger cards in a grid; clicking one opens the
// detail dialog (populated from the embedded JSON by the binder script).
// data-sc-id hooks on name/role keep the inline edit bar working.
function teamExpandSection(items) {
  const list = items || [];
  const cards = list.map((p, n) => {
    const media = String(p.img || '').trim();
    const avatar = media
      ? `<span class="sc-xavatar"><img loading="lazy" alt="" src="${scEsc(media)}"></span>`
      : `<span class="sc-xavatar sc-xmono" aria-hidden="true">${monoOf(p.name)}</span>`;
    return `<li><button type="button" class="sc-xcard" data-xi="${n}" aria-haspopup="dialog" aria-label="${scEsc(p.name + '. ' + p.role + '. Open for detail.')}">`
      + avatar
      + `<span class="sc-xhead"><span class="sc-xname" data-sc-id="t-team${n * 3 + 1}">${scEsc(p.name)}</span>`
      + `<span class="sc-xrole" data-sc-id="t-team${n * 3 + 2}">${scEsc(p.role)}</span></span>`
      + `<span class="sc-xsum">${scEsc(teamExcerpt(p.bio))}</span>`
      + `<span class="sc-xmore" aria-hidden="true">Read more &rarr;</span>`
      + `</button></li>`;
  }).join('');
  const data = list.map((p) => ({ name: p.name, role: p.role, bio: scBrand(p.bio), img: String(p.img || '') }));
  return `<section class="sc-voices sc-xteam" id="sc-team" aria-labelledby="sc-xteam-title">`
    + `<header class="sc-voices-head"><span class="sc-voices-kicker">Our team</span>`
    + `<h2 class="sc-voices-title" id="sc-xteam-title">The people behind the work</h2></header>`
    + `<ul class="sc-xgrid">${cards}</ul>`
    + `<div class="sc-xpanel" hidden><div class="sc-xscrim" data-xclose="1"></div>`
    + `<div class="sc-xdialog" role="dialog" aria-modal="true" aria-labelledby="sc-xdname">`
    + `<button type="button" class="sc-xclose" data-xclose="1" aria-label="Close detail">&times;</button>`
    + `<div class="sc-xdavatar" id="sc-xdavatar"></div>`
    + `<h3 class="sc-xdname" id="sc-xdname"></h3>`
    + `<p class="sc-xdrole" id="sc-xdrole"></p>`
    + `<p class="sc-xdbio" id="sc-xdbio"></p>`
    + `</div></div>`
    + `<script type="application/json" class="sc-xdata">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
    + `</section>`;
}
// Dialog binder: delegated clicks open the panel from the embedded JSON,
// close button / scrim click / Escape dismiss it, focus moves into the
// dialog and back to the trigger. Bound once; safe to re-run while settling.
// Code only (no <script> wrapper): the mount injects it via createElement +
// textContent, which executes. (innerHTML-parsed scripts never run.)
const TEAM_X_BIND_JS = `(function(){`
  + `if(window.__scXBound)return;window.__scXBound=1;`
  + `var last=null;`
  + `function sec(){return document.getElementById("sc-team");}`
  + `function items(s){try{var d=s.querySelector(".sc-xdata");return d?JSON.parse(d.textContent||"[]"):[];}catch(e){return [];}}`
  + `function panel(s){return s?s.querySelector(".sc-xpanel"):null;}`
  + `function initials(n){return String(n||"").trim().split(/\\s+/).slice(0,2).map(function(w){return w[0]||"";}).join("").toUpperCase()||"SC";}`
  + `function open(s,i,btn){var list=items(s);var p=list[i];var pn=panel(s);if(!p||!pn)return;`
  + `var av=pn.querySelector("#sc-xdavatar");av.innerHTML="";`
  + `if(p.img){var im=document.createElement("img");im.alt=p.name||"Team member";im.src=p.img;av.appendChild(im);av.className="sc-xdavatar";}`
  + `else{av.className="sc-xdavatar sc-xdmono";av.textContent=initials(p.name);}`
  + `pn.querySelector("#sc-xdname").textContent=p.name||"";`
  + `pn.querySelector("#sc-xdrole").textContent=p.role||"";`
  + `pn.querySelector("#sc-xdbio").textContent=p.bio||"";`
  + `last=btn||null;pn.hidden=false;void pn.offsetWidth;pn.classList.add("open");`
  + `try{document.body.style.overflow="hidden";}catch(e){}`
  + `var c=pn.querySelector(".sc-xclose");if(c)try{c.focus();}catch(e){}}`
  + `function close(){var pn=panel(sec());if(!pn||pn.hidden)return;pn.classList.remove("open");`
  + `try{document.body.style.overflow="";}catch(e){}`
  + `setTimeout(function(){pn.hidden=true;},400);`
  + `if(last&&last.focus)try{last.focus();}catch(e){}last=null;}`
  + `document.addEventListener("click",function(e){`
  + `var t=e.target&&e.target.closest?e.target.closest(".sc-xcard"):null;`
  + `var s=t?t.closest("#sc-team"):null;`
  + `if(t&&s){e.preventDefault();open(s,parseInt(t.getAttribute("data-xi"),10)||0,t);return;}`
  + `var x=e.target&&e.target.closest?e.target.closest("[data-xclose]"):null;`
  + `if(x)close();});`
  + `document.addEventListener("keydown",function(e){if(e.key==="Escape"||e.key==="27")close();});`
  + `})();`;
function reviewCard(it, n) {
  const t = (k) => 't-review' + (n * 4 + k);
  const esc = scEsc;
  const initials = monoOf(it.name || it.org || '');
  const media = it.photo || it.logo;
  const m = media
    ? `<div class="sc-vo-media" data-sc-id="${t(0)}"><img loading="lazy" alt="${esc(it.org || it.name)}" src="${esc(media)}"></div>`
    : `<div class="sc-vo-mono" data-sc-id="${t(0)}">${esc(initials)}</div>`;
  const roleOrg = [it.role, it.org].filter(Boolean).join(' · ');
  const meta = [it.industry, it.location].filter(Boolean).join(' · ');
  return `<article class="sc-vo" data-sc-voice="testimonial">${m}<blockquote class="sc-vo-quote" data-sc-id="${t(1)}">${esc(scBrand(it.quote))}</blockquote><div class="sc-vo-who"><div class="sc-vo-name" data-sc-id="${t(2)}">${esc(it.name)}</div>${roleOrg ? `<p class="sc-vo-role">${esc(roleOrg)}</p>` : ''}${meta ? `<p class="sc-vo-meta">${esc(meta)}</p>` : ''}</div></article>`;
}
function voicesGrid(items, mode) {
  const card = mode === 'team' ? teamVoiceCard : reviewCard;
  return '<div class="sc-voices-grid">' + (items || []).map((it, n) => card(it, n)).join('') + '</div>';
}
function teamItemsOf(cms) {
  const src = cms && cms.team && Array.isArray(cms.team.items)
    ? cms.team.items
    : (cms && Array.isArray(cms.team) ? cms.team : null);
  if (src && src.length) {
    return src.map((it) => ({
      name: String(it.name || '').trim(),
      role: String(it.role || '').trim(),
      bio: String(it.bio || '').trim(),
      // CMS portraits (StillCraft's own team shots) when the bundle carries them;
      // absent -> the sc-vo-mono monogram fallback.
      img: String((it.featuredImage && it.featuredImage.node && it.featuredImage.node.sourceUrl)
        || (it.portrait && it.portrait.node && it.portrait.node.sourceUrl)
        || it.featuredImage || it.portrait || it.photo || '').trim(),
    }));
  }
  return TEAM;
}
function replaceTeamGrid(html, cms) {
  const anchor = 'js-talent-main';
  const gi = html.indexOf(anchor);
  if (gi < 0) return html;
  const openStart = html.lastIndexOf('<div', gi);
  const openEnd = html.indexOf('>', gi);
  if (openStart < 0 || openEnd < 0) return html;
  let depth = 1;
  const re = /<(\/?)div(?=[\s>])/gi;
  re.lastIndex = openEnd + 1;
  let m, end = -1;
  while ((m = re.exec(html))) {
    if (m[1] === '/') {
      depth--;
      if (depth === 0) { end = m.index; break; }
    } else {
      const gt = html.indexOf('>', m.index);
      if (gt > 0 && html[gt - 1] !== '/') depth++;
    }
    if (re.lastIndex > openEnd + 500000) break;
  }
  if (end < 0) return html;
  // sanity: the grid we replace must contain the old roster
  const inner = html.slice(openEnd + 1, end);
  if (!inner.includes('Alise Grota')) return html;
  const cards = voicesGrid(teamItemsOf(cms), 'team');
  return html.slice(0, openEnd + 1) + VOICES_CSS + cards + html.slice(end);
}
export function applyTeamSectionFix(html, cms) {
  if (process.env.SC_NOTEAM) return html;
  if (!html.includes('js-talent-main')) return html;
  const gridHtml = JSON.stringify(voicesGrid(teamItemsOf(cms), 'team'));
  const css = '<style id="sc-talent-fix">'
    + '.styles_talent__AlRC3{display:block !important}'
    + '@media(max-width:1199px){.styles_talent__AlRC3{padding:10rem 2.4rem 10rem !important}}'
    + '.styles_talent__AlRC3 .styles_talent_wrapper_title__up9Zp h2,'
    + '.styles_talent__AlRC3 .styles_talent_wrapper_title__up9Zp h2 span,'
    + '.styles_talent__AlRC3 h2, .styles_talent__AlRC3 h2 span{color:#F5F1EC !important}'
    + '.styles_talent__AlRC3 .styles_talent_wrapper_title__up9Zp .Paragraph_paragraph__SId_Y,'
    + '.styles_talent__AlRC3 .styles_talent_wrapper_title__up9Zp p{color:#F5F1EC !important;font-size:clamp(22px,2.4vw,30px) !important;line-height:1.6 !important}'
    + '.styles_talent__AlRC3 .sc-voices-grid{padding:3rem 0 0}'
    + VOICES_CSS_RULES
    + '</style>';
  const js = '<script>(function(){var inject=function(){try{var els=document.querySelectorAll(\'[class*="js-talent-main"]\');for(var i=0;i<els.length;i++){var el=els[i];if(el.querySelector(\'.sc-voices-grid\'))continue;el.innerHTML=' + gridHtml + ';}}catch(e){}};window.addEventListener(\'load\',function(){setTimeout(inject,900);setTimeout(inject,2500);});setTimeout(inject,1200);setTimeout(inject,3200);setTimeout(inject,6000);if(document.readyState!==\'loading\'){setTimeout(inject,600);}})();</script>';
  if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, css + '\n$&');
  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, js + '\n$&');
  return html;
}
// Homepage client-voice band: the TEMPLATE carousel owns this band.
//
// It used to be replaced wholesale by a card grid built from the CMS, with a
// post-hydration script re-injecting that grid over the band. Two renderers
// then fought for the same mount point: React re-rendered the carousel from
// the flight payload while the script kept writing the grid over it, and in
// the window between them every org logo sat stacked in one slot instead of
// one testimonial at a time.
//
// The band is now left exactly as the template ships it - slides, org logos,
// leader photos and arrows - and the CMS copy is applied into it by
// applyTestimonials (names, quotes, roles, organisations, locations,
// industries), positionally, per slide. The carousel's own images are
// deliberately left untampered.
export function applyHomeVoices(html, page, cms) {
  return html;
}
export function applySplash(html, page) {  if (page === '/insider') return html;
  if (!/<body[^>]*>/i.test(html)) return html;
  const css = `<style>#sc-splash{position:fixed;inset:0;background:#1B2A4A;z-index:2147483640;display:flex;align-items:center;justify-content:center;transition:opacity .45s ease}#sc-splash span{color:#C9A24B;font:600 13px Arial,sans-serif;letter-spacing:4px;animation:sc-pulse 1.2s ease-in-out infinite}@keyframes sc-pulse{50%{opacity:.35}}</style>`;
  const div = `<div id="sc-splash"><span>STILLCRAFT EVENTS</span></div>`;
  const js = `<script>(function(){var kill=function(){var s=document.getElementById('sc-splash');if(!s||s.dataset.done)return;s.dataset.done='1';s.style.opacity='0';setTimeout(function(){s.remove();},500);};var freeLoader=function(){try{var els=document.querySelectorAll('[class*="PageLoader"],[class*="pageLoader"]');for(var i=0;i<els.length;i++){els[i].style.opacity='0';els[i].style.pointerEvents='none';setTimeout((function(el){return function(){el.remove();};})(els[i]),600);}if(document.body&&document.body.classList)document.body.classList.add('is-ready');}catch(e){}};var revealStuck=function(){try{var masks=document.querySelectorAll('.line-mask');for(var i=0;i<masks.length;i++){for(var p=masks[i];p&&p!==document.body;p=p.parentElement){try{if(getComputedStyle(p).visibility==='hidden')p.style.visibility='visible';}catch(e){}}}}catch(e){}};window.addEventListener('load',function(){setTimeout(kill,350);setTimeout(freeLoader,3500);});setTimeout(kill,4000);var n=0;var iv=null;var sweep=function(){n++;try{freeLoader();}catch(e){}if(n>=4){try{revealStuck();}catch(e){}}if(n>=30||!document.querySelector('[class*="PageLoader"],[class*="pageLoader"]')){if(iv)clearInterval(iv);}};setTimeout(function(){sweep();iv=setInterval(sweep,1000);},2500);setTimeout(freeLoader,4500);})();</script><noscript><style>#sc-splash{display:none}</style></noscript>`;
  html = html.replace(/<\/head>/i, css + '\n$&');
  html = html.replace(/<body[^>]*>/i, (m) => m + '\n' + div + '\n' + js);
  return html;
}

// The cloned bundle hides every split-text line (visibility:hidden) and relies
// on a GSAP entrance tween to reveal it. That tween is requestAnimationFrame
// driven, and the console shows "GSAP target not found" on some mounts, so any
// failure in the animation layer leaves the copy permanently invisible — the
// page looks blank with no error. This is a failsafe, not the animation: if
// lines are still hidden well after load, or a script error fires, reveal them.
// Only elements that actually wrap a .line-mask are touched, so genuinely
// hidden UI (the closed nav overlay, off-screen slides) is left alone, and
// only `visibility` is changed, never opacity or transforms.
export function applyRevealFailsafe(html) {
  if (!/<body[^>]*>/i.test(html)) return html;
  const js = `<script>(function(){
var DELAY=6000,done=false;
function reveal(){
  var masks=document.querySelectorAll('.line-mask'),n=0;
  for(var i=0;i<masks.length;i++){
    for(var p=masks[i];p&&p!==document.body;p=p.parentElement){
      if(getComputedStyle(p).visibility==='hidden'){p.style.visibility='visible';n++;}
    }
  }
  if(n>0&&window.console&&console.warn)console.warn('[stillcraft] entrance animation did not run; revealed '+n+' hidden line(s)');
  done=true;
}
window.addEventListener('load',function(){setTimeout(function(){if(!done)reveal();},DELAY);});
window.addEventListener('error',function(){setTimeout(function(){if(!done)reveal();},400);},true);
})();</script>`;
  return html.replace(/<body[^>]*>/i, (m) => m + '\n' + js);
}
