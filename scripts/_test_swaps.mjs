import { applyNav, applyGlobalSwaps, GLOBAL_SWAPS } from './transform.mjs';
import http from 'node:http';

const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});

let h = applyNav(html, '/');
console.log('after applyNav:', (h.match(/\/projects/g)||[]).length);

// Test each GLOBAL_SWAPS pair individually
for (const [from, to] of GLOBAL_SWAPS) {
  if (typeof from !== 'string') continue;
  // Skip pairs that don't contain /projects
  if (!from.includes('/projects') && !to.includes('/projects')) continue;
  const before = (h.match(/\/projects/g)||[]).length;
  // Apply just this pair
  const test = h.split(from).join(to);
  const after = (test.match(/\/projects/g)||[]).length;
  if (before !== after) {
    console.log(`PAIR "${from}" -> "${to}": ${before} -> ${after}`);
  }
}

// Also test the slash variant
for (const [from, to] of GLOBAL_SWAPS) {
  if (typeof from !== 'string') continue;
  const slash = [from.split('/').join('\\/'), to.split('/').join('\\/')];
  if (slash[0] !== from && slash[0].includes('/projects')) {
    const before = (h.match(/\/projects/g)||[]).length;
    const test = h.split(slash[0]).join(slash[1]);
    const after = (test.match(/\/projects/g)||[]).length;
    if (before !== after) {
      console.log(`SLASH "${slash[0]}" -> "${slash[1]}": ${before} -> ${after}`);
    }
  }
}