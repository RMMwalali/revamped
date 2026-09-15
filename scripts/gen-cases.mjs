// Generate the 12 mall case-study pages from the ypo-global-event template.
// Strategy mirrors the site's own overrides: swap page-specific content in the
// decoded RSC flight pushes AND the static HTML, then re-encode each push with
// JSON.stringify so hydration sees matching content.
import fs from 'node:fs';
import path from 'node:path';
import CASE, { caseBySlug, servicesFor } from './stillcraft-cases.mjs';

const TPL = 'dist/project/ypo-global-event/index.html';
const WEB = 'https://stillcraftevents.co.ke';
const BRAND = 'StillCraft Events';

const PUSHRE = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;

const TPL_TEXT = fs.readFileSync(TPL, 'utf8');
function tplSectionText(scId) {
  const m = TPL_TEXT.match(new RegExp('data-sc-id="' + scId + '"[\\s\\S]*?class="Paragraph_paragraph__SId_Y css-1lxj80l">([\\s\\S]*?)</div>'));
  return m ? m[1] : null;
}
const TPL_SECTIONS = {
  challenge: tplSectionText('t-27'),
  whatWeDid: tplSectionText('t-28'),
  result: tplSectionText('t-29'),
};

function splitPushes(html) {
  const pushes = [];
  let m;
  PUSHRE.lastIndex = 0;
  while ((m = PUSHRE.exec(html))) {
    pushes.push({ arg: m[1], start: m.index, end: m.index + m[0].length });
  }
  return pushes;
}

function decodeArg(arg) { try { return JSON.parse('"' + arg + '"'); } catch { return null; } }
function encodeArg(text) { return JSON.stringify(text).slice(1, -1); }

function replaceChildKey(text, key, inside, value) {
  const pat = new RegExp('("' + key + '":")((?:[^"\\\\]|\\\\.)*)(")', 'g');
  return text.replace(pat, (mm, a, b, c) => (b.includes(inside) ? a + encodeArg(value) + c : mm));
}

// Replace the flight serialization of an HTML paragraph inside
// dangerouslySetInnerHTML (surrounded by \u003c...\u003e escapes).
function replaceHtmlChild(text, inside, value) {
  return replaceChildKey(text, '__html', inside, ''); // placeholder, replaced below
}

const imgPath = (slug, slot) => `/assets/stillcraft/mall-case/${slug}/${slot}.svg`;

const YPO_IMG_TO_SLOT = [
  ['/assets/cms/wp-content/uploads/2025/08/YPO-2025-Congresses-3.jpg', 'cover'],
  ['/assets/cms/wp-content/uploads/2025/08/YPO-2025-Congresses-8.jpg', 'challenge'],
  ['/assets/cms/wp-content/uploads/2025/08/YPO-2025-Congresses-4.jpg', 'gallery1'],
  ['/assets/cms/wp-content/uploads/2025/08/YPO-2025-Congresses-2.jpg', 'gallery2'],
  ['/assets/cms/wp-content/uploads/2025/08/YPO-2025-Congresses-5.jpg', 'gallery3'],
  ['/assets/cms/wp-content/uploads/2025/08/YPO-2025-Congresses-13-scaled.jpg', 'gallery4'],
  ['/assets/cms/wp-content/uploads/2025/08/YPO-2025-Congresses-12-scaled.jpg', 'gallery5'],
  ['/assets/cms/wp-content/uploads/2025/08/YPO-2025-Congresses.jpg', 'video'],
];

const descEn = (c) => `${c.title}: ${c.excerpt} A StillCraft Events case study.`;
const introEn = (c) => `<p>${c.hero}</p>\n`;

function buildRelatedProject(c, others) {
  return others.map((x) => ({
    databaseId: x.databaseId,
    slug: x.slug,
    title: x.title,
    content: `<p>${x.excerpt}</p>\n`,
    featuredImage: { node: { sourceUrl: imgPath(x.slug, 'cover') } },
    projectCategories: { edges: [{ node: { name: x.eventType } }] },
    projectTemplate: { heroBlock: { industry: x.industry, location: x.location, participants: x.participants, eventType: { edges: [{ node: { name: x.eventType } }] } } },
  }));
}

function relatedFor(c) {
  const others = CASE.filter((x) => x.slug !== c.slug);
  const idx = others.findIndex((x) => x.databaseId > c.databaseId);
  const start = idx < 0 ? 0 : idx;
  const rot = [];
  for (let i = 0; i < 4; i++) rot.push(others[(start + i) % others.length]);
  return rot;
}

function titleLines(s) {
  const w = s.split(' ');
  const mid = Math.ceil(w.length / 2);
  return [w.slice(0, mid).join(' ') + ' ', w.slice(mid).join(' ')];
}
function descLines(s) {
  const w = s.split(' ');
  const per = Math.ceil(w.length / 3);
  if (per < 1) return [s];
  return [w.slice(0, per).join(' '), w.slice(per, per * 2).join(' '), w.slice(per * 2).join(' ')];
}

function buildCasePage(c) {
  let html = fs.readFileSync(TPL, 'utf8');

  // 1) image path swaps (raw html = static + escaped payloads)
  for (const [oldUrl, slot] of YPO_IMG_TO_SLOT) {
    html = html.split(oldUrl).join(imgPath(c.slug, slot));
  }

  // ---- static exclusive content ----
  const titleHtml = 'YPO Global Event: Hospitality &amp; experience excellence';
  const titleRaw = 'YPO Global Event: Hospitality & experience excellence';
  const descStatic = 'We brought Barcelona\u2019s spirit to life for the YPO Global Event 2025: a bold and seamless CEO summit igniting vision and connection.';
  const titlePage = `${c.title} - ${BRAND}`;
  const descPage = descEn(c).replace(/&/g, '&amp;');
  const relC = relatedFor(c);

  // page <title>, og:title/twitter:title + og:desc/twitter:desc + og:image:alt/twitter:image:alt
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${titlePage.replace(/&/g, '&amp;')}</title>`);
  html = html.split(`<meta property="og:url" content="https://iventions.com">`).join(`<meta property="og:url" content="${WEB}/project/${c.slug}">`);
  for (const prop of ['og:title', 'og:image:alt', 'twitter:title', 'twitter:image:alt']) {
    html = html.split(`<meta property="${prop}" content="${titleHtml}">`).join(`<meta property="${prop}" content="${titleHtml.replace('YPO Global Event: Hospitality &amp; experience excellence', c.title)}">`);
  }
  for (const prop of ['description', 'og:description', 'twitter:description']) {
    html = html.split(`<meta name="${prop}" content="${descStatic.replace(/&/g, '&amp;')}">`).join(`<meta name="${prop}" content="${descPage}">`);
    html = html.split(`<meta property="${prop}" content="${descStatic.replace(/&/g, '&amp;')}">`).join(`<meta property="${prop}" content="${descPage}">`);
  }

  // universal title + description + url replacements (static + flight L1 + flight L2)
  for (const base of [
    'YPO Global Event: Hospitality &amp; experience excellence',
    'YPO Global Event: Hospitality & experience excellence',
    'YPO Global Event: Hospitality \\u0026 experience excellence',
  ]) {
    html = html.split(base).join(c.title);
  }
  html = html.split(`- Iventions`).join(`- StillCraft Events`);

  // static meta description/og/twitter + og:image:alt/twitter:image:alt
  const descTags = [
    ['meta', 'name', 'description'],
    ['meta', 'property', 'og:description'],
    ['meta', 'name', 'twitter:description'],
  ];
  for (const [tag, atprop, prop] of descTags) {
    html = html.replace(new RegExp(`<${tag} ${atprop}="${prop}" content="[^"]*">`), `<${tag} ${atprop}="${prop}" content="${descPage}">`);
  }
  const titleTags = [
    ['meta', 'property', 'og:title'],
    ['meta', 'name', 'twitter:title'],
    ['meta', 'property', 'og:image:alt'],
    ['meta', 'name', 'twitter:image:alt'],
  ];
  for (const [tag, atprop, prop] of titleTags) {
    html = html.replace(new RegExp(`<${tag} ${atprop}="${prop}" content="[^"]*">`), `<${tag} ${atprop}="${prop}" content="${c.title.replace(/&/g, '&amp;')}">`);
  }
  html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${WEB}/project/${c.slug}">`);

  // static hero h1 (t-21), intro (t-22), stats, and h6 title (t-30)
  html = html.replace(/(<h1[^>]*data-sc-id="t-21"[^>]*>)[^<]*(<\/h1>)/, `$1${c.title}$2`);
  html = html.replace(/(<p data-sc-id="t-22">)[^<]*(<\/p>)/, `$1${c.hero}$2`);
  html = html.replace(/(<h6[^>]*data-sc-id="t-30"[^>]*>)[^<]*(<\/h6>)/, `$1${c.title}$2`);
  const st = (re, v) => html.replace(re, `$1${v}$2`);
  html = st(/(<div class="Paragraph_paragraph__SId_Y styles_wrapper_content_item_label__T2qY6 css-n0us86">)2,500(<\/div>)/, c.feet);
  html = st(/(<div class="Paragraph_paragraph__SId_Y styles_wrapper_content_item_label__T2qY6 css-n0us86">)Business Associations(<\/div>)/, c.industry);
  html = st(/(<div class="Paragraph_paragraph__SId_Y styles_wrapper_content_item_label__T2qY6 css-n0us86">)Live Event(<\/div>)/, c.eventType);
  html = st(/(<div class="Paragraph_paragraph__SId_Y styles_wrapper_content_item_label__T2qY6 css-n0us86">)Barcelona(<\/div>)/, c.location);

  // narrative section headings (YPO template uses "The challenge / What we did / The result ")
  // StillCraft copy uses "The Situation / What We Did / The Result" — normalize (trimmed).
  html = html.replace(/>The challenge\s*<\/h6>/gi, '>The Situation</h6>');
  html = html.replace(/>What we did\s*<\/h6>/gi, '>What We Did</h6>');
  html = html.replace(/>The result\s*<\/h6>/gi, '>The Result</h6>');
  // narrative sections: swap the exact template prose (static + any leftover flight copy)
  for (const [oldTxt, newTxt] of [
    [TPL_SECTIONS.challenge, c.challenge],
    [TPL_SECTIONS.whatWeDid, c.whatWeDid],
    [TPL_SECTIONS.result, c.result],
  ]) {
    if (oldTxt) html = html.split(oldTxt).join(newTxt);
  }
  // quote placeholder is an italic blockquote under "In Their Words" — keep the
  // YPO quote shape but replace its text with the per-case placeholder.
  if (c.quote) {
    html = html.replace(/(<blockquote[^>]*>)[\s\S]*?(<\/blockquote>)/, `$1${c.quote.replace(/&/g, '&amp;')}$2`);
    html = html.split('YPO Global Event brought').join(c.quote.slice(0, 24));
  }

  // animated location marquee spans
  html = html.replace(/(class="css-928hs6"[^>]*)>Barcelona<\/div>/g, `$1>${c.location}</div>`);

  // ---- static-only section: related marquee, card alts, key-facts rows ----
  const staticEnd = html.indexOf('self.__next_f.push(');
  const cut = staticEnd >= 0 ? staticEnd : html.length;
  let body = html.slice(0, cut);
  const tail = html.slice(cut);

  const r = relC;
  // related card alt texts
  for (const [oldAlt, rc] of [
    ['alt="Adevinta Ignite: Empowering connection &amp; growth"', r[0]],
    ['alt="Adevinta Ignite: Shaping the future of commerce"', r[1]],
    ['alt="Hackathon: Five days of global innovation"', r[2]],
    ['alt="Axiecon: A vibrant, global gathering of gamers"', r[3]],
  ]) {
    body = body.split(oldAlt).join(`alt="${rc.title.replace(/&/g, '&amp;')}"`);
  }
  // marquee title lines
  const tl0 = titleLines(r[0].title), tl1 = titleLines(r[1].title), tl2 = titleLines(r[2].title), tl3 = titleLines(r[3].title);
  const dl0 = descLines(r[0].excerpt), dl1 = descLines(r[1].excerpt), dl2 = descLines(r[2].excerpt), dl3 = descLines(r[3].excerpt);
  const titlePairs = [
    ['>Adevinta Ignite: Empowering </div>', `>${tl0[0]}</div>`],
    ['>connection &amp; growth</div>', `>${tl0[1]}</div>`],
    ['>Adevinta Ignite: Shaping the future of </div>', `>${tl1[0]}</div>`],
    ['>commerce</div>', `>${tl1[1]}</div>`],
    ['>Hackathon: Five days of global </div>', `>${tl2[0]}</div>`],
    ['>innovation</div>', `>${tl2[1]}</div>`],
    ['>Axiecon: A vibrant, global gathering </div>', `>${tl3[0]}</div>`],
    ['>of gamers</div>', `>${tl3[1]}</div>`],
  ];
  const descPairs = [
    ['>Uniting a global team into one community through a </div>', `>${dl0[0]} </div>`],
    ['>transformative corporate event designed to connect, </div>', `>${dl0[1]} </div>`],
    ['>engage and celebrate global talent.</div>', `>${dl0[2]}.</div>`],
    ['>Adevinta Ignite 2023 united global teams in Barcelona </div>', `>${dl1[0]} </div>`],
    ['>to celebrate their unique culture and brightest </div>', `>${dl1[1]} </div>`],
    ['>innovators.</div>', `>${dl1[2]}.</div>`],
    ['>A five-day hackathon in Barcelona brought 200 </div>', `>${dl2[0]} </div>`],
    ['>international participants together for innovation, </div>', `>${dl2[1]} </div>`],
    ['>creativity and collaboration.</div>', `>${dl2[2]}.</div>`],
    ['>Axiecon 2022, a bold three-day celebration where Axie </div>', `>${dl3[0]} </div>`],
    ['>fans and industry leaders came together in Barcelona to </div>', `>${dl3[1]} </div>`],
    ['>connect, create, and most importantly, play.</div>', `>${dl3[2]}.</div>`],
  ];
  for (const [o, n] of [...titlePairs, ...descPairs]) body = body.split(o).join(n);
  body = body.split('>Barcelona</div>').join(`>${r[0].location}</div>`);

  // static key-facts rows: repave the 4 value/label line divs
  const fStart = body.indexOf('<span data-sc-id="t-37"');
  const fEnd0 = body.indexOf('data-sc-id="t-30"', fStart);
  const fEnd = fEnd0 >= 0 ? fEnd0 : body.length;
  if (fStart >= 0 && fEnd > fStart) {
    const flat = c.facts.flat();
    const region = body.slice(fStart, fEnd);
    const re = /<div class="line fix-clip"[^>]*>[^<]*<\/div>/g;
    let count = 0;
    const rebuilt = region.replace(re, (m0) => {
      const txt = count < flat.length ? flat[count] : '';
      count++;
      return m0.replace(/>[^<]*<\/div>$/, '>' + txt + '</div>');
    });
    body = body.slice(0, fStart) + rebuilt + body.slice(fEnd);
  }

  html = body + tail;

  // related swiper: hrefs + cover images + residual text
  const relUrls = [
    ['/project/adevinta-ignite-2024', relC[0]],
    ['/project/adevina-ignite-2023', relC[1]],
    ['/project/hackathon', relC[2]],
    ['/project/axiecon', relC[3]],
  ];
  for (const [oldHref, rc] of relUrls) html = html.split(`href="${oldHref}"`).join(`href="/project/${rc.slug}"`);
  for (const [oldImg, rc] of [
    ['/assets/cms/wp-content/uploads/2025/08/Adevina-Ignite-2024-4-scaled.jpg', relC[0]],
    ['/assets/cms/wp-content/uploads/2025/07/Adevinta-scaled.jpg', relC[1]],
    ['/assets/cms/wp-content/uploads/2025/08/Hackathon-2022-5-scaled.png', relC[2]],
    ['/assets/cms/wp-content/uploads/2025/08/Axiecon-2022-10.png', relC[3]],
  ]) html = html.split(oldImg).join(imgPath(rc.slug, 'cover'));

  // hero video poster + preload
  html = html.split('/assets/cms/wp-content/uploads/2025/08/YPO-2025-Congresses-9-scaled.jpg').join(imgPath(c.slug, 'video'));

  // 3) flight push rewrites
  const pushes = splitPushes(html);
  let out = '';
  let cursor = 0;
  for (const p of pushes) {
    let t = decodeArg(p.arg);
    let changed = false;
    if (t) {
      if (t.includes('"metadata"')) {
        t = t.split(titleRaw).join(titlePage);
        t = t.split(descStatic).join(descEn(c));
        t = t.split('"content":"https://iventions.com"').join(`"content":"${WEB}/project/${c.slug}"`);
        t = t.split(`${c.title} - Iventions`).join(c.title);
        changed = true;
      }
      // flight image alt (cover etc.) — decoded text uses a plain & already
      if (t.includes('"alt":"YPO Global Event')) {
        t = t.split('YPO Global Event: Hospitality & experience excellence').join(c.title);
        changed = true;
      }
      if (t.includes('project-detai-content')) {
        const ii = t.indexOf('project-detai-content');
        const at = t.indexOf('"__html":"', ii);
        if (at >= 0) {
          const start = at + '"__html":"'.length;
          let end = start;
          while (end < t.length) {
            if (t[end] === '\\') { end += 2; continue; }
            if (t[end] === '"') break;
            end++;
          }
          t = t.slice(0, start) + encodeArg(introEn(c)) + t.slice(end);
          changed = true;
        }
      }
      if (t.includes('children":"YPO Global Event: Hospitality')) {
        t = t.split('"children":"YPO Global Event: Hospitality & experience excellence"').join(`"children":"${c.title}"`);
        t = t.split('"children":"YPO Global Event"').join(`"children":"${c.title}"`);
        changed = true;
      }
      if (t.includes('The challenge')) {
        t = replaceChildKey(t, 'children', 'One umbrella event, with two distinct parts', c.challenge);
        changed = true;
      }
      if (t.includes('What we did')) {
        t = replaceChildKey(t, 'children', 'Under the theme of Barcelona', c.whatWeDid);
        changed = true;
      }
      if (t.includes('The result ')) {
        t = replaceChildKey(t, 'children', 'With 100+ professionals', c.result);
        changed = true;
      }
      // participants counter (push with $L3a value)
      if (t.includes('"value":2500')) {
        t = t.split('"value":2500').join(`"value":${c.participants}`);
        changed = true;
      }
      // hero video poster (flight)
      t = t.split('/assets/cms/wp-content/uploads/2025/08/YPO-2025-Congresses-9-scaled.jpg').join(imgPath(c.slug, 'video'));
      if (t.includes('"children":"Barcelona"')) {
        t = t.split('"children":"Barcelona"').join(`"children":"${c.location}"`);
        changed = true;
      }
      if (t.includes('"children":"Business Associations"')) {
        t = t.split('"children":"Business Associations"').join(`"children":"${c.industry}"`);
        t = t.split('"children":"Live Event"').join(`"children":"${c.eventType}"`);
        changed = true;
      }
      if (t.includes('Creative concept ')) {
        const svc = servicesFor();
        t = t.split('"children":"Creative concept "').join(`"children":"${svc[0]}"`);
        t = t.split('"children":"Guest management"').join(`"children":"${svc[1]}"`);
        t = t.split('"children":"Branding"').join(`"children":"${svc[2]}"`);
        t = t.split('"children":"Venue design and decoration"').join(`"children":"${svc[3]}"`);
        t = t.split('"children":"Activations"').join(`"children":"${svc[4]}"`);
        changed = true;
      }
      if (t.includes('Key facts')) {
        const [v0, l0, v1, l1, v2, l2, v3, l3] = c.facts.flat();
        // row selectors (array form: ["$","$L26","VALUE+LABEL",{...})
        t = t.split('"$L26","2,5KGuests"').join('"$L26","' + v0 + l0 + '"');
        t = t.split('"$L26","4days of seamless programming"').join('"$L26","' + v1 + l1 + '"');
        t = t.split('"$L26","15+ local suppliers engaged"').join('"$L26","' + v2 + l2 + '"');
        t = t.split('"$L26","2months for crafting, planning and production "').join('"$L26","' + v3 + l3 + '"');
        // first-row big value child
        t = t.split('"children":"2,5K"').join('"children":"' + v0 + '"');
        // labels
        t = t.split('"children":"Guests"').join('"children":"' + l0 + '"');
        t = t.split('"children":"days of seamless programming"').join('"children":"' + l1 + '"');
        t = t.split('"children":"local suppliers engaged"').join('"children":"' + l2 + '"');
        t = t.split('"children":"months for crafting, planning and production "').join('"children":"' + l3 + '"');
        // second row big value child is a bare digit or short token
        t = t.split('"children":"4"').join('"children":"' + v1 + '"');
        t = t.split('"children":"15+ "').join('"children":"' + v2 + '"');
        t = t.split('"children":"2"').join('"children":"' + v3 + '"');
        changed = true;
      }
      // related projects (rebuild the whole array with balanced bracket scan)
      if (t.includes('"heading":"Projects you might')) {
        const mStart = t.indexOf('{"heading":"Projects you might');
        const arrStart = t.indexOf('"projects":[', mStart) + '"projects":['.length;
        let depth = 1, i = arrStart;
        while (i < t.length && depth > 0) {
          const ch = t[i];
          if (ch === '[' || ch === '{') depth++;
          else if (ch === ']' || ch === '}') depth--;
          i++;
        }
        const newArr = JSON.stringify(buildRelatedProject(c, relatedFor(c)));
        t = t.slice(0, mStart) + `{"heading":"Projects you might also be interested in","projects":${newArr}` + t.slice(i);
        changed = true;
      }
      // gallery heading row selector + hero children (already title-swapped)
      if (t.includes('"$L27","YPO Global Event 3"')) {
        t = t.split('"$L27","YPO Global Event 3"').join('"$L27","' + c.title + ' 3"');
        changed = true;
      }
      if (t.includes('"children":"YPO Global Event"')) {
        t = t.split('"children":"YPO Global Event"').join('"children":"' + c.title + '"');
        changed = true;
      }
    }
    out += html.slice(cursor, p.start);
    out += 'self.__next_f.push([1,"' + (changed ? encodeArg(t) : p.arg) + '"])';
    cursor = p.end;
  }
  out += html.slice(cursor);

  const dir = path.dirname(`dist/project/${c.slug}/index.html`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`dist/project/${c.slug}/index.html`, out);
  return { slug: c.slug, size: out.length };
}

function svgFor(slug, slot, label) {
  const w = slot === 'cover' ? 1600 : slot === 'video' ? 1920 : 1280;
  const h = slot === 'video' ? 720 : slot === 'cover' ? 900 : 853;
  const bg = slot === 'video' ? '#1B2A4A' : slot === 'cover' ? '#C9A24B' : '#F5F1EC';
  const fg = slot === 'video' ? '#F5F1EC' : slot === 'cover' ? '#1B2A4A' : '#1B2A4A';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="${bg}"/><rect x="24" y="24" width="${w - 48}" height="${h - 48}" fill="none" stroke="${fg}" stroke-opacity="0.5" stroke-width="3"/><text x="50%" y="50%" fill="${fg}" font-family="Georgia, serif" font-size="${Math.round(h / 14)}" text-anchor="middle" dominant-baseline="middle">StillCraft Events</text><text x="50%" y="${Math.round(h / 2 + h / 8)}" fill="${fg}" fill-opacity="0.85" font-family="Verdana, sans-serif" font-size="${Math.round(h / 22)}" text-anchor="middle">${label.replace(/&/g, '&amp;')}</text><text x="50%" y="${Math.round(h / 2 + h / 6)}" fill="${fg}" fill-opacity="0.5" font-family="Verdana, sans-serif" font-size="${Math.round(h / 32)}" text-anchor="middle">${slug} — ${slot} · swap via /insider</text></svg>`;
}

function writeAssets(c) {
  const dir = `dist/assets/stillcraft/mall-case/${c.slug}`;
  fs.mkdirSync(dir, { recursive: true });
  for (const [slot, label] of [
    ['cover', c.title],
    ['challenge', 'The Challenge'],
    ['gallery1', 'Setting the scene'],
    ['gallery2', 'At the heart of the mall'],
    ['gallery3', 'Spaces brought to life'],
    ['gallery4', 'Detail that matters'],
    ['gallery5', 'The build'],
    ['video', 'Experience film (poster)'],
  ]) {
    const p = path.join(dir, slot + '.svg');
    if (!fs.existsSync(p)) fs.writeFileSync(p, svgFor(c.slug, slot, label));
  }
}

const slugs = process.argv.slice(2).length ? process.argv.slice(2) : CASE.map((c) => c.slug);
const results = [];
for (const slug of slugs) {
  const c = caseBySlug(slug);
  if (!c) { console.log('unknown', slug); continue; }
  writeAssets(c);
  const r = buildCasePage(c);
  results.push(r);
  console.log('built', r.slug, r.size);
}
console.log('done', results.length, 'pages');