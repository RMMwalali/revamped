import http from 'node:http';
import { writeFileSync } from 'node:fs';

const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});

// Exact regex from transform.mjs line 2297
const href = '/projects';
const esc = href.replace(/\//g, '\\/');
const re = new RegExp(`<p\\b[^<>]*>\\s*<a\\b[^<>]*href="${esc}"[^<>]*>[\\s\\S]*?<\\/a>\\s*<\\/p>`, 'g');
console.log('regex source:', re.source);
const m = [...html.matchAll(re)];
console.log('matches:', m.length);
if (m.length) console.log('first:', m[0][0].slice(0,200));

// Also test with the actual footer HTML snippet
const idx = html.indexOf('href="/projects"');
console.log('href="/projects" at index:', idx);
if (idx > 0) {
  // find the enclosing <p>
  const before = html.slice(Math.max(0,idx-200), idx);
  const pStart = before.lastIndexOf('<p');
  const after = html.slice(idx, idx+200);
  const pEnd = after.indexOf('</p>');
  const full = html.slice(Math.max(0,idx-200), idx + after.slice(0,pEnd+5).length);
  console.log('full p block:', full.slice(pStart));
}