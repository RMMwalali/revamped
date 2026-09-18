// StillCraft page transforms shared by the dev server and Vercel functions.
// Pure string ops over served HTML (+ brand data via pool). No http, no fs writes.
import { pool } from './db.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { FLIGHT as FILE_FLIGHT } from './stillcraft-content.mjs';
import { LOGO_ROWS } from './stillcraft-logos.mjs';
export { LOGO_ROWS };
export { CONTENT as FILE_CONTENT } from './stillcraft-content.mjs';
import { NAMES as LOGO_NAMES } from './stillcraft-names.mjs';
export { NAMES as LOGO_NAMES } from './stillcraft-names.mjs';
import { safeReplace, safeReplacePairs, verifyFlight, findEdgesArrays, splitTopObjects } from './flight.mjs';

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
    const r = await pool.query('SELECT key, value FROM brand_settings');
    brandCache = { ...BRAND_DEFAULTS, ...Object.fromEntries(r.rows.map((x) => [x.key, x.value])) };
  } catch { brandCache = { ...BRAND_DEFAULTS, ...brandCache }; }
  brandAt = Date.now();
  return brandCache;
}

const DEFAULT_TAGLINE = 'Step into the Spotlight';

// ---------- site IA: StillCraft navigation (existing pages, new titles) ----------
const NAV_LABELS = [
['Events', 'Brand Activations'],
  ['Exhibits', 'Malls & Retail'],
  ['Work', 'Projects'],
];
const NAV_DROP_HREFS = ['/service/sports'];
const TITLE_MAP = {
  '/': 'International Event Agency | Brand Activations, Malls &amp; Retail | StillCraft Events',
  '/home': 'International Event Agency | Brand Activations, Malls &amp; Retail | StillCraft Events',
  '/about': 'About - StillCraft Events',
  '/service/events': 'Brand Activations | Brands and Corporates | StillCraft Events',
  '/service/exhibits': 'Malls &amp; Retail | Malls Programming and Retail | StillCraft Events',
  '/projects': 'Projects | Case Studies | StillCraft Events',
  '/contact': 'Contact | Start Your Project | StillCraft Events',
  '/service/congresses': 'Mall Space Activation | Vacant Units Earning | StillCraft Events',
};

// StillCraft menu order: Home, About, Malls & Retail, Brand Activations, Projects, Contact.
const MENU_ORDER = [
  ['/', 'Home'],
  ['/about', 'About'],
  ['/service/exhibits', 'Malls &amp; Retail'],
  ['/service/events', 'Brand Activations'],
  ['/projects', 'Projects'],
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
  return safeReplacePairs(html, P);
}
const MENU_DROP_URLS = ['/service/sports/', '/insights/'];
const MENU_TITLES = { About: 'About', Events: 'Brand Activations', Exhibits: 'Malls & Retail', Work: 'Projects', Congresses: 'Space Activation', Sports: 'Our Work' };
function applyFlightIA(html) {
  // All replacements run through the length-synced replacer: menu JSON rows
  // are plain edits, while anything landing inside a length-prefixed flight
  // row (e.g. article HTML) gets its hex length recomputed instead of
  // corrupting the stream ("Application error ... Connection closed").
  const homeObj = linkObj('Home', ORIGIN + '/home/');
  const brandObj = linkObj('Brand Activations', ORIGIN + '/service/events/');
  const mallsObj = linkObj('Malls & Retail', ORIGIN + '/service/exhibits/');
  const P = [
    // 0) service entity titles drive the page headlines (menu keeps short
    // labels). Must run before the menu rename below (same original values).
    [`"slug":"events","title":"Events"`, `"slug":"events","title":"Brands and Corporates"`],
    [`\\"slug\\":\\"events\\",\\"title\\":\\"Events\\"`, `\\"slug\\":\\"events\\",\\"title\\":\\"Brands and Corporates\\"`],
    [`"slug":"exhibits","title":"Exhibits"`, `"slug":"exhibits","title":"Malls Programming and Retail"`],
    [`\\"slug\\":\\"exhibits\\",\\"title\\":\\"Exhibits\\"`, `\\"slug\\":\\"exhibits\\",\\"title\\":\\"Malls Programming and Retail\\"`],
    [`"slug":"congresses","title":"Congresses"`, `"slug":"congresses","title":"Mall Space Activation"`],
    [`\\"slug\\":\\"congresses\\",\\"title\\":\\"Congresses\\"`, `\\"slug\\":\\"congresses\\",\\"title\\":\\"Mall Space Activation\\"`],
  ];
  // 1) drop Sports / Insights link objects (object + trailing comma).
  // About + Congresses (Space Activation) are kept (main + footer nav).
  for (const u of MENU_DROP_URLS) {
    const title = { '/service/sports/': 'Sports', '/insights/': 'Insights' }[u];
    P.push([linkObj(title, ORIGIN + u) + ',', '']);
  }
  // 2) rename remaining titles (skip About: dropped above; Home stays)
  for (const [from, to] of Object.entries(MENU_TITLES)) {
    if (from === 'About') continue;
    P.push([`${EQ}title${EQ}:${EQ}${from}${EQ}`, `${EQ}title${EQ}:${EQ}${to}${EQ}`]);
  }
  // 3) prepend Home to header menus (footer already starts with Home).
  // Header flight starts with About (kept), so anchor on the About object.
  const aboutObj = linkObj('About', ORIGIN + '/about/');
  P.push([`${EQ}menus${EQ}:[${aboutObj}`, `${EQ}menus${EQ}:[${homeObj},${aboutObj}`]);
  // 4) order Malls & Retail before Brand Activations
  P.push([brandObj + ',' + mallsObj, mallsObj + ',' + brandObj]);
  // 5) localize CMS link targets (LinkedIn/Instagram untouched)
  P.push([ORIGIN + '/', '/']);
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
function cutFlightTuple(html, open) {
  // open at '[' of ["$",type,key,props]; string-aware bracket balance.
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = open; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
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
  // Footer Explore order must match the header: Home, About, Malls & Retail,
  // Brand Activations, Projects, Contact. Raw footer has Events before
  // Exhibits, so swap those two <p> blocks (href-anchored, rename-safe).
  const re = (href) => new RegExp(`<p\\b[^<>]*>\\s*<a\\b[^<>]*href="${href}"[^<>]*>[\\s\\S]*?<\\/a>\\s*<\\/p>`, 'i');
  const evM = re('/service/events').exec(html);
  const exM = re('/service/exhibits').exec(html);
  if (!evM || !exM || evM.index < 0 || exM.index < 0) return html;
  // Only swap when Events block comes first (raw order).
  if (evM.index > exM.index) return html;
  const ev = evM[0], ex = exM[0];
  const PH1 = '\0FOOTEV\0', PH2 = '\0FOOTEX\0';
  html = html.replace(ev, PH1).replace(ex, PH2);
  return html.split(PH1).join(ex).split(PH2).join(ev);
}
// StillCraft footprint: the template marquee scrolls 45 European/Middle-East
// cities under a botched "Nairobi … Europe's most iconic cities" heading.
// Rewrite the heading as one coherent sentence and point the marquee + flight
// city data at StillCraft's real malls and neighbourhoods. Runs after global
// swaps (so template "Barcelona" is already "Nairobi" and is left alone).
const FOOTPRINT = ['Galleria Mall', 'Sarit Centre', 'Westgate Mall', 'Two Rivers Mall', 'Village Market', 'Junction Mall', 'Imaara Mall', 'Southfield Mall', 'Westlands', 'Kilimani', 'South C', 'Ngong Road', 'Upperhill', 'Karen', 'Eastleigh'];
const MARQUEE_ORDER = ['Toulouse', 'Glasgow', 'Copenhagen', 'Rome', 'Birmingham', 'Brussels', 'Manchester', 'Edinburgh', 'Dublin', 'Luxembourg', 'Venice', 'London', 'Amsterdam', 'Madrid', 'Berlin', 'Vienna', 'Lisbon', 'Paris', 'Munich', 'Milan', 'Cardiff', 'Newcastle', 'Rotterdam', 'Vitoria', 'Riga', 'Sofia', 'Bratislava', 'Ljubljana', 'Bucharest', 'Helsinki', 'Athens', 'Kaunas', 'Prague', 'Budapest', 'Stockholm', 'Belgrade', 'Nicosia', 'Tallinn', 'Valletta', 'Vilnius', 'Warsaw', 'Abu Dhabi', 'Istanbul', 'Shanghai'];
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
export function applyHighlightsFix(html, page) {
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
  // Events/Exhibits metas read Brand Activations / Malls & Retail by now)
  const catGuards = [['>Sports</div>', 4], ['>Brand Activations</div>', 2], ['>Malls & Retail</div>', 2], ['>Congresses</div>', 2]];
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
// Homepage client-voice slider: 8 template slides (UEFA, Pfizer, CordenPharma,
// Menzies, Midas, Adevinta…) with quotes, headshots and case links that do not
// belong to StillCraft. No real StillCraft quotes exist (brief: do not
// fabricate), so the whole band goes — quotes/info container, arrows/counter
// container and leader-photos strip — plus the flight testimonials nodes and
// their preloads. Skipped when the band carries no template markers.
const SLIDER_TEMPLATE_MARKS = ['UEFA', 'Pfizer', 'CordenPharma', 'Menzies', 'Midas', 'Adevinta', 'Iventions delivered excellent'];
export function applySliderFix(html, page) {
  if (page === '/insider') return html;
  // Facet rows + slider pieces are identified structurally with template-mark
  // guards, so this safely runs on any page that still carries them.
  // cut from the first facet row: 4 contiguous css-zme24x rows
  // (participants / industry / event type / location) feed the slider,
  // followed immediately by its quotes container
  const lvt = html.indexOf('<div class="Container_container_grid__LWYyb css-lvtjah">');
  if (lvt < 0) return html;
  const pOpen = '<div class="css-zme24x">';
  const rows = [];
  let scan = lvt;
  for (let k = 0; k < 4; k++) {
    const o = html.lastIndexOf(pOpen, scan - 1);
    if (o < 0) return html;
    rows.unshift(o);
    scan = o;
  }
  const labels = ['participants', 'industry', 'event type', 'location'];
  const ends = rows.map((o) => cutBalancedDiv(html, o));
  if (ends.some((e) => e < 0)) return html;
  for (let k = 0; k < 4; k++) {
    const inner = html.slice(rows[k], ends[k]);
    if (!inner.includes('>' + labels[k] + '<')) return html;
    if (k < 3 && rows[k + 1] !== ends[k]) return html;
  }
  // remove the 4 facet rows (back to front)
  for (let k = 3; k >= 0; k--) html = html.slice(0, rows[k]) + html.slice(ends[k]);
  // quotes container (balanced, must carry a template mark)
  {
    const s = html.indexOf('<div class="Container_container_grid__LWYyb css-lvtjah">');
    if (s >= 0) {
      const e = cutBalancedDiv(html, s);
      if (e > 0) {
        const band = html.slice(s, e);
        if (SLIDER_TEMPLATE_MARKS.some((m) => band.includes(m))) {
          html = html.slice(0, s) + html.slice(e);
        }
      }
    }
  }
  // arrows + counter container (balanced, EventSliderActions inside)
  {
    const s = html.indexOf('<div class="Container_container_grid__LWYyb css-12ybk68">');
    if (s >= 0) {
      const e = cutBalancedDiv(html, s);
      if (e > 0 && html.slice(s, e).includes('EventSliderActions')) {
        html = html.slice(0, s) + html.slice(e);
      }
    }
  }
  // leader-photos strip (balanced div, Leader alts inside)
  {
    const s = html.indexOf('<div class="css-41c6dw">');
    if (s >= 0) {
      const e = cutBalancedDiv(html, s);
      if (e > 0) {
        const seg = html.slice(s, e);
        if (seg.includes('alt="Leader"') && SLIDER_TEMPLATE_MARKS.some((m) => seg.includes(m))) {
          html = html.slice(0, s) + html.slice(e);
        }
      }
    }
  }
  // case-link buttons of the slider (generic hrefs, slider-only pages)
  {
    const re = /<div class="css-jp7bfh">[\s\S]*?see full case study[\s\S]*?<\/a><\/div>/g;
    let m;
    const hits = [];
    while ((m = re.exec(html))) hits.push([m.index, m.index + m[0].length]);
    hits.sort((a, b) => b[0] - a[0]);
    for (const [a, b] of hits) html = html.slice(0, a) + html.slice(b);
  }
  // flight testimonial arrays → empty (edges and plain shapes; guarded).
  // Only template-curated arrays (leave admin-curated ones alone).
  const TM_RE = /(UEFA|Pfizer|CordenPharma|Menzies|Midas|Adevinta|Adidas|FedEx|Turkish|VEEAM)/;
  try {
    const BS = String.fromCharCode(92);
    const FQ = BS + '"';
    const tkeys = [FQ + 'testimonials' + FQ + ':{' + FQ + 'edges' + FQ + ':[', FQ + 'testimonials' + FQ + ':'];
    for (const tkey of tkeys) {
      let idx = html.indexOf(tkey);
      let guard = 0;
      while (idx >= 0 && guard++ < 6) {
        // value open: '[' for edges-key hits; for the plain key the value may
        // be an immediate array or an object holding an edges array
        let open = idx + tkey.length - 1;
        if (html[open] !== '[') {
          if (tkey.endsWith(':[')) break;
          if (html[open] === ':' && html[open + 1] === '[') {
            open = open + 1;
          } else if (html[open] === ':') {
            // plain key hit an object value: step into it only via edges
            const ek = FQ + 'edges' + FQ + ':[';
            const ei = html.indexOf(ek, idx);
            if (ei < 0 || ei - idx > 400) { idx = html.indexOf(tkey, idx + tkey.length); continue; }
            open = ei + ek.length - 1;
          } else {
            idx = html.indexOf(tkey, idx + tkey.length);
            continue;
          }
        }
        let depth = 0, k = open, end = -1;
        for (; k < html.length; k++) {
          const c = html[k];
          if (c === BS) { k++; continue; }
          if (c === '[') depth++;
          else if (c === ']') { depth--; if (depth === 0) { end = k; break; } }
          if (k - open > 120000) break;
        }
        if (end < 0) break;
        const inner = html.slice(open + 1, end);
        if (!inner.includes('testimonialTemplate') || !TM_RE.test(inner)) { idx = html.indexOf(tkey, end); continue; }
        const badBefore = (() => { try { return verifyFlight(html).bad; } catch { return 0; } })();
        const cand = safeReplacePairs(html, [[inner, '']]);
        if (cand === html) { idx = html.indexOf(tkey, end); continue; }
        try {
          if (verifyFlight(cand).bad <= badBefore) html = cand;
        } catch { /* keep static fix */ }
        idx = html.indexOf(tkey, idx + 2);
      }
    }
  } catch { /* static fix stands */ }
  // preloads for slider headshots / testimonial logos
  for (const slug of ['Adel-Kertesz', 'Theresa-Ruivo', 'Bruno-Sciamanna', 'Camilla-Di-Zenzo', 'Ella-McClary', 'Costanza-Rota', 'Jo-Harrison', 'Testimonials_', 'Testimonial_', 'UEFA-logo', 'Pfizer-logo']) {
    const esc = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`<link\\b[^>]*${esc}[^>]*>\\s*`, 'g'), '');
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
// Brand Activations / Malls & Retail / Space Activation / Our Work (home only;
// strict count guards, static + flight via length-synced pairs).
const SVC_CARDS = [
  { title: ['Events', 'Brand Activations'],
    subs: [['Global Events, Brand ', 'Campaigns & Sponsorships,'], ['Activations, Experience ', 'Activations & Roadshows,'], ['Content', 'One Team End To End']],
    flightTitle: ['Global Events, Brand Activations, Experience Content', 'Campaigns & Sponsorships, Activations & Roadshows, One Team End To End'],
    desc: ['From corporate summits to viral moments, we create experiences that fuel alignment and connection between audiences and business goals.',
      'Strategy through delivery. One team plans your brand’s next move and stays to deliver it, from the boardroom to the ground.'],
    frags: ['From corporate summits to viral moments, '] },
  { title: ['Exhibits', 'Malls & Retail'],
    subs: [['Exhibitions, Trade Shows, ', 'Year-Round Calendars,'], ['Roadshows, Ephemeral ', 'Seasonal Moments,'], ['Builds', 'Run For You']],
    flightTitle: ['Exhibitions, Trade Shows, Roadshows, Ephemeral Builds', 'Year-Round Calendars, Seasonal Moments, Run For You'],
    desc: ['Presence isn’t enough. We design modular brand spaces that speak, perform and stick, with strategy and flair built into every wall.',
      'One calendar, run for you. StillCraft plans, staffs and runs the entire programme, so your team manages the center instead of the calendar.'],
    frags: ['Presence isn’t enough. We design modular '] },
  { title: ['Congresses', 'Space Activation'],
    subs: [['Congresses, Internal ', 'Vacant Units,'], ['Meetings, Destination ', 'Curated Occupation,'], ['Management', 'Earning While Relet']],
    flightTitle: ['Congresses, Internal Meetings, Destination Management', 'Vacant Units, Curated Occupation, Earning While Relet'],
    desc: ['We turn high-stakes gatherings into high-impact experiences. Designed to align minds, move decisions and maximise clarity.',
      'When an anchor exits, StillCraft runs the space as a working, earning programme until it is properly relet.'],
    frags: ['We turn high-stakes gatherings into '] },
  { title: ['Sports', 'Our Work'],
    subs: [['Sponsorship, Activations, ', 'Mall Programmes,'], ['Venue Transformation', 'Brand Campaigns, Case Studies']],
    flightTitle: ['Sponsorship, Activations, Venue Transformation', 'Mall Programmes, Brand Campaigns, Case Studies'],
    desc: ['We build emotional power into every play. From VIP lounges to brand arenas, we help you win over fans and leave a lasting mark.',
      'Eleven seasonal mall activations across Nairobi. Real programmes, planned and delivered on the ground.'],
    frags: ['We build emotional power into every play. ', 'From VIP lounges to brand arenas, we help ', 'you win over fans and leave a lasting mark.'] },
];
export function applyServiceCardsFix(html, page) {
  if (page !== '/' && page !== '/home') return html;
  if (html.indexOf('css-bpizdw') < 0) return html;
  // verify every old string first (atomic: bail before touching anything).
  // Titles may already carry the new name (nav rename runs earlier): then the
  // title job is skipped, but the new name must be present or we bail.
  // Subtitle lines are scoped to line-divs (bare words like Content/Builds
  // would collide); flight card titles are swapped whole.
  const jobs = [];
  for (const card of SVC_CARDS) {
    const [oldT, newT] = card.title;
    const tc = html.split('>' + oldT + '</').length - 1;
    if (tc >= 1) {
      jobs.push(['>' + oldT + '</', '>' + newT + '</']);
    } else if (html.split('>' + newT + '</').length - 1 < 1) {
      return html;
    }
    for (const [oldS, newS] of card.subs) {
      const key = '>' + oldS + '</div>';
      if (html.split(key).length - 1 < 1) return html;
      jobs.push([key, '>' + newS + '</div>']);
    }
    const [oldF, newF] = card.flightTitle;
    if (html.split(oldF).length - 1 < 1) return html;
    jobs.push([oldF, newF]);
    const [oldD, newD] = card.desc;
    if (html.split(oldD).length - 1 < 2) return html;
    jobs.push([oldD, newD]);
    for (const frag of (card.frags || [])) {
      if (html.split(frag).length - 1 < 1) return html;
      jobs.push([frag, '']);
    }
  }
  // sports card → portfolio (page-gated: never rewrite the sports page itself)
  jobs.push(['href="/service/sports"', 'href="/projects"']);
  // length-synced single pass (static markup + flight rows)
  return safeReplacePairs(html, jobs);
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
  const esc = (s) => String(s).split(BS).join(BS + BS).split('"').join(BS + '"');
  let out = node;
  const repFirst = (src, from, to) => {
    const i = src.indexOf(from);
    if (i < 0) return null;
    return src.slice(0, i) + to + src.slice(i + from.length);
  };
  const FQ = BS + '"';
  // slug
  {
    const m = (FQ + 'slug' + FQ + ':').length;
    const i = out.indexOf(FQ + 'slug' + FQ + ':');
    if (i < 0) return null;
    const q = out.indexOf(FQ, i + m + 1);
    if (q < 0) return null;
    out = out.slice(0, i + m + 1) + c.slug + out.slice(q);
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
    const j = out.indexOf(FQ, i + lead.length);
    if (j < 0) return null;
    out = out.slice(0, i + lead.length) + esc(c.title) + out.slice(j);
  }
  // content (first) → excerpt paragraph
  {
    const lead = FQ + 'content' + FQ + ':' + FQ;
    const i = out.indexOf(lead);
    if (i >= 0) {
      const j = out.indexOf(FQ, i + lead.length);
      if (j >= 0) out = out.slice(0, i + lead.length) + '<p>' + esc(c.excerpt) + '</p>' + BS + 'n' + out.slice(j);
    }
  }
  // cover image (first sourceUrl)
  {
    const lead = FQ + 'sourceUrl' + FQ + ':' + FQ;
    const i = out.indexOf(lead);
    if (i >= 0) {
      const j = out.indexOf(FQ, i + lead.length);
      if (j >= 0) out = out.slice(0, i + lead.length) + `/assets/stillcraft/mall-case/${c.slug}/cover.svg` + out.slice(j);
    }
  }
  // location / industry / participants (first each)
  {
    const lead = FQ + 'location' + FQ + ':' + FQ;
    const i = out.indexOf(lead);
    if (i >= 0) {
      const j = out.indexOf(FQ, i + lead.length);
      if (j >= 0) out = out.slice(0, i + lead.length) + esc(c.location) + out.slice(j);
    }
    const il = FQ + 'industry' + FQ + ':' + FQ;
    const ii = out.indexOf(il);
    if (ii >= 0) {
      const j = out.indexOf(FQ, ii + il.length);
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
        const u = win.slice(qk + sm.length, qj);
        if (u && u.startsWith('/assets/') && !imgs.includes(u)) imgs.push(u);
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
      const isTplUrl = (u) => u.includes('/assets/cms/') && DENY_IMG.some((d) => u.includes(d));
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
export function applyLogosFix(html) {
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
// StillCraft stats: the template block ships 5 achievements (270+ projects,
// 90% clients, 21 nationalities, 31 countries, 1.2K moments). The brief keeps
// only confirmed figures — Projects Delivered 150+ and Loyal Clients 88%.
// This rewrites slots 1-2 in place and drops slots 3-5 from static markup and
// the flight achievements array (guarded: any flight-oracle regression reverts
// the flight half, static edits are plain string ops).
export function applyStatsFix(html) {
  if (html.indexOf('Projects Delivered') < 0 || html.indexOf('achievements') < 0) return html;
  // --- 1) flight achievements array: keep first 2 nodes, rewrite 150+/88% ---
  try {
    const out = statsFixFlight(html);
    if (out && out !== html) html = out;
  } catch { /* keep static-only fix */ }
  // --- 2) static rows: keep first 2 items per row ---
  // (pinned counters are nested 3-deep; match the outer wrapper instead)
  html = statsKeepFirstTwo(html, '<div class="css-a1l9nu"', '<p', '</div>');
  html = statsKeepFirstTwo(html, '<div class="Container_container_grid__LWYyb css-lvr4xy"><div class="css-37zjk9"><div class="css-1k1kaow"><div class="js-team-achievement-item', '<p', '</div></div></div></div>');
  html = statsKeepFirstTwo(html, '<div class="css-1ciizvo"', '<p', '</div>');
  html = statsKeepFirstTwoBalanced(html, '<div class="styles_embla__slide__ORTTe');
  html = statsKeepFirstTwoBalanced(html, '<div class="css-ns7bf6');
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
    let fresh = nodes.slice(0, 2).join(',');
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
  // /service/congresses now serves Mall Space Activation: keep the footer link
  // and rename it (header menu never lists it).
  html = html.replace(/(<a\b[^<>]*href="\/service\/congresses"[^<>]*>\s*<span\b[^<>]*>)Congresses(<\/span>\s*<\/a>)/g, '$1Space Activation$2');
  // blog removed - strip from header and footer (whole footer <p>, no empty shells)
  html = html.replace(/<a\b[^>]*href="\/insights"[^>]*>[\s\S]*?<\/a>/gi, '');
  html = html.replace(/<p\b[^<>]*>\s*<a\b[^<>]*href="\/insights"[^<>]*>[\s\S]*?<\/a>\s*<\/p>/gi, '');
  html = html.replace(/<a\b[^>]*href="\/insights"[^>]*>\s*<span[^>]*>\s*Blog\s*<\/span>\s*<\/a>/gi, '');
  html = html.replace(/<p\b[^<>]*class="styles_contents_menu_item[^"]*"[^<>]*>\s*<\/p>/gi, '');
  html = applyFooterMenuOrder(html);
  // insights section removed (client killed the blog): cut the whole block
  html = removeInsightSection(html);
  if (TITLE_MAP[page]) {
    const orig = /<title>([^<]*)<\/title>/.exec(html);
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${TITLE_MAP[page]}</title>`);
    // keep document.title stable through hydration (flight metadata carries the old title)
    if (orig && orig[1] && orig[1] !== TITLE_MAP[page]) {
      const fromFlight = orig[1].replace(/&amp;/g, '&');
      const toFlight = TITLE_MAP[page].replace(/&amp;/g, '&');
      if (fromFlight.length > 8) html = flightReplace(html, fromFlight, toFlight);
      // flight escapes & as \u0026 in metadata strings
      if (fromFlight.includes('&')) html = flightReplace(html, fromFlight.split('&').join('\\u0026'), toFlight);
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

function stripThirdParty(html) {
  // Cookiebot + Cloudflare beacon: 404/domain-not-authorized on localhost, safe to drop.
  html = html.replace(/<link[^>]*href="https:\/\/consent\.cookiebot\.com[^"]*"[^>]*>\s*/gi, '');
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
    // 1) flight payloads: brand word at value starts/ends (code/URLs/slugs untouched).
    // Length-synced so matches inside length-prefixed rows stay valid.
    html = safeReplacePairs(html, [
      [`"Iventions`, `"` + name],
      [`"IVENTIONS`, `"` + upper],
      [` Iventions${EQ}`, ` ${name}${EQ}`],
    ]);
    // 2) static markup outside <script> (attributes/URLs/emails untouched)
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
  const logo = (brand.logo_src || '').trim();
  if (logo) {
    const target = logo.replace(/^\//, '');
    // Existing copies: bare "upload/icon-logo.svg" (root + assets/root).
    html = safeReplace(html, 'upload/icon-logo.svg', target);
    // Header figure + preload refs use the CMS-upload path; swap it too.
    html = safeReplace(html, '/assets/cms/wp-content/uploads/2025/06/icon-logo.svg', '/' + target);
    // Escaped variant inside flight payloads (backslash-forward-slash).
    html = safeReplace(html, '\\u002Fassets\\u002Fcms\\u002Fwp-content\\u002Fuploads\\u002F2025\\u002F06\\u002Ficon-logo\\u002Esvg', '\\u002F' + target.split('/').join('\\u002F'));
    html = safeReplace(html, '\\/assets\\/cms\\/wp-content\\/uploads\\/2025\\/06\\/icon-logo\\.svg', '\\/' + target.split('/').join('\\/'));
    // Browser-tab icon: point rel=icon + apple-touch-icon links at the brand
    // favicon PNG (regenerated from the logo on disk) instead of the old ICO.
    html = safeReplace(html, '/assets/root/favicon.ico', '/assets/root/favicon.png');
    // Fix the logo rendering: the Next.js header was designed for a narrow wordmark
    // SVG. Override blend mode and let the PNG retain its natural 2.19:1 aspect ratio.
    const logoStyle = `<style id="sc-logo-style">` +
      `.styles_logo__7LWm4{mix-blend-mode:normal !important;}` +
      `.styles_logo__7LWm4>div{width:fit-content !important;height:100% !important;aspect-ratio:auto !important;}` +
      `.styles_logo__7LWm4 img{position:static !important;height:100% !important;width:auto !important;max-width:min(80vw,44rem) !important;object-fit:contain !important;}` +
      `</style>`;
    html = html.replace(/<\/head>/i, logoStyle + '</head>');
  }
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
export {
  IMAGE_EXTS, IMAGE_EXT_LIST, IMAGE_MAX, getBrand, bustBrand, applyBrand, applyNav, applyMenuOrder, applyTheme,
  stripThirdParty, flightReplace, applyFlightIA, applyContentFlight, applyLinks,
  applyGlobalSwaps, applyFooterAddresses, applyHeroVideo, mobileFor, posterFor, parseUpload, sniffImage, sniffMedia, FILE_FLIGHT,
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
export function removeStaleProjectCards(html) {
  if (!html || !STALE_PROJECT_SLUGS.some((s) => html.indexOf(s) >= 0)) return html;
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
  const js = `<script>(function(){var fix=function(){try{var els=document.querySelectorAll('[class*="bottom_copyright"]');for(var i=0;i<els.length;i++){var w=document.createTreeWalker(els[i],NodeFilter.SHOW_TEXT);var n;while((n=w.nextNode())){var v=n.nodeValue;if(!v)continue;var nv=v.replace(/IVENTIONS/g,'STILLCRAFT EVENTS CO.').replace(/Iventions/g,'StillCraft Events Co.');if(nv!==v)n.nodeValue=nv;}}var f=document.querySelector('footer');if(f){var ps=f.querySelectorAll('[fill="#1E1E1E"]');for(var j=0;j<ps.length;j++){ps[j].setAttribute('fill','#F5F1EC');}}}catch(e){}};window.addEventListener('load',function(){setTimeout(fix,800);});setTimeout(fix,4000);if(document.readyState!=='loading'){setTimeout(fix,1500);}})();</script>`;
  return html.replace(/<\/body>/i, js + '\n$&');
}
// StillCraft team roster: text-only monogram cards (Option A). No photos required;
// bios are the exact client-provided copy below. Editable via /insider → Team.
const TEAM = [
  { name: 'John Mesh', role: 'OPERATIONS MANAGER   ·   5 Years OF EXPERIENCE', img: 'team-john-mesh.svg',
    bio: 'The Operations Manager is the reason a plan on paper survives contact with a real venue. Every vendor booking, every staffing schedule, every piece of equipment that needs to be in the right place at the right time runs through this role. When an activation looks effortless on the day, it is because the operations work behind it was anything but, hundreds of small details resolved before anyone outside the team ever notices there was a decision to make.' },
  { name: 'Diana', role: 'MARKETING MANAGER   ·   3 Years OF EXPERIENCE', img: 'team-diana.svg',
    bio: "The Marketing Manager keeps StillCraft's own story as sharp as the stories we build for clients. This role shapes how the agency shows up, on the website, in pitches, across every touchpoint a prospective client sees before they ever speak to us, and makes sure the positioning we promise clients is the same one we practice ourselves." },
  { name: 'Miriam', role: 'HUMAN RESOURCE   ·   7 Years OF EXPERIENCE', img: 'team-miriam.svg',
    bio: 'Delivering eight years of consistent, high pressure work on the ground depends entirely on the people doing it, and building and keeping that team is the job of Human Resource. This role manages everything from hiring the right people for a fast moving, client facing industry to making sure the team running a launch day at six in the morning is supported well enough to do it again next week.' },
  { name: 'Robin Halmi', role: 'CHIEF DIGITAL MEDIA   ·   2 Years OF EXPERIENCE', img: 'team-robin-halmi.svg',
    bio: 'The Chief Digital Media role owns how StillCraft and its clients show up everywhere a screen is involved, social content, digital campaigns, and the growing hybrid and virtual layer of corporate and brand events. As more of a brand\'s audience is met online before they are ever met in person, this role makes sure the digital experience carries the same energy and consistency as the physical one.' },
  { name: 'Chris', role: 'CREATIVE DIRECTOR   ·   6 Years OF EXPERIENCE', img: 'team-chris.svg',
    bio: "The Creative Director is where a client's objective becomes an actual idea, the concept behind a mall's Christmas season, the format of a brand's next activation, the visual identity of a corporate environment. This role protects the thinking that makes StillCraft's work distinct, making sure every programme starts from a real creative idea rather than a template pulled off a shelf." },
  { name: 'John Njogu', role: 'FINANCE OFFICER   ·   4 Years OF EXPERIENCE', img: 'team-john-njogu.svg',
    bio: 'The Finance Officer keeps every engagement accountable in the way StillCraft promises clients it will be, transparent budgets, accurate reporting, and the financial discipline that lets an eight year old consultancy still operate like one that plans for its next eight. This role is also what makes a long term partnership like the one with Galleria Mall sustainable on both sides, not just deliverable once.' },
];
// Encode a value the way the CMS flight payload does (single-backslash plane).
function flightEnc(s) {
  return s.split('\\').join('\\\\').split('"').join('\\"')
    .split('<').join('\\u003c').split('>').join('\\u003e').split('&').join('\\u0026')
    .split('\r').join('\\r').split('\n').join('\\n');
}
function teamMember(p) {
  const src = '/assets/custom/' + p.img;
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
function replaceMembersArray(html) {
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
    if (!innerText.includes('Alise Grota')) { idx = html.indexOf(key, k); continue; }
    if (process.env.SC_KEEPARR) {
      return replaceTeamGrid(html);
    }
    let fresh = TEAM.map(teamMember).join(',');
    // Length-framed flight rows: keep exact byte length so the stream parser
    // stays aligned. Pad with trailing spaces inside the last bio (invisible).
    const oldLen = Buffer.byteLength(innerText, 'utf8');
    const newLen = Buffer.byteLength(fresh, 'utf8');
    if (process.env.SC_TEAMDBG) console.log('[team] oldLen=' + oldLen + ' newLen=' + newLen);
    if (fresh && newLen < oldLen) {
      const at = fresh.lastIndexOf('\\u003c/p\\u003e');
      if (at >= 0) fresh = fresh.slice(0, at) + ' '.repeat(oldLen - newLen) + fresh.slice(at);
    }
    if (fresh && Buffer.byteLength(fresh, 'utf8') !== oldLen) return html; // never ship a misframed stream
    html = html.slice(0, idx + key.length) + fresh + html.slice(k);
    idx = html.indexOf(key, idx + key.length + fresh.length);
  }
  return html;
}
export function applyTeamRoster(html) {
  if (process.env.SC_NOTEAM) return html;
  if (!html.includes('Alise Grota')) return html;
  html = replaceMembersArray(html);
  if (!process.env.SC_NOGRID) html = replaceTeamGrid(html);
  return html;
}

const TEAM_CSS = '<style>.sc-team-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.8rem;padding:2rem 0}.sc-team-card{background:#F5F1EC;border-radius:14px;padding:20px;border-top:4px solid #C9A24B}.sc-team-mono{width:42px;height:42px;border-radius:50%;background:#1B2A4A;color:#fff;display:grid;place-items:center;font:700 13px Inter,Arial,sans-serif;letter-spacing:.04em;margin-bottom:12px}.sc-team-card h3{font-size:16px;color:#1B2A4A;margin:0 0 4px;font-family:Georgia,serif}.sc-team-role{color:#C9A24B;font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin:0 0 10px}.sc-team-bio{font-size:13px;line-height:1.6;color:#000000;margin:0}@media(max-width:900px){.sc-team-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.sc-team-grid{grid-template-columns:1fr}}</style>';
function monoOf(name) { return String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || 'SC'; }
function teamCard(p, n) {
  const t = (k) => 't-team' + (n * 3 + k);
  return `<div class="sc-team-card"><div class="sc-team-mono">${monoOf(p.name)}</div><h3 data-sc-id="${t(1)}">${p.name}</h3><p data-sc-id="${t(2)}" class="sc-team-role">${p.role}</p><p data-sc-id="${t(3)}" class="sc-team-bio">${p.bio}</p></div>`;
}
function replaceTeamGrid(html) {
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
  const cards = TEAM.map((p, n) => teamCard(p, n)).join('');
  return html.slice(0, openEnd + 1) + TEAM_CSS + '<div class="sc-team-grid">' + cards + '</div>' + html.slice(end);
}
export function applySplash(html, page) {  if (page === '/insider') return html;
  if (!/<body[^>]*>/i.test(html)) return html;
  const css = `<style>#sc-splash{position:fixed;inset:0;background:#1B2A4A;z-index:2147483640;display:flex;align-items:center;justify-content:center;transition:opacity .45s ease}#sc-splash span{color:#C9A24B;font:600 13px Arial,sans-serif;letter-spacing:4px;animation:sc-pulse 1.2s ease-in-out infinite}@keyframes sc-pulse{50%{opacity:.35}}</style>`;
  const div = `<div id="sc-splash"><span>STILLCRAFT EVENTS</span></div>`;
  const js = `<script>(function(){var kill=function(){var s=document.getElementById('sc-splash');if(!s||s.dataset.done)return;s.dataset.done='1';s.style.opacity='0';setTimeout(function(){s.remove();},500);};window.addEventListener('load',function(){setTimeout(kill,350);});setTimeout(kill,4000);})();</script><noscript><style>#sc-splash{display:none}</style></noscript>`;
  html = html.replace(/<\/head>/i, css + '\n$&');
  html = html.replace(/<body[^>]*>/i, (m) => m + '\n' + div + '\n' + js);
  return html;
}
