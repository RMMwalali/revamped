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
  primary_color: '#1e1e1e',
  accent_color: '#e0ff98',
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
const NAV_DROP_HREFS = ['/about', '/service/congresses', '/service/sports'];
const TITLE_MAP = {
  '/': 'International Event Agency | Brand Activations, Malls &amp; Retail | StillCraft Events',
  '/home': 'International Event Agency | Brand Activations, Malls &amp; Retail | StillCraft Events',
  '/about': 'International Event Agency | Brand Activations, Malls &amp; Retail | StillCraft Events',
  '/service/events': 'Brand Activations | Brands and Corporates | StillCraft Events',
  '/service/exhibits': 'Malls &amp; Retail | Malls Programming and Retail | StillCraft Events',
  '/projects': 'Projects | Case Studies | StillCraft Events',
  '/contact': 'Contact | Start Your Project | StillCraft Events',
};

// StillCraft menu order: Home, Malls & Retail, Brand Activations, Projects, Contact.
const MENU_ORDER = [
  ['/', 'Home'],
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
  ['StillCraft Events International Events', 'StillCraft Events Co.'],
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
  ['19 Eastbourne Terrace,', 'info@stillcraftevents.co.ke'],
  ['London W2 6LG.', '+254 755 959 236'],
  ['United Kingdom', 'Kenya'],
];
const FOOTER_SVG_CLASS = 'Footer_footer_text__01STx';
const FOOTER_FLIGHT = [
  [`"city":"Barcelona"`, `"city":"Nairobi"`],
  [`"city":"London"`, `"city":"Contact"`],
  [`"addressLine3":"Barcelona, Spain"`, `"addressLine3":"Nairobi, Kenya"`],
  [`"addressLine1":"19 Eastbourne Terrace,"`, `"addressLine1":"info@stillcraftevents.co.ke"`],
  [`"addressLine2":"London W2 6LG."`, `"addressLine2":"+254 755 959 236"`],
  [`"addressLine3":"United Kingdom"`, `"addressLine3":"Kenya"`],
  [`|Barcelona, Spain|`, `|Nairobi, Kenya|`],
  [`19 Eastbourne Terrace,|London W2 6LG.|United Kingdom|+44 (0)7563 453 763`, `info@stillcraftevents.co.ke|+254 755 959 236|Kenya|+254 755 959 236`],
  [`"children":"Barcelona, Spain"`, `"children":"Nairobi, Kenya"`],
  [`"children":"19 Eastbourne Terrace,"`, `"children":"info@stillcraftevents.co.ke"`],
  [`"children":"London W2 6LG."`, `"children":"+254 755 959 236"`],
  [`"children":"United Kingdom"`, `"children":"Kenya"`],
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
  return safeReplacePairs(html, P);
}
const MENU_DROP_URLS = ['/about/', '/service/congresses/', '/service/sports/'];
const MENU_TITLES = { About: 'Home', Events: 'Brand Activations', Exhibits: 'Malls & Retail', Work: 'Projects' };
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
  ];
  // 1) drop About / Congresses / Sports link objects (object + trailing comma)
  for (const u of MENU_DROP_URLS) {
    const title = { '/about/': 'About', '/service/congresses/': 'Congresses', '/service/sports/': 'Sports' }[u];
    P.push([linkObj(title, ORIGIN + u) + ',', '']);
  }
  // 2) rename remaining titles (skip About: dropped above; Home stays)
  for (const [from, to] of Object.entries(MENU_TITLES)) {
    if (from === 'About') continue;
    P.push([`${EQ}title${EQ}:${EQ}${from}${EQ}`, `${EQ}title${EQ}:${EQ}${to}${EQ}`]);
  }
  // 3) prepend Home to header menus (footer already starts with Home)
  P.push([`${EQ}menus${EQ}:[${brandObj}`, `${EQ}menus${EQ}:[${homeObj},${brandObj}`]);
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
  if (typeEnd < 0 || typeEnd === hp || html.slice(typeEnd, typeEnd + headTail.length) !== headTail) { console.error('DBG bail fhead'); return html; }
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
function applyNav(html, page) {
  for (const [from, to] of NAV_LABELS) {
    html = html.replace(new RegExp(`>(\\s*)${from}(\\s*)<`, 'g'), `>$1${to}$2<`);
  }
  html = applyFlightIA(html);
  for (const href of NAV_DROP_HREFS) {
    const esc = href.replace(/\//g, '\\/');
    // header menu overlay: plain-text anchors
    html = html.replace(new RegExp(`<a\\b[^<>]*href="${esc}"[^<>]*>\\s*(?:About|Congresses|Sports)\\s*<\\/a>`, 'g'), '');
    // footer Explore: single-span anchors
    html = html.replace(new RegExp(`<a\\b[^<>]*href="${esc}"[^<>]*>\\s*<span\\b[^<>]*>\\s*(?:About|Congresses|Sports)\\s*<\\/span>\\s*<\\/a>`, 'g'), '');
  }
  // blog removed - strip from header and footer
  html = html.replace(/<a\b[^>]*href="\/insights"[^>]*>[\s\S]*?<\/a>/gi, '');
  html = html.replace(/<a\b[^>]*href="\/insights"[^>]*>\s*<span[^>]*>\s*Blog\s*<\/span>\s*<\/a>/gi, '');
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
const STALE_PROJECT_SLUGS = ['mothers-day-brunch-at-southfield-mall'];
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
  if (!html || html.indexOf('mothers-day-brunch') < 0) return html;
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
