import { applyNav, applyGlobalSwaps, applyContentFlight } from './transform.mjs';
import { getOverrides } from './overrides.mjs';
import { getBrand } from './transform.mjs';
import http from 'node:http';
import { readFile } from 'node:fs/promises';

const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});

// Simulate the serve pipeline step by step
let h = html;
console.log('0. initial /projects:', (h.match(/href="\/projects"/g)||[]).length);

// applyBrand
const brand = await getBrand();
// We can't easily call applyBrand without the full import, skip for now

// applyNav
h = applyNav(h, '/');
console.log('1. after applyNav /projects:', (h.match(/href="\/projects"/g)||[]).length);

// applyOverrides
const overrides = await getOverrides('/');
// Can't easily call applyOverrides without full import

// applyGlobalSwaps
h = applyGlobalSwaps(h, '/');
console.log('2. after applyGlobalSwaps /projects:', (h.match(/href="\/projects"/g)||[]).length);

// applyContentFlight
h = applyContentFlight(h, '/');
console.log('3. after applyContentFlight /projects:', (h.match(/href="\/projects"/g)||[]).length);