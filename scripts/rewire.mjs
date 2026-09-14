import fs from 'node:fs';
import CASES from './stillcraft-cases.mjs';

// ---------- helpers ----------
function decodeArg(arg) { return JSON.parse('"' + arg + '"'); }
function encodeArg(text) { return JSON.stringify(text).slice(1, -1); }

function balanced(text, startTag) {
  const open = text.indexOf(startTag);
  if (open < 0) return null;
  const arrStart = open + startTag.lastIndexOf('[');
  let depth = 0;
  for (let i = arrStart; i < text.length; i++) {
    if (text[i] === '[') depth++;
    else if (text[i] === ']') { depth--; if (depth === 0) return { open, close: i + 1 }; }
  }
  return null;
}

function replaceUnique(text, needle, repl, what) {
  const n = text.split(needle).length - 1;
  if (n !== 1) { console.error(`EXCEPTION: "${what}" occurrences=${n}, expected 1`); process.exit(1); }
  return text.split(needle).join(repl);
}

// ---------- node builders ----------
const ORIG_PHOTOS = [
  '/assets/cms/wp-content/uploads/2026/07/UEFA-Champions-League-Final-2026-1-scaled-1.webp',
  '/assets/cms/wp-content/uploads/2026/07/Euroleague-Final-Four-2026-12-scaled.jpg',
  '/assets/cms/wp-content/uploads/2025/08/Adevina-Ignite-2024-4-scaled.jpg',
  '/assets/cms/wp-content/uploads/2026/06/Midas-ISE-2026-1-scaled.jpg',
  '/assets/cms/wp-content/uploads/2025/07/Menzies-scaled.jpg',
];
const origPhoto = (i) => ORIG_PHOTOS[i] || ORIG_PHOTOS[0];
const listNode = (c) => ({
  databaseId: c.databaseId,
  slug: c.slug,
  title: c.title,
  content: `<p>${c.excerpt}</p>\n`,
  featuredImage: { node: { sourceUrl: `/assets/stillcraft/mall-case/${c.slug}/cover.svg` } },
  projectCategories: { edges: [{ node: { name: c.industry } }] },
  projectTemplate: { heroBlock: { industry: c.industry, location: c.location, participants: c.participants, eventType: { edges: [{ node: { name: c.eventType } }] } } },
});

// RSC edge wrapper — original payloads use {"node":{...}} per edge.
const listEdge = (c) => ({ node: listNode(c) });

const homeNode = (c, photo) => ({
  databaseId: c.databaseId,
  slug: c.slug,
  title: c.title,
  content: `\\u003cp\\u003e${c.excerpt}\\u003c/p\\u003e\n`,
  featuredImage: { node: { sourceUrl: photo } },
  projectCategories: { edges: [{ node: { name: c.industry } }] },
  projectTemplate: { heroBlock: { industry: c.industry, location: c.location, participants: c.participants, eventType: { edges: [{ node: { name: c.eventType } }] } } },
});

// ---------- /projects page ----------
function rewireProjects(file) {
  let g = fs.readFileSync(file, 'utf8');
  const before = g;

  // --- static rows (20 -> 12) ---
  const staticEnd = g.indexOf('self.__next_f.push(');
  const stat = g.slice(0, staticEnd);
  const rowRe = /<div class="ProjectListSection_project__76n_c css-avegm8"><a href="\/project\/[^"]+"[\s\S]*?<\/a><\/div>/g;
  const rows = [];
  let lastRowEnd = 0;
  let r;
  while ((r = rowRe.exec(stat))) { rows.push(r[0]); lastRowEnd = rowRe.lastIndex; }
  if (rows.length !== 20) { console.error(`projects: expected 20 static rows, got ${rows.length}`); process.exit(1); }
  const tpl = rows[0];
  const clsA = 'css-1x4ckkn';
  const clsB = 'css-1nwgk53';
  const esc = (s) => s.split('&').join('&amp;');
  const newRows = CASES.map((c, i) => {
    let row = tpl
      .replace(/href="\/project\/[^"]+"/, `href="/project/${c.slug}"`)
      .replace(`class="${clsA}"`, `class="${i === 0 ? clsA : clsB}"`);
    const texts = [esc(c.industry), esc(c.eventType), esc(c.title), esc(c.location)];
    let p = 0;
    row = row.replace(/<p data-sc-id="t-\d+" class="Paragraph_paragraph__SId_Y css[^"]*">[^<]*<\/p>/g, (m) => {
      const t = texts[p++];
      return m.replace(/>[^<]*</, `>${t}<`);
    });
    if (p !== 4) { console.error('projects: row text count mismatch'); process.exit(1); }
    return row.replace(/data-sc-id="t-27"/, `data-sc-id="t-${27 + i * 4}"`)
      .replace(/data-sc-id="t-28"/, `data-sc-id="t-${28 + i * 4}"`)
      .replace(/data-sc-id="t-29"/, `data-sc-id="t-${29 + i * 4}"`)
      .replace(/data-sc-id="t-30"/, `data-sc-id="t-${30 + i * 4}"`);
  });
  const listOpen = '<div class="ProjectListSection_projectList__bFJCV css-rfhucd">';
  const liOpen = stat.indexOf(listOpen);
  const newStat = stat.slice(0, liOpen + listOpen.length) + newRows.join('') + stat.slice(lastRowEnd);
  const flight = g.slice(staticEnd);

  g = newStat + flight;

  // static counts 71 -> 12 (hero number + list counter)
  const cntBefore = (newStat.match(/>71<\/div>/g) || []).length;
  if (cntBefore !== 2) { console.error(`projects: expected 2 '>71</div>' static counts, got ${cntBefore}`); process.exit(1); }
  g = newStat.split('>71</div>').join('>12</div>') + flight;

  // --- flight push 6 ---
  const pushes = [...g.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)];
  const idx = pushes.findIndex((m) => (() => { try { return decodeArg(m[1]).includes('"total":71'); } catch { return false; } })());
  if (idx < 0) { console.error('projects: flight push with total:71 not found'); process.exit(1); }
  const m = pushes[idx];
  const t = decodeArg(m[1]);

  // categories -> single node
  const catSpan = balanced(t, '"projectCategories":{"projectCategories":{"edges":[');
  if (!catSpan) { console.error('projects: projectCategories edges not found'); process.exit(1); }
  const catNode = { node: { id: 'dGVybToyNw==', slug: 'mall-activations', name: 'Retail & Malls', count: 12, featuredProjects: { edges: CASES.slice(0, 3).map(listEdge) } } };
  const t2 = t.slice(0, catSpan.open) + '"projectCategories":{"projectCategories":{"edges":' + JSON.stringify([catNode]) + t.slice(catSpan.close);

  // total -> 12
  let t3 = replaceUnique(t2, '"total":71', '"total":12', 'total');
  t3 = replaceUnique(t3, '"originalTotal":71', '"originalTotal":12', 'originalTotal');

  // projects edges (24 -> 12) + hasMore false
  const PAG = '"offsetPagination":{"hasMore":true,"hasPrevious":false}},"edges":[';
  const projSpan = balanced(t3, PAG);
  if (!projSpan) { console.error('projects: projects edges not found'); process.exit(1); }
  const newPag = '"offsetPagination":{"hasMore":false,"hasPrevious":false}},"edges":' + JSON.stringify(CASES.map(listEdge));
  const t4 = t3.slice(0, projSpan.open) + newPag + t3.slice(projSpan.close);

  // sanity: no stale old-case slugs remain in the edited flight
  const stale = ['uefa-champions-league-final-2026', 'adevinta-ignite-2024', 'menzies-congress-2025', 'midas-ise-2026', 'euroleague-final-four-2026'].filter((s) => t4.includes(s));
  if (stale.length) { console.error('projects: stale slugs remain in flight:', stale.join(',')); process.exit(1); }
  if (decodeArg(encodeArg(t4)) !== t4) { console.error('projects: encode/decode round trip mismatch'); process.exit(1); }

  g = g.split(m[0]).join(m[0].replace(m[1], encodeArg(t4)));

  if (g === before) { console.error('projects: no change produced'); process.exit(1); }
  fs.writeFileSync(file, g);
  console.log('rewired', file, 'size', before.length, '->', g.length);
}

// ---------- homepage ----------
const navScript = (casesJson) => `
<script id="sc-home-cases" type="application/json">${casesJson}</script>
<script>
(() => {
  var C = null, attached = new WeakMap();
  var parse = function () {
    try {
      var el = document.getElementById('sc-home-cases');
      if (el && el.textContent) { C = JSON.parse(el.textContent); return true; }
    } catch (e) { }
    return false;
  };
  var findCase = function (root) {
    var h = root.querySelector('h3');
    if (h) {
      var txt = h.textContent || '';
      for (var i = 0; i < C.length; i++) if (txt.indexOf(C[i].title) >= 0) return C[i];
    }
    var img = root.querySelector('img[data-nimg="1"]');
    if (img && img.src) {
      for (var j = 0; j < C.length; j++) if (img.src.indexOf(encodeURIComponent(C[j].photo)) >= 0) return C[j];
    }
    return null;
  };
  var onSlideClick = function (e) {
    var c = findCase(e.currentTarget);
    if (c) { e.preventDefault(); e.stopPropagation(); window.location.assign('/project/' + c.slug); }
  };
  var isSlide = function (root) {
    if (!root || root.children.length === 0) return false;
    var h = root.querySelector('h3');
    if (h) {
      var txt = h.textContent || '';
      for (var i = 0; i < C.length; i++) if (txt.indexOf(C[i].title) >= 0) return true;
    }
    return false;
  };
  var scan = function () {
    if (!C) return;
    var roots = document.querySelectorAll('main [class*="css-"]');
    for (var i = 0; i < roots.length; i++) {
      var r = roots[i];
      if (!attached.has(r) && isSlide(r)) {
        attached.set(r, true);
        r.addEventListener('click', onSlideClick, true);
      }
    }
  };
  var ready = function () {
    if (!parse()) return;
    scan();
    new MutationObserver(function (ms) {
      var need = false;
      for (var i = 0; i < ms.length && !need; i++) need = ms[i].type === 'childList';
      if (need) scan();
    }).observe(document.body, { childList: true, subtree: true });
    window.setTimeout(scan, 4000);
    window.setTimeout(scan, 12000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
</script>`;

function rewireHome(file) {
  let g = fs.readFileSync(file, 'utf8');
  const before = g;
  const pushes = [...g.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)];
  const idx = pushes.findIndex((m) => (() => { try { return decodeArg(m[1]).includes('"prominents":{"edges"'); } catch { return false; } })());
  if (idx < 0) { console.error(file + ': home payload push not found'); process.exit(1); }
  const m = pushes[idx];
  const t = decodeArg(m[1]);

  // prominents edges -> 5 new cases
  const pSpan = balanced(t, '"prominents":{"edges":');
  if (!pSpan) { console.error(file + ': prominents not found'); process.exit(1); }
  const t2 = t.slice(0, pSpan.open) + '"prominents":{"edges":' + JSON.stringify(CASES.slice(0, 5).map((c, i) => ({ node: homeNode(c, origPhoto(i)) }))) + t.slice(pSpan.close);

  // testimonials broken case links -> Projects list
  let t3 = t2;
  const fixLink = (slug) => {
    const oldU = `"url":"https://iventions.com/project/${slug}/"`;
    const n = t3.split(oldU).length - 1;
    if (n !== 1) { console.error(file + `: url occurrences=${n} for ${slug}`); process.exit(1); }
    t3 = t3.split(oldU).join('"url":"https://iventions.com/projects/"');
  };
  fixLink('uefa-champions-league-final-2023');
  t3 = t3.replace('"title":"UEFA Champions League Final 2023: Where Football Met Turkish Grandeur"', '"title":"Projects"');
  fixLink('adevina-ignite-2023');
  t3 = t3.replace('"title":"Adevinta Ignite 2023: Shaping the Future of Commerce"', '"title":"Projects"');
  fixLink('menzies-congress-2025');

  const left = (t3.match(/https:\/\/iventions\.com\/project\//g) || []).length;
  if (left !== 0) { console.error(file + `: remaining project urls=${left}`); process.exit(1); }

  // round-trip safety: re-encoding then re-decoding must be lossless
  if (decodeArg(encodeArg(t3)) !== t3) { console.error(file + ': encode/decode round trip mismatch'); process.exit(1); }

  g = g.split(m[0]).join(m[0].replace(m[1], encodeArg(t3)));

  // inject click-to-navigate for the prominents slides (title + photo matching)
  const casesJson = JSON.stringify(CASES.slice(0, 5).map((c, i) => ({ slug: c.slug, title: c.title, photo: origPhoto(i) })));
  const closeBody = g.lastIndexOf('</body>');
  if (closeBody < 0) { console.error(file + ': </body> not found for nav script'); process.exit(1); }
  g = g.slice(0, closeBody) + navScript(casesJson) + g.slice(closeBody);

  if (g === before) { console.error(file + ': no change'); process.exit(1); }
  fs.writeFileSync(file, g);
  console.log('rewired', file, 'size', before.length, '->', g.length);
}

const only = process.argv[2];
if (!only || only === 'projects') rewireProjects('dist/projects/index.html');
if (!only || only === 'home') {
  rewireHome('dist/index.html');
  rewireHome('dist/home/index.html');
}
console.log('DONE');