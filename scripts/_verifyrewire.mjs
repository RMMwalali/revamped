import fs from 'node:fs';
import CASES from './stillcraft-cases.mjs';
const slugList = CASES.map((c) => c.slug);
let fail = 0;
const ok = (b, msg) => { if (!b) { console.log(' FAIL:', msg); fail++; } };

function decodeAll(file) {
  const g = fs.readFileSync(file, 'utf8');
  const pushes = [];
  let bad = 0;
  for (const m of g.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    try { pushes.push(JSON.parse('"' + m[1] + '"')); } catch { pushes.push(null); bad++; }
  }
  ok(bad === 0, file + `: ${bad} pushes failed to parse`);
  return { g, pushes, stat: g.slice(0, g.indexOf('self.__next_f.push(')) };
}

// ---------- /projects ----------
{
  const { g, pushes, stat } = decodeAll('dist/projects/index.html');
  const rows = [...stat.matchAll(/<div class="ProjectListSection_project__76n_c css-avegm8">/g)];
  ok(rows.length === 12, `projects static rows = ${rows.length}, want 12`);
  const hrefs = [...stat.matchAll(/href="\/project\/([^"]+)"/g)].map((m) => m[1]);
  ok(hrefs.length === 12, `projects static hrefs = ${hrefs.length}, want 12`);
  ok(new Set(hrefs).size === 12 && hrefs.every((s) => slugList.includes(s)), 'projects static hrefs all new');
  ok(stat.includes('>12</div>'), 'projects counter shows 12');
  ok(!/>71<\/div>/.test(stat), 'projects counter 71 gone');
  const flight = pushes.filter(Boolean).join('\n');
  const push6 = pushes.find((t) => t && t.includes('"total":12'));
  ok(!!push6, 'projects flight total:12 present');
  if (push6) {
    const plSeg = push6.slice(push6.indexOf('"projectList"'), push6.indexOf('"originalTotal"', push6.indexOf('"projectList"')));
    const relSlugs = [...plSeg.matchAll(/"slug":"([^"]+)"/g)].map((m) => m[1]);
    ok(relSlugs.length === 12, `projects flight slugs = ${relSlugs.length}, want 12`);
    ok(new Set(relSlugs).size === 12, 'projects flight slugs unique');
    ok(relSlugs.every((s) => slugList.includes(s)), 'projects flight slugs all new');
    ok(push6.includes('"hasMore":false'), 'projects hasMore false');
    ok(push6.includes('"name":"Retail & Malls"'), 'projects single category present');
    const oldCats = ['congresses', 'exhibits', 'sports'].filter((s) => push6.includes(`"slug":"${s}"`));
    ok(oldCats.length === 0, 'old category slugs removed');
  }
  for (const old of ['uefa-champions-league-final-2026', 'adevinta-ignite-2024', 'menzies-congress-2025', 'midas-ise-2026', 'euroleague-final-four-2026', 'pfizer-cphi', 'corden-pharma-cphi']) {
    ok(!flight.includes(old), `projects flight stale ${old} gone`);
    ok(!g.includes(`/project/${old}`), `projects ${old} href gone anywhere`);
  }
  console.log('projects OK');
}

// ---------- home ----------
for (const f of ['dist/index.html', 'dist/home/index.html']) {
  const { g, pushes, stat } = decodeAll(f);
  const home = pushes.find((t) => t && t.includes('"prominents":{"edges"'));
  ok(!!home, `${f} home payload present`);
  if (home) {
    const prom = [...home.matchAll(/"slug":"([^"]+)"/g)];
    const promSlugs = prom.map((m) => m[1]).slice(0, 5);
    ok(promSlugs.length === 5, `${f} prominents = ${promSlugs.length}`);
    ok(promSlugs.every((s) => slugList.includes(s)), `${f} prominents slugs new: ${promSlugs.join(',')}`);
    ok(!home.includes('https://iventions.com/project/uefa') && !home.includes('https://iventions.com/project/adevina') && !home.includes('https://iventions.com/project/menzies'), `${f} broken testimonial urls gone`);
    ok(home.split('https://iventions.com/projects/').length >= 4, `${f} testimonials retargeted to projects list`);
  }
  for (const old of ['uefa-champions-league-final-2023', 'adevina-ignite-2023', 'menzies-congress-2025']) {
    ok(!g.includes(old), `${f} stale ${old} gone`);
  }
  console.log(f, 'OK');
}
console.log(fail === 0 ? 'ALL CHECKS PASSED' : fail + ' FAILURES');