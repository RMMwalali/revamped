import fs from 'node:fs';
import { execSync } from 'node:child_process';
const pris = execSync('git show HEAD:dist/projects/index.html', { maxBuffer: 1e9 }).toString('utf8');
const decodeArg = (a) => JSON.parse('"' + a + '"');
const encodeArg = (t) => JSON.stringify(t).slice(1, -1);
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
const replaceUnique = (t, n, r, w) => { const c = t.split(n).length - 1; if (c !== 1) { console.error('EXC', w, c); process.exit(1); } return t.split(n).join(r); };
const CASES = (await import('./stillcraft-cases.mjs')).default;
const listNode = (c) => ({ databaseId: c.databaseId, slug: c.slug, title: c.title, content: `<p>${c.excerpt}</p>\n`, featuredImage: { node: { sourceUrl: `/assets/stillcraft/mall-case/${c.slug}/cover.jpg` } }, projectCategories: { edges: [{ node: { name: c.industry } }] }, projectTemplate: { heroBlock: { industry: c.industry, location: c.location, participants: c.participants, eventType: { edges: [{ node: { name: c.eventType } }] } } } });
const listEdge = (c) => ({ node: listNode(c) });

// skip static/count (verified above) — apply them
const g0 = pris;
const staticEnd = g0.indexOf('self.__next_f.push(');
const stat = g0.slice(0, staticEnd);
const rowRe = /<div class="ProjectListSection_project__76n_c css-avegm8"><a href="\/project\/[^"]+"[\s\S]*?<\/a><\/div>/g;
const rows = [];
let lastRowEnd = 0;
let r;
while ((r = rowRe.exec(stat))) { rows.push(r[0]); lastRowEnd = rowRe.lastIndex; }
const listOpen = '<div class="ProjectListSection_projectList__bFJCV css-rfhucd">';
const liOpen = stat.indexOf(listOpen);
const newStat = stat.slice(0, liOpen + listOpen.length) + rows.slice(0, 12).join('') + stat.slice(lastRowEnd);
let g = newStat + g0.slice(staticEnd);
g = g.split('>71</div>').join('>12</div>');

const pushes = [...g.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)];
const idx = pushes.findIndex((m) => (() => { try { return decodeArg(m[1]).includes('"total":71'); } catch { return false; } })());
console.log('pristine has total:71 push too?', [...pris.matchAll(/total\":71/g)].length > 0);
console.log('idx', idx, 'pushes total', pushes.length);
const mm = pushes[idx];
console.log('m[0] len', mm[0].length, 'm[1] len', mm[1].length);
console.log('count of m[0] in g:', g.split(mm[0]).length - 1);
const t = decodeArg(mm[1]);
console.log('t includes "3:[" footer?', t.includes('get you accurate numbers'));
const catSpan = balanced(t, '"projectCategories":{"projectCategories":{"edges":[');
console.log('catSpan', catSpan ? 'yes' : 'NO');
const catNode = { node: { id: 'dGVybToyNw==', slug: 'mall-activations', name: 'Retail & Malls', count: 12, featuredProjects: { edges: CASES.slice(0, 3).map(listEdge) } } };
const t2 = t.slice(0, catSpan.open) + '"projectCategories":{"projectCategories":{"edges":' + JSON.stringify([catNode]) + t.slice(catSpan.close);
let t3 = replaceUnique(t2, '"total":71', '"total":12', 'total');
t3 = replaceUnique(t3, '"originalTotal":71', '"originalTotal":12', 'originalTotal');
const PAG = '"offsetPagination":{"hasMore":true,"hasPrevious":false}},"edges":[';
const projSpan = balanced(t3, PAG);
console.log('projSpan', projSpan ? 'yes open=' + projSpan.open : 'NO');
const newPag = '"offsetPagination":{"hasMore":false,"hasPrevious":false}},"edges":' + JSON.stringify(CASES.map(listEdge));
const t4 = t3.slice(0, projSpan.open) + newPag + t3.slice(projSpan.close);
console.log('t4 roundtrip', decodeArg(encodeArg(t4)) === t4);

const repl = mm[0].replace(mm[1], encodeArg(t4));
console.log('repl len', repl.length, 'matches m[0]?', repl === mm[0]);
g = g.split(mm[0]).join(repl);
const scripts = [...g.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const foot = scripts.find((c) => c.includes('get you accurate numbers'));
console.log('AFTER flight scripts', scripts.length, 'footer3 len', foot ? foot.length : 'MISSING', 'marker3', (g.match(/"3:\[\[/g) || []).length);
console.log('foot head:', JSON.stringify((foot || '').slice(0, 80)));
fs.writeFileSync('dist/_afterflight.html', g);