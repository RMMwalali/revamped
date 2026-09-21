import { applyNav, applyBrand, getBrand, applyGlobalSwaps } from './transform.mjs';
import { applyStructuredCMS, getCMS } from './cms.mjs';
import { getOverrides, applyOverrides } from './overrides.mjs';
import http from 'node:http';

const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});

let h = html;
h = applyBrand(h, await getBrand());
h = applyNav(h, '/');
console.log('after applyNav:', (h.match(/\/projects/g)||[]).length);

const overrides = await getOverrides('/');
h = applyOverrides(h, overrides, {});
console.log('after applyOverrides:', (h.match(/\/projects/g)||[]).length);

h = applyGlobalSwaps(h, '/');
console.log('after applyGlobalSwaps:', (h.match(/\/projects/g)||[]).length);

const cms = await getCMS();
h = await applyStructuredCMS(h, cms, '/');
console.log('after applyStructuredCMS:', (h.match(/\/projects/g)||[]).length);

// Find all /projects in the result
const re = /\/projects/g;
let m, i = 0;
while ((m = re.exec(h)) !== null) {
  const ctx = h.slice(Math.max(0,m.index-40), m.index+60);
  console.log(`${i++}: pos=${m.index} ctx=${JSON.stringify(ctx)}`);
}