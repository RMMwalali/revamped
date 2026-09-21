import http from 'node:http';

const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});

// Simulate exactly what applyNav does, step by step
let h = html;

// NAV_LABELS replacement
const NAV_LABELS = [
  ['Iventions', 'StillCraft'],
  ['Home', 'Home'],
];
for (const [from, to] of NAV_LABELS) {
  h = h.replace(new RegExp(`>(\\s*)${from}(\\s*)<`, 'g'), `>$1${to}$2<`);
}

// applyFlightIA
// We can't easily call this, so let's skip it for now and see if the regex works

// The menu removal loop
for (const href of ['/service/congresses', '/projects']) {
  const esc = href.replace(/\//g, '\\/');
  const before = (h.match(new RegExp(`href="${esc}"`, 'g')) || []).length;
  h = h.replace(new RegExp(`<p\\b[^<>]*>\\s*<a\\b[^<>]*href="${esc}"[^<>]*>[\\s\\S]*?<\\/a>\\s*<\\/p>`, 'g'), '');
  const afterP = (h.match(new RegExp(`href="${esc}"`, 'g')) || []).length;
  console.log(`${href}: before=${before}, after p-removal=${afterP}`);
  h = h.replace(new RegExp(`<a\\b[^<>]*href="${esc}"[^<>]*>[\\s\\S]*?<\\/a>`, 'g'), '');
  const afterA = (h.match(new RegExp(`href="${esc}"`, 'g')) || []).length;
  console.log(`  after a-removal=${afterA}`);
  h = h.replace(new RegExp(`<p\\b[^<>]*>\\s*<\\/p>`, 'g'), '');
  h = h.replace(new RegExp(`<p\\b[^<>]*class="[^"]*"[^<>]*>\\s*<\\/p>`, 'g'), '');
}

const finalCount = (h.match(/href="\/projects"/g) || []).length;
console.log('final /projects count:', finalCount);