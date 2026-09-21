import { readFile } from 'node:fs/promises';
import { getOverrides, applyOverrides } from './overrides.mjs';
import { getBrand, applyBrand, applyNav, stripThirdParty, removeBadges } from './transform.mjs';
let html = await readFile('dist/index.html', 'utf8');
const key = '/';
html = stripThirdParty(html);
html = removeBadges(html);
html = applyBrand(html, await getBrand());
html = applyNav(html, key);
const t62 = () => /class="css-hj2ayb">([^<]*)<\/h4>[\s\S]{0,400}?data-sc-id="t-62"/.exec(html)?.[1];
console.log('after applyNav t-62 =', JSON.stringify(t62()));
const overrides = await getOverrides(key);
const h4 = () => (html.match(/<h4 data-sc-id="(t-\d+)" class="css-hj2ayb">([^<]*)<\/h4>/g) || []).join(' | ');
console.log('t62 before each H4 override:', h4());
let idx = 0;
for (const o of overrides) {
  if (!(o.tag === 'H4' && String(o.orig_html).includes('Mall'))) continue;
  html = applyOverrides(html, [o], {});
  console.log(`[${idx}] ${JSON.stringify(o.orig_html)} -> ${JSON.stringify(o.value)} (idx=${o.idx})`);
  console.log('  now:', h4());
  idx++;
}
console.log('H4 total after:', h4());