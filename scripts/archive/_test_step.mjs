import { applyNav } from './transform.mjs';
import http from 'node:http';

const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});

// Count /projects occurrences before
const beforeCount = (html.match(/href="\/projects"/g) || []).length;
console.log('before /projects count:', beforeCount);

// Apply just the regex from line 2297
let h = html;
const esc = '/projects'.replace(/\//g, '\\/');
h = h.replace(new RegExp(`<p\\b[^<>]*>\\s*<a\\b[^<>]*href="${esc}"[^<>]*>[\\s\\S]*?<\\/a>\\s*<\\/p>`, 'g'), '');
const afterPCount = (h.match(/href="\/projects"/g) || []).length;
console.log('after p-removal /projects count:', afterPCount);

// Now apply the bare anchor regex
h = h.replace(new RegExp(`<a\\b[^<>]*href="${esc}"[^<>]*>[\\s\\S]*?<\\/a>`, 'g'), '');
const afterACount = (h.match(/href="\/projects"/g) || []).length;
console.log('after a-removal /projects count:', afterACount);

// Now apply full applyNav
const out = applyNav(html, '/');
const outCount = (out.match(/href="\/projects"/g) || []).length;
console.log('after applyNav /projects count:', outCount);

// Check if applyNav is even being called - look at what it does first
console.log('html has NAV_LABELS:', html.includes('Iventions'));