// Removes the template agency's copy that was still in the served pages
// (client report "Iventions Content Still On The Website", 2 November 2026).
//
// Most of it was not visible after the page loaded: it sat in the HTML that
// is sent before React takes over (and that search engines, link previews and
// text-only checks read), in meta tags, or in the page data. Each fix below
// rewrites the static markup AND the flight payload, so the first paint, the
// hydrated page and the page source all agree.
//
// Runs late in api/page.js (after the built-in fixes and the saved Insider
// text), and every flight edit is verified: if a swap would leave the payload
// worse than before, that swap is dropped and the page keeps rendering.
import { safeReplace, verifyFlight } from './flight.mjs';
import { swapText } from './cms.mjs';
import CASES from './stillcraft-cases.mjs';

export const SHARE_IMAGE = '/assets/root/stillcraft-share.jpg';

const SCRIPT_BLOCK = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const BS = '\\';
const FQ = BS + '"';

function flightBad(html) {
  try { return verifyFlight(html).bad; } catch { return 0; }
}
// Apply `fn`; keep the result only if the flight payload is no worse.
function guarded(html, fn) {
  const before = flightBad(html);
  let out;
  try { out = fn(html); } catch { return html; }
  if (out === html) return html;
  return flightBad(out) > before ? html : out;
}
// Map over the HTML outside <script> blocks only.
function outsideScripts(html, fn) {
  SCRIPT_BLOCK.lastIndex = 0;
  let out = '', last = 0, m;
  while ((m = SCRIPT_BLOCK.exec(html))) {
    out += fn(html.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + fn(html.slice(last));
}
// A plain-text phrase everywhere it appears: static text (raw and &amp;
// spellings) and the flight payload (row-safe and decoded forms).
function copy(html, from, to) {
  return guarded(html, (h) => {
    h = swapText(h, from, to);
    const ef = escHtml(from), et = escHtml(to);
    if (ef !== from) h = outsideScripts(h, (s) => s.split(ef).join(et));
    return h;
  });
}
// A JSON fragment as it sits inside the flight payload. The payload is a JS
// string holding JSON, so every JSON backslash is doubled and every quote is
// \" ; React's encoder also writes & as the JS escape &.
function toRaw(json, amp) {
  let r = json.split(BS).join(BS + BS).split('"').join(FQ);
  if (amp) r = r.split('&').join(BS + 'u0026');
  return r;
}
function flightJson(html, from, to) {
  return guarded(html, (h) => {
    h = safeReplace(h, toRaw(from, false), toRaw(to, false));
    if (from.includes('&')) h = safeReplace(h, toRaw(from, true), toRaw(to, true));
    return h;
  });
}

// ---------------------------------------------------------------- site-wide
// Order matters: the longer legal sentence goes before the bare address.
const SITE_COPY = [
  ['the property of StillCraft Events International Events, with its registered address at Piedmont, 671 Ngong Road in Nairobi, Kenya',
    'the property of StillCraft Events Co., with its registered address at 671 Ngong Road, Nairobi, Kenya'],
  ['at Piedmont, 671 Ngong Road in Nairobi, Kenya', 'at 671 Ngong Road, Nairobi, Kenya'],
  // Where the city already follows, drop only "Piedmont, " (no doubled city).
  ['Piedmont, 671 Ngong Road, Nairobi, Kenya', '671 Ngong Road, Nairobi, Kenya'],
  ['Piedmont, 671 Ngong Road|Nairobi, Kenya', '671 Ngong Road, Nairobi, Kenya'],
  ['Piedmont, 671 Ngong Road', '671 Ngong Road, Nairobi, Kenya'],
  ['StillCraft Events International Events', 'StillCraft Events Co.'],
  ['StillCraft Events Events Co..', 'StillCraft Events Co.'],
  ['Complying with Spanish laws and the website’s terms of use', 'Complying with the laws of Kenya and the website’s terms of use'],
  ["Complying with Spanish laws and the website's terms of use", "Complying with the laws of Kenya and the website's terms of use"],
  // Contact band above the footer (contact + service pages).
  ['Your vision deserves a partner who listens, challenges and elevates.', 'Tell us what you’re planning, for a mall, a brand or your own team.'],
  ['Bold ideas, flawless execution, unforgettable impact.', 'One team plans it and stays to deliver it.'],
];
// Address written as one line in the footer key / contact block.
const ADDRESS_FIX = [
  ['671 Ngong Road, Nairobi, Kenya|Nairobi, Kenya', '671 Ngong Road, Nairobi, Kenya'],
  ['671 Ngong Road, Nairobi, Kenya, Nairobi, Kenya', '671 Ngong Road, Nairobi, Kenya'],
  ['671 Ngong Road, Nairobi, Kenya in Nairobi, Kenya', '671 Ngong Road, Nairobi, Kenya'],
];

// Paragraphs the template ships pre-split into one <p> per line (the contact
// band): a phrase that spans lines is invisible to a plain replace. Join each
// run of consecutive lines, apply the site copy, and pour the words back over
// the same number of lines (same markup, same layout).
const SPLIT_P = /<p data-sc-id="t-(\d+)" class="(css-se0az3)">([^<]*)<\/p>/g;
function rewriteSplitParagraphs(html) {
  return outsideScripts(html, (s) => {
    const lines = [...s.matchAll(SPLIT_P)].map((m) => ({ id: +m[1], cls: m[2], text: m[3], at: m.index, len: m[0].length }));
    const runs = [];
    for (const l of lines) {
      const last = runs[runs.length - 1];
      if (last && l.id === last[last.length - 1].id + 1) last.push(l); else runs.push([l]);
    }
    // A line that does not end in a space ends its sentence block (a hard
    // break or a new paragraph); words only flow within a block.
    const blocks = [];
    for (const run of runs) {
      let cur = [];
      for (const l of run) { cur.push(l); if (!/\s$/.test(l.text)) { blocks.push(cur); cur = []; } }
      if (cur.length) blocks.push(cur);
    }
    const edits = [];
    for (const run of blocks) {
      const joined = run.map((l) => l.text).join('');
      let next = joined;
      for (const [f, t] of [...SITE_COPY, ...ADDRESS_FIX]) next = next.split(escHtml(f)).join(escHtml(t)).split(f).join(t);
      if (next === joined) continue;
      // Same line count; each line takes about as many characters as before.
      const words = next.trim().split(/\s+/);
      const budget = run.map((l) => Math.max(1, l.text.length));
      let w = 0;
      run.forEach((l, i) => {
        const out = [];
        let used = 0;
        while (w < words.length && (i === run.length - 1 || !out.length || used + words[w].length + 1 <= budget[i])) {
          used += words[w].length + 1; out.push(words[w++]);
        }
        // Keep each line's trailing space exactly as the original line had it.
        edits.push([l, out.join(' ') + (/\s$/.test(l.text) && out.length ? ' ' : '')]);
      });
    }
    for (const [l, text] of edits.sort((a, b) => b[0].at - a[0].at)) {
      s = s.slice(0, l.at) + '<p data-sc-id="t-' + l.id + '" class="' + l.cls + '">' + text + '</p>' + s.slice(l.at + l.len);
    }
    return s;
  });
}

// ------------------------------------------------------------------- pages
const PAGE_COPY = {
  '/about': [
    ['Global Event Agency', 'Nairobi Event Agency'],
  ],
  '/projects': [
    ["Explore our event case studies and discover how we've delivered exhibitions, congresses, corporate and sports events for global brands.",
      'Explore StillCraft case studies: mall programmes, seasonal campaigns and brand activations delivered across Nairobi.'],
    ['Immersive dimentions.', 'Immersive dimensions.'],
  ],
};

// Project filters (/projects): template categories -> StillCraft services.
// Every category lists the same 11 mall programmes.
const CATEGORIES = [
  ['congresses', 'Congresses', 10, 'Mall Space Monetization'],
  ['events', 'Events', 11, 'Brand Activations'],
  ['exhibits', 'Exhibits', 32, 'Mall Calendar Programming'],
  ['sports', 'Sports', 20, 'Seasonal Campaigns'],
];
const CASE_COUNT = CASES.length;

// "Not just events" capability list on /projects: the template agency's
// conference/exhibition catalogue, rewritten for StillCraft. Same groups and
// the same number of items per group, so the layout is unchanged.
const CATALOGUE = [
  ['Branding', 'Brand & Campaign', [
    ['Brand strategy & messaging', 'Campaign ideas for every season'],
    ['Logo design & variations', 'Brand partner matchmaking'],
    ['Visual identity (print & digital applications)', 'Campaign look and feel, print and digital'],
    ['Creation of brand guidelines', 'Mall signage and wayfinding'],
    ['Event identity & key visuals', 'Branded photo moments'],
    ['Visual storytelling', 'Social-first campaign assets'],
    ['Signage systems & branded environments', 'Sponsor integration'],
    ['Branded scenography', 'Retail tie-ins and promotions'],
    ['Venue transformation', 'Post-campaign reporting'],
  ]],
  ['Complex Logistics', 'Planning & Logistics', [
    ['Venue scouting & contracting', 'Year-ahead calendar planning'],
    ['Supplier sourcing & onboarding', 'Mall approvals and permits'],
    ['Operational planning', 'Vendor sourcing and onboarding'],
    ['Time & budget management', 'Budget and timeline management'],
    ['Travel & hospitality arrangements (DMC)', 'Staffing and brand ambassadors'],
    ['Double-deck expertise', 'Footfall and queue planning'],
    ['Guest flow planning', 'Safety and security planning'],
    ['Staffing', 'Overnight setups'],
    ['Onsite coordination', 'Onsite coordination'],
    ['Waste management & local sourcing', 'Teardown and handover'],
  ]],
  ['Concept & Design', 'Concept & Design', [
    ['Insight & research', 'Shopper and footfall insight'],
    ['Overall conceptualisation', 'Programme concepts'],
    ['Creative direction & concept development', 'Creative direction'],
    ['Guest journey design & experience mapping', 'Family and visitor journeys'],
    ['Inspirational mood boards', 'Mood boards'],
    ['Space layout & decoration', 'Atrium and concourse layouts'],
    ['Scenography & staging', 'Décor and installations'],
    ['Custom & temporary structures', 'Pop-up structures'],
    ['Floor plans & technical drawings', 'Floor plans'],
    ['High-resolution 3D renders', '3D visuals'],
  ]],
  ['Technical Production', 'Production', [
    ['Technical direction', 'Sound and lighting'],
    ['Electrical planning', 'Power planning'],
    ['AV & lighting/sound systems', 'Screens and live viewing setups'],
    ['Rigging', 'Atrium performance areas'],
    ['Integration & testing', 'Testing and rehearsals'],
    ['Demo area integration', 'Product demo areas'],
    ['Crew coordination', 'Crew coordination'],
    ['Show calling', 'Running the day'],
  ]],
  ['Hybrid & Digital Content', 'Content & Media', [
    ['Messaging frameworks', 'Campaign copy and announcements'],
    ['Campaign assets', 'Campaign assets'],
    ['Social content creation', 'Social content creation'],
    ['Speaker sourcing & management', 'Influencer and creator partnerships'],
    ['Talk format design', 'Radio and media partnerships'],
    ['Scriptwriting & content coaching', 'MC scripts'],
    ['Hybrid formats & engagement platforms', 'Competitions and giveaways'],
    ['On-screen & LED messaging', 'On-screen and LED content'],
    ['Onsite video & photography capture', 'Photography and video on the day'],
  ]],
  ['Guest Experience & Activations', 'Visitor Experience & Activations', [
    ['VIP management', "Kids' zones and family activities"],
    ['Personalised welcome & concierge', 'Meet-and-greets'],
    ['Hospitality services', 'Hosts and MCs'],
    ['Gifts & high-end touchpoints', 'Living statue performances'],
    ['Reception & hosting', 'Live performances'],
    ['Security protocols', 'Visitor safety and first aid'],
    ['Accreditation  systems', 'Guest feedback capture'],
    ['Multilingual staffing', 'Workshops and classes'],
    ['Brand activations', 'Brand activations'],
    ['Gamification', 'Games and challenges'],
    ['Product demos', 'Product sampling and demos'],
    ['Interactive installations', 'Interactive installations'],
    ['Photo moments & opportunities', 'Photo moments'],
    ['Live shows & performances', 'Seasonal characters'],
    ['Sport activations & fan engagement', 'Watch parties and live screenings'],
    ['Digital fan engagement', 'Fan engagement'],
    ['Fan village production', 'Giveaways and gifting'],
  ]],
  ['Construction', 'Build & Fit-out', [
    ['Certification & permits', 'Permits and mall approvals'],
    ['Material sourcing', 'Material sourcing'],
    ['Sustainability integration & eco-design', 'Reusable, low-waste builds'],
    ['Custom production & rental solutions', 'Custom builds and rentals'],
    ['Temporary installations', 'Temporary installations'],
    ['Modular systems', 'Pop-up kiosks and stands'],
    ['Scenic construction & carpentry', 'Carpentry and set pieces'],
    ['Decorative elements & props', 'Décor and props'],
    ['Custom or rental furniture', 'Furniture hire'],
    ['Tailor-made elements', 'Made-to-measure elements'],
    ['High-quality finishes', 'Finishes and branding'],
    ['Fire regulation management', 'Fire and safety compliance'],
  ]],
];

function applyCatalogue(html) {
  if (!html.includes('styles_content_profession')) return html;
  for (const [oldName, newName, items] of CATALOGUE) {
    const oldDetail = items.map((i) => i[0]).join('\r\n');
    const newDetail = items.map((i) => i[1]).join('\r\n');
    // Flight: name + detail travel together in one object.
    html = flightJson(html,
      '"name":"' + jsonInner(oldName) + '","detail":"' + jsonInner(oldDetail) + '"',
      '"name":"' + jsonInner(newName) + '","detail":"' + jsonInner(newDetail) + '"');
    // Static: tab headings + the <br>-joined list.
    html = outsideScripts(html, (s) => s
      .split('>' + escHtml(oldName) + '</h6>').join('>' + escHtml(newName) + '</h6>')
      .split('alt="' + escHtml(oldName) + '"').join('alt="' + escHtml(newName) + '"')
      .split(items.map((i) => escHtml(i[0])).join('<br class="css-0">')).join(items.map((i) => escHtml(i[1])).join('<br class="css-0">')));
  }
  // Static split-line copy of the open tab (one line per masked row; long
  // items wrap over two rows). Walk the rows and swap each item in place.
  html = outsideScripts(html, (s) => rewriteSplitItems(s));
  return html;
}
// Inner JSON string text for a plain value (as it sits inside "...").
function jsonInner(s) { return JSON.stringify(String(s)).slice(1, -1); }

// Each row is one masked line; the last row of an item ends with a <br>.
const ROW = /(<div class="Paragraph_paragraph__SId_Y styles_content_profession_right_paragraph__aTJF_ [^"]*">)([^<]*)((?:<br class="css-0">)?<\/div>)/g;
function rewriteSplitItems(s) {
  if (!s.includes('styles_content_profession_right_paragraph')) return s;
  const map = new Map();
  for (const [, , items] of CATALOGUE) for (const [o, n] of items) map.set(o.replace(/\s+/g, ' ').trim(), n);
  const rows = [];
  let m;
  ROW.lastIndex = 0;
  while ((m = ROW.exec(s))) rows.push({ at: m.index, len: m[0].length, open: m[1], text: m[2], close: m[3] });
  const decode = (t) => t.replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const edits = [];
  for (let i = 0; i < rows.length; i++) {
    // An item fills one row, or two when it wraps.
    for (const span of [1, 2]) {
      const parts = rows.slice(i, i + span);
      if (parts.length < span) break;
      const key = decode(parts.map((r) => r.text).join(' '));
      if (!map.has(key)) continue;
      edits.push([parts[0], escHtml(map.get(key))]);
      for (const extra of parts.slice(1)) edits.push([extra, '']);
      i += span - 1;
      break;
    }
  }
  for (const [r, text] of edits.sort((a, b) => b[0].at - a[0].at)) {
    s = s.slice(0, r.at) + r.open + text + r.close + s.slice(r.at + r.len);
  }
  return s;
}

function applyCategories(html) {
  for (const [slug, oldName, oldCount, newName] of CATEGORIES) {
    html = flightJson(html,
      '"slug":"' + slug + '","name":"' + oldName + '","count":' + oldCount,
      '"slug":"' + slug + '","name":"' + newName + '","count":' + CASE_COUNT);
    // Static filter list: label + count inside the category link.
    html = outsideScripts(html, (s) => s.replace(
      new RegExp('(<a href="/projects/' + slug + '"[^>]*>)([\\s\\S]*?)(</a>)', 'g'),
      (all, a, inner, c) => a + inner
        .replace(/(>)(Sports|Congresses|Events|Exhibits)(<)/g, (x, p, w, q) => p + escHtml(newName) + q)
        .replace(new RegExp('(>)' + oldCount + '(<)', 'g'), '$1' + CASE_COUNT + '$2') + c));
  }
  return html;
}

// "Live Event" was the template's event-type label. StillCraft's own case
// data calls these programmes "Brand Activation". Exact labels only, so
// "Live Event Viewing" (a real StillCraft service) is untouched.
function applyEventType(html) {
  html = flightJson(html, '"name":"Live Event"}', '"name":"Brand Activation"}');
  html = outsideScripts(html, (s) => s.replace(/>Live Event</g, '>Brand Activation<'));
  return html;
}

// Static project cards (/projects list, before hydration): category, type
// and location still read Sports / Live Event / Athens, Budapest, Frankfurt.
// Rewrite each card from the case its link points to.
const BY_SLUG = new Map(CASES.map((c) => [c.slug, c]));
const BY_TITLE = new Map(CASES.map((c) => [c.title, c]));
function applyProjectCards(html) {
  return outsideScripts(html, (s) => s.replace(
    /(<a [^>]*href="\/project\/([a-z0-9-]+)"[^>]*>)([\s\S]*?)(<\/a>)/g,
    (all, open, slug, inner, close) => {
      const c = BY_SLUG.get(slug);
      if (!c || !inner.includes('css-sts5z9')) return all;
      let k = 0;
      const vals = ['Retail &amp; Malls', escHtml(c.eventType), escHtml(c.location)];
      inner = inner.replace(/(<p [^>]*class="Paragraph_paragraph__SId_Y css-sts5z9"[^>]*>)([^<]*)(<\/p>)/g,
        (x, a, t, b) => (k < vals.length ? a + vals[k++] + b : x));
      inner = inner.replace(/(<p [^>]*class="Paragraph_paragraph__SId_Y css-ye2k4l"[^>]*>)([^<]*)(<\/p>)/, (x, a, t, b) => a + escHtml(c.title) + b);
      return open + inner + close;
    }));
}

// Static <img> whose alt names one project but whose file is another
// project's cover (thumbnail strips before hydration): point the file at
// the project the alt names.
function applyCaseImageAlts(html) {
  return outsideScripts(html, (s) => s.replace(/<img\b[^>]*>/g, (tag) => {
    const alt = (/\balt="([^"]*)"/.exec(tag) || [])[1];
    if (!alt || !tag.includes('mall-case/')) return tag;
    const c = BY_TITLE.get(alt.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&'));
    if (!c) return tag;
    return tag.replace(/mall-case\/([a-z0-9-]+)\//g, (x, slug) => (BY_SLUG.has(slug) ? 'mall-case/' + c.slug + '/' : x));
  }));
}

// Home "Our Work" slider: the per-slide meta rows (participants / industry /
// event type / location) still listed the template's events (Udine,
// Istanbul, Frankfurt, "Nairobi, Spain"; Football, Pharmaceutical, Aviation;
// 11,195 / 62,000 ...). Values that are template copy are replaced with the
// matching StillCraft case; anything else (an Insider edit) is left alone.
const DONOR_PLACE = /Udine|Istanbul|Turkey|Frankfurt|Spain|Athens|Budapest|Madrid|Barcelona|Amsterdam|Berlin|Milan|Paris|London|Europe/i;
const DONOR_INDUSTRY = /^(Football|Pharmaceutical|Audio Equipment|Online Classifieds|Aviation|Sports|Automotive|Technology|Gaming)$/i;
const DONOR_FIGURES = new Set(['11,195', '62,000', '63,000', '73.8', '600', '120', '59,000']);
const fmtNum = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
function applyHomeMeta(html) {
  const re = /(<p data-sc-id="t-\d+" class="css-qg5m4o">)([^<]*)(<\/p><div class="css-h3wi0l">)([\s\S]*?)(<\/div><\/div>)/g;
  return outsideScripts(html, (s) => s.replace(re, (all, a, label, b, vals, c) => {
    const kind = label.trim().toLowerCase();
    let i = -1;
    vals = vals.replace(/(<span data-sc-id="t-\d+"[^>]*>)([^<]*)(<\/span>)/g, (x, o, v, cl) => {
      i++;
      const cs = CASES[i % CASES.length];
      let nv = null;
      if (/participant/.test(kind) && DONOR_FIGURES.has(v.trim())) nv = fmtNum(cs.participants);
      else if (/industr/.test(kind) && DONOR_INDUSTRY.test(v.trim())) nv = 'Retail &amp; Malls';
      else if (/location/.test(kind) && DONOR_PLACE.test(v)) nv = escHtml(cs.location);
      else if (/event type/.test(kind) && v.trim() === 'Live Event') nv = escHtml(cs.eventType);
      return nv == null ? x : o + nv + cl;
    });
    return a + label + b + vals + c;
  }));
}

// Social share image: every page's og:image / twitter:image that pointed at
// the Cloudinary "skillcraft" folder or at a template photo now uses the
// site's own image.
const SHARE_OLD = /https:\/\/res\.cloudinary\.com\/[^"\\]*\/skillcraft\/[^"\\]*\.jpg|\/assets\/cms\/wp-content\/uploads\/[^"\\]*\.(?:jpe?g|png|webp)/;
function applyShareImage(html, host) {
  // Link previews (WhatsApp, Facebook, LinkedIn) need an absolute URL.
  const h = String(host || '').replace(/[^a-z0-9.:-]/gi, '');
  const IMG = h ? (/^(localhost|127\.)/.test(h) ? 'http://' : 'https://') + h + SHARE_IMAGE : SHARE_IMAGE;
  const re = new RegExp('(<meta (?:property="og:image"|name="twitter:image") content=")(' + SHARE_OLD.source + ')(")', 'g');
  const olds = new Set();
  html = outsideScripts(html, (s) => s.replace(re, (x, a, url, c) => { olds.add(url); return a + IMG + c; }));
  for (const url of olds) {
    for (const prop of ['"property":"og:image","content":"', '"name":"twitter:image","content":"']) {
      html = flightJson(html, prop + url + '"', prop + IMG + '"');
    }
  }
  // The page's SEO record carries the same image in the data.
  const og = new RegExp(BS + BS + '"opengraphImage' + BS + BS + '":\\{' + BS + BS + '"sourceUrl' + BS + BS + '":' + BS + BS + '"(' + SHARE_OLD.source + ')' + BS + BS + '"', 'g');
  for (const m of new Set([...html.matchAll(og)].map((x) => x[1]))) {
    html = flightJson(html, '"opengraphImage":{"sourceUrl":"' + m + '"', '"opengraphImage":{"sourceUrl":"' + IMG + '"');
  }
  return html;
}

// /about hero block in the page data: the template's "Since 2010 / The
// global event agency behind powerful brand moments and events".
const ABOUT_HERO = [
  '"label":"Since 2010","description":"The global event \\r\\nagency behind powerful \\r\\nbrand moments and events\\r\\n\\r\\n"',
  '"label":"Since 2018","description":"Eight years of mall \\r\\nprogrammes, brand activations \\r\\nand corporate events\\r\\n\\r\\n"',
];

export function applyClientCleanup(html, page, host) {
  if (!html || page === '/insider') return html;
  for (const [f, t] of SITE_COPY) if (html.includes(f) || html.includes(escHtml(f))) html = copy(html, f, t);
  for (const [f, t] of ADDRESS_FIX) if (html.includes(f)) html = copy(html, f, t);
  html = rewriteSplitParagraphs(html);
  for (const [f, t] of PAGE_COPY[page] || []) html = copy(html, f, t);
  if (page === '/projects' || page.startsWith('/projects/')) {
    html = applyCatalogue(html);
    html = applyCategories(html);
    html = applyProjectCards(html);
  }
  if (page === '/' || page === '/home') html = applyHomeMeta(html);
  if (page === '/about') html = flightJson(html, ABOUT_HERO[0], ABOUT_HERO[1]);
  html = applyEventType(html);
  html = applyCaseImageAlts(html);
  html = applyShareImage(html, host);
  return html;
}
