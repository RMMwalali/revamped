import fs from 'node:fs';
import CASE from './stillcraft-cases.mjs';

// Residuals the serve-time transform (transform.mjs) is responsible for:
// "Barcelona, Spain" contact address, "Iventions" brand metas/filenames/company
// name, and the legit term "Live Event Viewing".
const SKIP_SUB = {
  Barcelona: ['Barcelona, Spain'],
  Iventions: ['Events-Iventions.jpg', 'content="Iventions"', 'Iventions International Events'],
  'Live Event': ['Live Event Viewing'],
};
const RESID = ['YPO', 'Barcelona', 'Iventions', 'Adevinta', 'Adevina', 'adevinta', 'adevina', 'Hackathon', 'Axiecon', 'axiecon', '2,5K', '2,500', '2500', 'Business Associations', 'Live Event', 'Rumba', 'umbilical'];

let failures = 0;
const slugList = CASE.map((c) => c.slug);

function countResid(text, w) {
  let n = 0, i = -1;
  const skip = SKIP_SUB[w] || [];
  while ((i = text.indexOf(w, i + 1)) >= 0) {
    const hit = text.slice(Math.max(0, i - 30), i + w.length + 30);
    if (skip.some((s) => hit.includes(s))) { n = -1; break; } // mark handled
  }
  return n;
}

function scanPage(slug) {
  const c = CASE.find((x) => x.slug === slug);
  const html = fs.readFileSync(`dist/project/${slug}/index.html`, 'utf8');
  const pushes = [];
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    try { pushes.push(JSON.parse('"' + m[1] + '"')); } catch { pushes.push(null); failures++; console.log(`  ${slug}: push parse FAILED`); }
  }
  const flight = pushes.filter(Boolean).join('\n');
  const problems = [];
  for (const w of RESID) {
    const raw = countResid(html, w);
    if (raw > 0) problems.push(`residual "${w}" ${raw}x`);
  }
  for (const need of [c.title, c.hero, 'Key facts', 'Projects you might', 'Creative Concept & Design', `/assets/stillcraft/mall-case/${slug}/cover.jpg`, `/assets/stillcraft/mall-case/${slug}/video.jpg`]) {
    if (!html.includes(need)) problems.push(`MISSING: ${need}`);
  }
  // challenge / wwd / result content anywhere in flight
  for (const [needle, text] of [
    ['challenge flight', c.challenge.slice(0, 30)],
    ['whatWeDid flight', c.whatWeDid.slice(0, 30)],
    ['result flight', c.result.slice(0, 30)],
    ['hero flight', c.hero.slice(0, 30)],
  ]) {
    if (!flight.includes(text)) problems.push(`MISSING ${needle}: "${text}"`);
  }
  for (const [v, l] of c.facts) {
    if (!flight.includes(v)) problems.push(`facts flight missing value "${v}"`);
  }
  const rel = pushes.find((t) => t && t.includes('"heading":"Projects you might'));
  if (rel) {
    const relSlugs = [...rel.matchAll(/"slug":"([^"]+)"/g)].map((m) => m[1]);
    const bad = relSlugs.filter((s) => !slugList.includes(s));
    if (bad.length) problems.push(`related unknown slugs: ${bad.join(',')}`);
    if (relSlugs.length !== 4 || new Set(relSlugs).size !== 4 || relSlugs.includes(slug)) problems.push('related count/dupe/self issue');
    if (rel.includes('"name":"Live Event"')) problems.push('related has stale eventType Live Event');
  } else problems.push('related push missing');
  if (problems.length) { failures++; console.log(`== ${slug}`); for (const p of problems) console.log('  ', p); }
  return problems;
}

for (const slug of slugList) scanPage(slug);
console.log(failures === 0 ? 'ALL 12 PAGES CLEAN' : `${failures} pages have issues`);