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

// Page-scoped whole-value flight swaps (short labels patchFlight can't gate).
// Testimonial slider logos stay per-case for the edit bar (quotes name old clients).
const LOGO_FLIGHT = [...new Map(Object.values(LOGO_ROWS).flat()
  .filter(r => !/Testimonial/i.test(r.orig_html)).map(r => [r.orig_html, r.value])).entries()];
function applyContentFlight(html, page) {
  const pairs = FILE_FLIGHT[page];
  const parts = html.split('self.__next_f.push(');
  if (parts.length < 2) return html;
  for (let i = 1; i < parts.length; i++) {
    if (pairs) for (const [from, to] of pairs) {
      const forms = [from, from.split('&').join('&amp;'), from.split('&').join('\\u0026')];
      const tos = [to, to.split('&').join('&amp;'), to.split('&').join('\\u0026')];
      for (let k = 0; k < forms.length; k++) {
        parts[i] = parts[i].split(`"${forms[k]}"`).join(`"${tos[k]}"`);
        parts[i] = parts[i].split(`\\"${forms[k]}\\"`).join(`\\"${tos[k]}\\"`);
      }
    }
    // wall name labels, scoped by title+logo so duplicate names stay distinct.
    // Must run before the URL swap below (it keys on the old logo path).
    if (LOGO_NAMES[page]) for (const n of LOGO_NAMES[page]) {
      const needle = `\\"title\\":\\"${n.old}\\",\\"featuredImage\\":{\\"node\\":{\\"sourceUrl\\":\\"${n.src}`;
      const repl = `\\"title\\":\\"${n.name}\\",\\"featuredImage\\":{\\"node\\":{\\"sourceUrl\\":\\"${n.src}`;
      parts[i] = parts[i].split(needle).join(repl);
    }
    // client logo URLs on wall pages only (testimonial sliders stay per-case for the edit bar)
    if (LOGO_ROWS[page]) for (const [oldSrc, newSrc] of LOGO_FLIGHT) {
      parts[i] = parts[i].split(oldSrc).join(newSrc);
      parts[i] = parts[i].split(oldSrc.split('/').join('\\/')).join(newSrc.split('/').join('\\/'));
    }
  }
  return parts.join('self.__next_f.push(');
}

// ---------- brand cache (StillCraft defaults win when DB is down/empty) ----------
const BRAND_DEFAULTS = {
  site_name: 'StillCraft Events',
  tagline: 'Step into the Spotlight',
  logo_src: '',
  primary_color: '#1e1e1e',
  accent_color: '#e0ff98',
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
  ['Exhibits', 'Malls &amp; Retail'],
  ['Work', 'Projects'],
  ['Insights', 'Blog'],
];
const NAV_DROP_HREFS = ['/about', '/service/congresses', '/service/sports'];
const TITLE_MAP = {
  '/': 'International Event Agency | Brand Activations, Malls &amp; Retail | StillCraft Events',
  '/home': 'International Event Agency | Brand Activations, Malls &amp; Retail | StillCraft Events',
  '/about': 'International Event Agency | Brand Activations, Malls &amp; Retail | StillCraft Events',
  '/service/events': 'Brand Activations | Brands and Corporates | StillCraft Events',
  '/service/exhibits': 'Malls &amp; Retail | Malls Programming and Retail | StillCraft Events',
  '/insights': 'Blog | Event Insights &amp; Trends | StillCraft Events',
  '/projects/filter': 'Projects | Case Studies | StillCraft Events',
  '/projects': 'Projects | Case Studies | StillCraft Events',
  '/contact': 'Contact | Start Your Project | StillCraft Events',
};

// StillCraft menu order: Home, Malls & Retail, Brand Activations, Projects, Blog, Contact.
// Rebuilds the header menu <ul> in that order (Home reuses the emptied About slot).
const MENU_ORDER = [
  ['/', 'Home'],
  ['/service/exhibits', 'Malls &amp; Retail'],
  ['/service/events', 'Brand Activations'],
  ['/projects/filter', 'Projects'],
  ['/insights', 'Blog'],
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
  // Replace whole-string JSON values inside flight pushes only (app code untouched).
  const parts = html.split('self.__next_f.push(');
  if (parts.length < 2) return html;
  for (let i = 1; i < parts.length; i++) {
    parts[i] = parts[i].split(`"${fromJson}"`).join(`"${toJson}"`);
  }
  return parts.join('self.__next_f.push(');
}

// StillCraft IA inside flight vdom (CMS menu data React actually renders).
// Operates on flight pushes only; static markup is handled by NAV_LABELS/applyMenuOrder.
const EQ = '\\"'; // an escaped quote as it appears raw in flight HTML
// Global contact/social swaps: unique tokens, safe in static HTML and flight data.
const GLOBAL_SWAPS = [
  ['info@iventions.com', 'info@stillcraftevents.co.ke'],
  ['https://www.linkedin.com/company/iventions', 'https://www.facebook.com/people/StillCraft-Events-Co/100079965229476'],
  ['https://www.instagram.com/iventions_events', 'https://www.instagram.com/stillcraftevents'],
  ['https://www.instagram.com/iventions', 'https://www.instagram.com/stillcraftevents'],
  ['+34 933 028 640', '+254 792 234 337'],
  ['+44 (0)7563 453 763', '+254 755 959 236'],
  ['Av. Diagonal 433, 4-2', 'Piedmont, 671 Ngong Road'],
  ['StillCraft Events International Events', 'StillCraft Events Co.'],
  [/Copyright [©\uFFFD\xa9] Iventions/g, 'Copyright © StillCraft Events Co.'],
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
  const parts = html.split('self.__next_f.push(');
  if (parts.length > 1) {
    for (let i = 1; i < parts.length; i++) {
      for (const [from, to] of FOOTER_FLIGHT) {
        if (parts[i].includes(from)) parts[i] = parts[i].split(from).join(to);
        const fe = from.split('"').join('\\"');
        const te = to.split('"').join('\\"');
        if (fe !== from && parts[i].includes(fe)) parts[i] = parts[i].split(fe).join(te);
      }
    }
    html = parts.join('self.__next_f.push(');
  }
  return html;
}
// Home-page hero reel: point the flight's Vimeo URLs at a local asset so the
// WebGL video texture loads the StillCraft hero clip (works pre + post hydration).
const HERO_VIDEO = '/assets/custom/stillcraft-hero.mp4';
function applyHeroVideo(html) {
  for (const key of ['reelUrl', 'reelMobileUrl']) {
    const needle = key + '\\":\\"'; // raw flight: key":"...
    let cursor = 0;
    while (true) {
      const from = html.indexOf(needle, cursor);
      if (from < 0) break;
      const start = from + needle.length;
      const end = html.indexOf('\\"', start);
      if (end <= start) break;
      html = html.slice(0, start) + HERO_VIDEO + html.slice(end);
      cursor = start + HERO_VIDEO.length;
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
  for (const [from, to] of GLOBAL_SWAPS) {
    if (typeof from !== 'string') {
      html = html.replace(from, to);
      continue;
    }
    if (html.includes(from)) html = html.split(from).join(to);
    const slash = [from.split('/').join('\\/'), to.split('/').join('\\/')];
    if (slash[0] !== from && html.includes(slash[0])) html = html.split(slash[0]).join(slash[1]);
    const esc = [from.split('"').join('\\"'), to.split('"').join('\\"')];
    if (esc[0] !== from && html.includes(esc[0])) html = html.split(esc[0]).join(esc[1]);
  }
  return html;
}
const linkObj = (title, url) =>
  `{${EQ}link${EQ}:{${EQ}target${EQ}:${EQ}${EQ},${EQ}title${EQ}:${EQ}${title}${EQ},${EQ}url${EQ}:${EQ}${url}${EQ}}}`;
const ORIGIN = 'https://iventions.com';
const MENU_DROP_URLS = ['/about/', '/service/congresses/', '/service/sports/'];
const MENU_TITLES = { About: 'Home', Events: 'Brand Activations', Exhibits: 'Malls & Retail', Work: 'Projects', Insights: 'Blog' };
function applyFlightIA(html) {
  const parts = html.split('self.__next_f.push(');
  if (parts.length < 2) return html;
  const homeObj = linkObj('Home', ORIGIN + '/home/');
  for (let i = 1; i < parts.length; i++) {
    let s = parts[i];
    // 0) service entity titles drive the page headlines (menu keeps short labels).
    // Must run before the menu rename below (same original values).
    s = s.split(`"slug":"events","title":"Events"`).join(`"slug":"events","title":"Brands and Corporates"`);
    s = s.split(`\\"slug\\":\\"events\\",\\"title\\":\\"Events\\"`).join(`\\"slug\\":\\"events\\",\\"title\\":\\"Brands and Corporates\\"`);
    s = s.split(`"slug":"exhibits","title":"Exhibits"`).join(`"slug":"exhibits","title":"Malls Programming and Retail"`);
    s = s.split(`\\"slug\\":\\"exhibits\\",\\"title\\":\\"Exhibits\\"`).join(`\\"slug\\":\\"exhibits\\",\\"title\\":\\"Malls Programming and Retail\\"`);
    // 0) service entity titles drive the page headlines (menu keeps short labels).
    // Must run before the menu rename below (same original values).
    s = s.split(`"slug":"events","title":"Events"`).join(`"slug":"events","title":"Brands and Corporates"`);
    s = s.split(`\\"slug\\":\\"events\\",\\"title\\":\\"Events\\"`).join(`\\"slug\\":\\"events\\",\\"title\\":\\"Brands and Corporates\\"`);
    s = s.split(`"slug":"exhibits","title":"Exhibits"`).join(`"slug":"exhibits","title":"Malls Programming and Retail"`);
    s = s.split(`\\"slug\\":\\"exhibits\\",\\"title\\":\\"Exhibits\\"`).join(`\\"slug\\":\\"exhibits\\",\\"title\\":\\"Malls Programming and Retail\\"`);
    // 1) drop About / Congresses / Sports link objects (object + trailing comma)
    for (const u of MENU_DROP_URLS) {
      const title = { '/about/': 'About', '/service/congresses/': 'Congresses', '/service/sports/': 'Sports' }[u];
      s = s.split(linkObj(title, ORIGIN + u) + ',').join('');
    }
    // 2) rename remaining titles (skip About: dropped above; Home stays)
    for (const [from, to] of Object.entries(MENU_TITLES)) {
      if (from === 'About') continue;
      s = s.split(`${EQ}title${EQ}:${EQ}${from}${EQ}`).join(`${EQ}title${EQ}:${EQ}${to}${EQ}`);
    }
    // 3) prepend Home to header menus (footer already starts with Home)
    const brandObj = linkObj('Brand Activations', ORIGIN + '/service/events/');
    s = s.split(`${EQ}menus${EQ}:[${brandObj}`).join(`${EQ}menus${EQ}:[${homeObj},${brandObj}`);
    // 4) order Malls & Retail before Brand Activations
    const mallsObj = linkObj('Malls & Retail', ORIGIN + '/service/exhibits/');
    s = s.split(brandObj + ',' + mallsObj).join(mallsObj + ',' + brandObj);
    // 5) localize CMS link targets (LinkedIn/Instagram untouched)
    s = s.split(ORIGIN + '/').join('/');
    // 6) trailing brand mentions in values ("... | Iventions")
    s = s.split(` Iventions${EQ}`).join(` StillCraft Events${EQ}`);
    s = s.split(` IVENTIONS${EQ}`).join(` STILLCRAFT EVENTS${EQ}`);
    parts[i] = s;
  }
  return parts.join('self.__next_f.push(');
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
  return html;
}

function applyBrand(html, brand) {
  const name = (brand.site_name || '').trim();
  if (name && name !== 'Iventions') {
    const upper = name.toUpperCase();
    // 1) flight payloads: brand word at value starts/ends (code/URLs/slugs untouched)
    const segs = html.split('self.__next_f.push(');
    if (segs.length > 1) {
      for (let i = 1; i < segs.length; i++) {
        segs[i] = segs[i].split('"Iventions').join('"' + name).split('"IVENTIONS').join('"' + upper);
        segs[i] = segs[i].split(` Iventions${EQ}`).join(` ${name}${EQ}`);
      }
      html = segs.join('self.__next_f.push(');
    }
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
    html = html.split(DEFAULT_TAGLINE).join(tag);
  }
  const logo = (brand.logo_src || '').trim();
  if (logo) {
    const target = logo.replace(/^\//, '');
    // Existing copies: bare "upload/icon-logo.svg" (root + assets/root).
    html = html.split('upload/icon-logo.svg').join(target);
    // Header figure + preload refs use the CMS-upload path; swap it too.
    html = html.split('/assets/cms/wp-content/uploads/2025/06/icon-logo.svg').join('/' + target);
    // Escaped variant inside flight payloads (backslash-forward-slash).
    html = html.split('\\u002Fassets\\u002Fcms\\u002Fwp-content\\u002Fuploads\\u002F2025\\u002F06\\u002Ficon-logo\\u002Esvg').join('\\u002F' + target.split('/').join('\\u002F'));
    html = html.split('\\/assets\\/cms\\/wp-content\\/uploads\\/2025\\/06\\/icon-logo\\.svg').join('\\/' + target.split('/').join('\\/'));
    // Browser-tab icon: point rel=icon + apple-touch-icon links at the brand
    // favicon PNG (regenerated from the logo on disk) instead of the old ICO.
    html = html.split('/assets/root/favicon.ico').join('/assets/root/favicon.png');
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

// Admin media uploads: images + video + audio + web fonts + vector (svg).
// Magic-byte guard so a renamed .mp4/.png isn't stored under a fake extension.
function sniffMedia(data, filename) {
  const ext = (/\.(png|jpe?g|webp|gif|svg|avif|mp4|m4v|mov|webm|mp3|wav|ogg|m4a|wof2?|woff2|ttf|otf|pdf)$/i.exec(filename) || [])[1]?.toLowerCase();
  if (!ext) return null;
  const h = data.slice(0, 12).toString('latin1');
  const ftyp = (t) => h.length > 7 && h.slice(4, 8) === 'ftyp' && h.slice(8, 13).toLowerCase().includes(t);
  if (ext === 'png' && !h.startsWith('\x89PNG')) return null;
  if ((ext === 'jpg' || ext === 'jpeg') && !(data[0] === 0xff && data[1] === 0xd8)) return null;
  if (ext === 'gif' && !h.startsWith('GIF8')) return null;
  if (ext === 'webp' && !(h.startsWith('RIFF') && data.slice(8, 12).toString() === 'WEBP')) return null;
  if (ext === 'avif' && !(ftyp('avif') || ftyp('avis'))) return null;
  if (ext === 'svg' && !/<svg|<\?xml/i.test(data.slice(0, 800).toString('utf8'))) return null;
  if (ext === 'mp4') return h.slice(4, 8) === 'ftyp' ? 'mp4' : null;
  if (ext === 'm4v') return ftyp('mp4') || ftyp('m4v') ? 'm4v' : null;
  if (ext === 'mov') return ftyp('qt') || ftyp('mov') ? 'mov' : null;
  if (ext === 'webm') return h.startsWith('\x1a\x45\xdf\xa3') ? 'webm' : null;
  if (ext === 'mp3' && !h.startsWith('ID3') && !(data[0] === 0xff && (data[1] & 0xe0) === 0xe0)) return null;
  if (ext === 'wav' && !(h.startsWith('RIFF') && data.slice(8, 12).toString() === 'WAVE')) return null;
  if (ext === 'ogg' && !h.startsWith('OggS')) return null;
  if (ext === 'm4a' && !(ftyp('M4A') || ftyp('mp4'))) return null;
  if (ext === 'ttf' && h.slice(0, 4).toString() !== '\x00\x01\x00\x00') return null;
  if (ext === 'woff' && h.slice(0, 4).toString() !== 'wOFF') return null;
  if (ext === 'woff2' && h.slice(0, 4).toString() !== 'wOF2') return null;
  if (ext === 'otf' && h.slice(0, 4).toString() !== 'OTTO') return null;
  if (ext === 'pdf' && h.slice(0, 5) !== '%PDF-') return null;
  return ext === 'jpeg' ? 'jpg' : ext;
}

function sniffImage(data, filename) {
  const ext = (/\.(png|jpe?g|webp|gif|svg)$/i.exec(filename) || [])[1]?.toLowerCase();
  if (!ext) return null;
  const h = data.slice(0, 12).toString('latin1');
  if (ext === 'png' && !h.startsWith('\x89PNG')) return null;
  if ((ext === 'jpg' || ext === 'jpeg') && !(data[0] === 0xff && data[1] === 0xd8)) return null;
  if (ext === 'gif' && !h.startsWith('GIF8')) return null;
  if (ext === 'webp' && !(h.startsWith('RIFF') && data.slice(8, 12).toString() === 'WEBP')) return null;
  if (ext === 'svg' && !/<svg|<\?xml/i.test(data.slice(0, 500).toString('utf8'))) return null;
  return ext === 'jpeg' ? 'jpg' : ext;
}
export {
  getBrand, bustBrand, applyBrand, applyNav, applyMenuOrder, applyTheme,
  stripThirdParty, flightReplace, applyFlightIA, applyContentFlight,
  applyGlobalSwaps, applyFooterAddresses, applyHeroVideo, parseUpload, sniffImage, sniffMedia, FILE_FLIGHT,
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
// StillCraft team roster: swaps the CMS members array (flight) for 6 people.
// Guarded by an original-member marker so it only fires on the people array.
const TEAM = [
  { name: 'John Mesh', role: 'OPERATIONS MANAGER - 5 Years OF EXPERIENCE', img: 'team-john-mesh.svg',
    bio: 'The Operations Manager is the reason a plan on paper survives contact with a real venue. Every vendor booking, every staffing schedule, every piece of equipment that needs to be in the right place at the right time runs through this role. When an activation looks effortless on the day, it is because the operations work behind it was anything but, hundreds of small details resolved before anyone outside the team ever notices there was a decision to make.' },
  { name: 'Diana', role: 'MARKETING MANAGER - 3 Years OF EXPERIENCE', img: 'team-diana.svg',
    bio: "The Marketing Manager keeps StillCraft's own story as sharp as the stories we build for clients. This role shapes how the agency shows up, on the website, in pitches, across every touchpoint a prospective client sees before they ever speak to us, and makes sure the positioning we promise clients is the same one we practice ourselves." },
  { name: 'Miriam', role: 'HUMAN RESOURCE - 7 Years OF EXPERIENCE', img: 'team-miriam.svg',
    bio: 'Delivering eight years of consistent, high pressure work on the ground depends entirely on the people doing it, and building and keeping that team is the job of Human Resource. This role manages everything from hiring the right people for a fast moving, client facing industry to making sure the team running a launch day at six in the morning is supported well enough to do it again next week.' },
  { name: 'Robin Halmi', role: 'CHIEF DIGITAL MEDIA - 2 Years OF EXPERIENCE', img: 'team-robin-halmi.svg',
    bio: "The Chief Digital Media role owns how StillCraft and its clients show up everywhere a screen is involved, social content, digital campaigns, and the growing hybrid and virtual layer of corporate and brand events. As more of a brand's audience is met online before they are ever met in person, this role makes sure the digital experience carries the same energy and consistency as the physical one." },
  { name: 'Chris', role: 'CREATIVE DIRECTOR - 6 Years OF EXPERIENCE', img: 'team-chris.svg',
    bio: "The Creative Director is where a client's objective becomes an actual idea, the concept behind a mall's Christmas season, the format of a brand's next activation, the visual identity of a corporate environment. This role protects the thinking that makes StillCraft's work distinct, making sure every programme starts from a real creative idea rather than a template pulled off a shelf." },
  { name: 'John Njogu', role: 'FINANCE OFFICER - 4 Years OF EXPERIENCE', img: 'team-john-njogu.svg',
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

const TEAM_CSS = '<style>.sc-team-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2.4rem;padding:2rem 0}.sc-team-card{background:#F5F1EC;border-radius:1.6rem;overflow:hidden}.sc-team-card img{width:100%;height:auto;display:block;aspect-ratio:63/81;object-fit:cover}.sc-team-body{padding:2rem}.sc-team-body h3{font-size:2.4rem;color:#1B2A4A;margin:0 0 .6rem}.sc-team-role{color:#C9A24B;font-size:1.2rem;letter-spacing:.12em;margin:0 0 1.2rem}.sc-team-bio{font-size:1.5rem;line-height:1.6;color:#1B2A4A;margin:0}@media(max-width:800px){.sc-team-grid{grid-template-columns:1fr}}</style>';
function teamCard(p, n) {
  const t = (k) => 't-team' + (n * 3 + k);
  return `<div class="sc-team-card"><img data-sc-id="i-team${n + 1}" src="/assets/custom/${p.img}" alt="${p.name}" width="630" height="810" loading="lazy"><div class="sc-team-body"><h3 data-sc-id="${t(1)}">${p.name}</h3><p data-sc-id="${t(2)}" class="sc-team-role">${p.role}</p><p data-sc-id="${t(3)}" class="sc-team-bio">${p.bio}</p></div></div>`;
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
  const css = `<style>#sc-splash{position:fixed;inset:0;background:#111110;z-index:2147483640;display:flex;align-items:center;justify-content:center;transition:opacity .45s ease}#sc-splash span{color:#e0ff98;font:600 13px Arial,sans-serif;letter-spacing:4px;animation:sc-pulse 1.2s ease-in-out infinite}@keyframes sc-pulse{50%{opacity:.35}}</style>`;
  const div = `<div id="sc-splash"><span>STILLCRAFT EVENTS</span></div>`;
  const js = `<script>(function(){var kill=function(){var s=document.getElementById('sc-splash');if(!s||s.dataset.done)return;s.dataset.done='1';s.style.opacity='0';setTimeout(function(){s.remove();},500);};window.addEventListener('load',function(){setTimeout(kill,350);});setTimeout(kill,4000);})();</script><noscript><style>#sc-splash{display:none}</style></noscript>`;
  html = html.replace(/<\/head>/i, css + '\n$&');
  html = html.replace(/<body[^>]*>/i, (m) => m + '\n' + div + '\n' + js);
  return html;
}
