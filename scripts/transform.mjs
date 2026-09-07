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
  ['Copyright © Iventions', 'Copyright © StillCraft Events Co.'],
  // CMS accent fields (unique tokens; prose never contains raw hex codes)
  ['#546162', '#1B2A4A'],
  ['#ddd9ff', '#C9A24B'],
  ['#608ff3', '#C9A24B'],
  ['"#f7ffdc"', '"#F5F1EC"'],
];
// Footer office details: static markup uses footer-only div classes, flight
// uses addressLine/city keys, so neither form collides with project locations.
const FOOTER_DIV = 'div class="Paragraph_paragraph__SId_Y css-cgpd9q"';
const FOOTER_STATIC = [
  [`<${FOOTER_DIV}>Barcelona, Spain</div>`, `<${FOOTER_DIV}>Nairobi, Kenya</div>`],
  [`<${FOOTER_DIV}>19 Eastbourne Terrace,</div>`, `<${FOOTER_DIV}>info@stillcraftevents.co.ke</div>`],
  [`<${FOOTER_DIV}>London W2 6LG.</div>`, `<${FOOTER_DIV}>+254 755 959 236</div>`],
  [`<${FOOTER_DIV}>United Kingdom</div>`, `<${FOOTER_DIV}>Kenya</div>`],
];
const FOOTER_FLIGHT = [
  [`"city":"Barcelona"`, `"city":"Nairobi"`],
  [`"city":"London"`, `"city":"Contact"`],
  [`"addressLine3":"Barcelona, Spain"`, `"addressLine3":"Nairobi, Kenya"`],
  [`"addressLine1":"19 Eastbourne Terrace,"`, `"addressLine1":"info@stillcraftevents.co.ke"`],
  [`"addressLine2":"London W2 6LG."`, `"addressLine2":"+254 755 959 236"`],
  [`"addressLine3":"United Kingdom"`, `"addressLine3":"Kenya"`],
  [`|Barcelona, Spain|`, `|Nairobi, Kenya|`],
];
function applyFooterAddresses(html) {
  for (const [from, to] of FOOTER_STATIC) {
    if (html.includes(from)) html = html.split(from).join(to);
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
function applyGlobalSwaps(html, page) {
  if (process.env.SC_NOSWAPS) return html;
  // Legal pages have no below-root error boundary and carry length-framed
  // text blobs: any blob byte change fatals them, so their blobs stay frozen.
  const frozen = page === '/cookie-policy' || page === '/privacy-policy' || page === '/legal-notice-terms-of-use';
  if (frozen) return html;
  for (const [from, to] of GLOBAL_SWAPS) {
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
    html = html.split('upload/icon-logo.svg').join(logo.replace(/^\//, ''));
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
  applyGlobalSwaps, applyFooterAddresses, parseUpload, sniffImage, FILE_FLIGHT,
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
export function applySplash(html, page) {
  if (page === '/insider') return html;
  if (!/<body[^>]*>/i.test(html)) return html;
  const css = `<style>#sc-splash{position:fixed;inset:0;background:#111110;z-index:2147483640;display:flex;align-items:center;justify-content:center;transition:opacity .45s ease}#sc-splash span{color:#e0ff98;font:600 13px Arial,sans-serif;letter-spacing:4px;animation:sc-pulse 1.2s ease-in-out infinite}@keyframes sc-pulse{50%{opacity:.35}}</style>`;
  const div = `<div id="sc-splash"><span>STILLCRAFT EVENTS</span></div>`;
  const js = `<script>(function(){var kill=function(){var s=document.getElementById('sc-splash');if(!s||s.dataset.done)return;s.dataset.done='1';s.style.opacity='0';setTimeout(function(){s.remove();},500);};window.addEventListener('load',function(){setTimeout(kill,350);});setTimeout(kill,4000);})();</script><noscript><style>#sc-splash{display:none}</style></noscript>`;
  html = html.replace(/<\/head>/i, css + '\n$&');
  html = html.replace(/<body[^>]*>/i, (m) => m + '\n' + div + '\n' + js);
  return html;
}
