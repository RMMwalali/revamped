import { applyNav } from './transform.mjs';
import http from 'node:http';

const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});

// Count href="/projects" specifically
const re_in = /href="\/projects"/g;
const inCount = (html.match(re_in) || []).length;
console.log('INPUT href="/projects":', inCount);

const out = applyNav(html, '/');
const outCount = (out.match(/href="\/projects"/g) || []).length;
console.log('OUTPUT href="/projects":', outCount);

// Count /projects/ (with trailing slash, in flight JSON)
const re_slash = /\/projects\//g;
const inSlash = (html.match(re_slash) || []).length;
const outSlash = (out.match(re_slash) || []).length;
console.log('INPUT /projects/:', inSlash);
console.log('OUTPUT /projects/:', outSlash);

// Find all href="/projects" in output
let m, i = 0;
while ((m = re_in.exec(out)) !== null) {
  const ctx = out.slice(Math.max(0,m.index-30), m.index+50);
  console.log(`${i++}: pos=${m.index} ctx=${JSON.stringify(ctx)}`);
}