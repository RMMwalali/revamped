// Bisect inside applyFlightIA on the insight page.
import { readFile, writeFile } from 'node:fs/promises';

const EQ = '\\"';
const linkObj = (title, url) =>
  `{${EQ}link${EQ}:{${EQ}target${EQ}:${EQ}${EQ},${EQ}title${EQ}:${EQ}${title}${EQ},${EQ}url${EQ}:${EQ}${url}${EQ}}}`;
const ORIGIN = 'https://iventions.com';
const MENU_DROP_URLS = ['/about/', '/service/congresses/', '/service/sports/'];
const MENU_TITLES = { About: 'Home', Events: 'Brand Activations', Exhibits: 'Malls & Retail', Work: 'Projects', Insights: 'Blog' };

const raw = await readFile('dist/insight/iventions-london-hub/index.html', 'utf8');
const variants = { 'f00-raw': raw };

function eachPush(html, fn) {
  const parts = html.split('self.__next_f.push(');
  if (parts.length < 2) return html;
  for (let i = 1; i < parts.length; i++) parts[i] = fn(parts[i], i);
  return parts.join('self.__next_f.push(');
}
let h = raw;
// step 1: slug/title swaps
h = eachPush(h, (s) => {
  s = s.split(`"slug":"events","title":"Events"`).join(`"slug":"events","title":"Brands and Corporates"`);
  s = s.split(`\\"slug\\":\\"events\\",\\"title\\":\\"Events\\"`).join(`\\"slug\\":\\"events\\",\\"title\\":\\"Brands and Corporates\\"`);
  s = s.split(`"slug":"exhibits","title":"Exhibits"`).join(`"slug":"exhibits","title":"Malls Programming and Retail"`);
  s = s.split(`\\"slug\\":\\"exhibits\\",\\"title\\":\\"Exhibits\\"`).join(`\\"slug\\":\\"exhibits\\",\\"title\\":\\"Malls Programming and Retail\\"`);
  s = s.split(`"slug":"events","title":"Events"`).join(`"slug":"events","title":"Brands and Corporates"`);
  s = s.split(`\\"slug\\":\\"events\\",\\"title\\":\\"Events\\"`).join(`\\"slug\\":\\"events\\",\\"title\\":\\"Brands and Corporates\\"`);
  s = s.split(`"slug":"exhibits","title":"Exhibits"`).join(`"slug":"exhibits","title":"Malls Programming and Retail"`);
  s = s.split(`\\"slug\\":\\"exhibits\\",\\"title\\":\\"Exhibits\\"`).join(`\\"slug\\":\\"exhibits\\",\\"title\\":\\"Malls Programming and Retail\\"`);
  return s;
});
variants['f01-slugswap'] = h;
// step 2: drop link objects
h = eachPush(h, (s) => {
  for (const u of MENU_DROP_URLS) {
    const title = { '/about/': 'About', '/service/congresses/': 'Congresses', '/service/sports/': 'Sports' }[u];
    s = s.split(linkObj(title, ORIGIN + u) + ',').join('');
  }
  return s;
});
variants['f02-drop'] = h;
// step 3: rename titles
h = eachPush(h, (s) => {
  for (const [from, to] of Object.entries(MENU_TITLES)) {
    if (from === 'About') continue;
    s = s.split(`${EQ}title${EQ}:${EQ}${from}${EQ}`).join(`${EQ}title${EQ}:${EQ}${to}${EQ}`);
  }
  return s;
});
variants['f03-rename'] = h;
// step 4: prepend Home
h = eachPush(h, (s) => {
  const homeObj = linkObj('Home', ORIGIN + '/home/');
  const brandObj = linkObj('Brand Activations', ORIGIN + '/service/events/');
  return s.split(`${EQ}menus${EQ}:[${brandObj}`).join(`${EQ}menus${EQ}:[${homeObj},${brandObj}`);
});
variants['f04-prepend'] = h;
// step 5: reorder malls
h = eachPush(h, (s) => {
  const brandObj = linkObj('Brand Activations', ORIGIN + '/service/events/');
  const mallsObj = linkObj('Malls & Retail', ORIGIN + '/service/exhibits/');
  return s.split(brandObj + ',' + mallsObj).join(mallsObj + ',' + brandObj);
});
variants['f05-reorder'] = h;
// step 6: localize origin
h = eachPush(h, (s) => s.split(ORIGIN + '/').join('/'));
variants['f06-localize'] = h;
// step 7: brand mentions
h = eachPush(h, (s) => {
  s = s.split(` Iventions${EQ}`).join(` StillCraft Events${EQ}`);
  s = s.split(` IVENTIONS${EQ}`).join(` STILLCRAFT EVENTS${EQ}`);
  return s;
});
variants['f07-brand'] = h;
for (const [n, v] of Object.entries(variants)) await writeFile(`dist/_bisect-${n}.html`, v);
console.log('wrote', Object.keys(variants).length);
process.exit(0);
