import { applyNav } from './transform.mjs';
import { readFileSync } from 'node:fs';
import http from 'node:http';

const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});

const out = applyNav(html, '/');
const hasProjects = out.includes('href="/projects"');
console.log('after applyNav, /projects present:', hasProjects);
console.log('input length:', html.length, 'output length:', out.length);

// Check the footer area around position 224734
const slice = out.slice(224500, 225000);
console.log('footer slice:', slice.slice(0, 300));