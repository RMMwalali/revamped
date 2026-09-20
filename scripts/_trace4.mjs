import { applyNav, applyBrand, getBrand, applyGlobalSwaps } from './transform.mjs';
import { applyStructuredCMS, getCMS } from './cms.mjs';
import { getOverrides, applyOverrides } from './overrides.mjs';
import http from 'node:http';

const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});

let h = html;
console.log('0. initial:', (h.match(/href="\/projects"/g)||[]).length);

h = applyBrand(h, await getBrand());
console.log('1. after brand:', (h.match(/href="\/projects"/g)||[]).length);

h = applyNav(h, '/');
console.log('2. after applyNav:', (h.match(/href="\/projects"/g)||[]).length);

const overrides = await getOverrides('/');
h = applyOverrides(h, overrides, {});
console.log('3. after overrides:', (h.match(/href="\/projects"/g)||[]).length);

h = applyGlobalSwaps(h, '/');
console.log('4. after globalSwaps:', (h.match(/href="\/projects"/g)||[]).length);

const cms = await getCMS();
h = await applyStructuredCMS(h, cms, '/');
console.log('5. after cms:', (h.match(/href="\/projects"/g)||[]).length);

// Find all href="/projects" in result
let m, i = 0;
const re = /href="\/projects"/g;
while ((m = re.exec(h)) !== null) {
  const ctx = h.slice(Math.max(0,m.index-30), m.index+60);
  console.log(`  ${i++}: pos=${m.index} ctx=${JSON.stringify(ctx)}`);
}