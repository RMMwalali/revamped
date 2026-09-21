const get = async (p) => (await (await fetch('http://127.0.0.1:3105' + p)).text());
const home = await get('/');
const ulm = home.match(/<ul class="styles_menus__items__hZxYX">([\s\S]*?)<\/ul>/);
console.log('HEADER:', ulm ? [...ulm[1].matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]*)/g)].map(m => m[2].trim() + ' -> ' + m[1]) : 'NONE');
// footer explore: first menu box
const boxes = [...home.matchAll(/<div class="styles_contents_menu___Mcbo">([\s\S]*?)<\/div><\/div>/g)];
console.log('FOOTER-EXPLORE:', boxes.length ? [...boxes[0][1].matchAll(/href="([^"]+)"[^>]*>\s*<span[^>]*>\s*([^<]*)/g)].map(m => m[2].trim() + ' -> ' + m[1]) : 'NONE');
// cards: h4 + following anchor
for (const m of home.matchAll(/<h4[^>]*class="css-hj2ayb"[^>]*>([^<]+)<\/h4>/g)) {
  const fwd = home.slice(m.index, m.index + 12000);
  const a = fwd.match(/<a title="([^"]+)" href="([^"]+)"/);
  console.log('CARD:', JSON.stringify(m[1]), '|', a ? a[1] + ' -> ' + a[2] : 'NO LINK');
}
console.log('HOME title:', (home.match(/<title>([^<]*)/) || [])[1]);
for (const p of ['/service/events', '/service/exhibits', '/service/congresses']) {
  const t = await get(p);
  console.log(p, '| TITLE:', (t.match(/<title>([^<]*)/) || [])[1], '| H1:', ((t.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 60));
}
console.log('stale7051 served:', home.split('6e38258f').length - 1);
