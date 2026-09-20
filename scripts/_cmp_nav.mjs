import { applyNav } from './transform.mjs';
import http from 'node:http';

const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});

// Find all /projects in the input
const re_in = /\/projects/g;
let m, i = 0;
console.log('INPUT /projects:');
while ((m = re_in.exec(html)) !== null) {
  const ctx = html.slice(Math.max(0,m.index-30), m.index+50);
  console.log(`${i++}: pos=${m.index} ctx=${JSON.stringify(ctx)}`);
}

const out = applyNav(html, '/');
console.log('\nOUTPUT /projects:');
const re_out = /\/projects/g;
i = 0;
while ((m = re_out.exec(out)) !== null) {
  const ctx = out.slice(Math.max(0,m.index-30), m.index+50);
  console.log(`${i++}: pos=${m.index} ctx=${JSON.stringify(ctx)}`);
}