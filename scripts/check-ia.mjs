const get = async (p) => (await fetch('http://127.0.0.1:3000' + p)).text();
const h = await get('/');
console.log('title:', /<title>(.*?)<\/title>/.exec(h)[1]);
for (const s of ['Brand Activations', 'Malls &amp; Retail', '>Projects<', '>Blog<', '>Contact<', '>Home<']) {
  console.log(JSON.stringify(s), '=>', h.includes(s));
}
for (const s of ['href="/about"', 'href="/service/congresses"', 'href="/service/sports"']) {
  console.log(s, 'present=>', h.includes(s));
}
const e = await get('/service/events');
console.log('events h1:', /<h1\b[^<>]*>(.*?)<\/h1>/.exec(e)[1].slice(0, 80));
const x = await get('/service/exhibits');
console.log('exhibits h1:', /<h1\b[^<>]*>(.*?)<\/h1>/.exec(x)[1].slice(0, 80));
const i = await get('/insights');
console.log('insights title:', /<title>(.*?)<\/title>/.exec(i)[1]);
