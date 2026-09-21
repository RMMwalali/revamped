import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:/BACKUPS/STILLLCRAFT/_h.html', html);
// Test the regex
const re = /<p\b[^<>]*>\s*<a\b[^<>]*href="\/projects"[^<>]*>[\s\S]*?<\/a>\s*<\/p>/g;
const matches = [...html.matchAll(re)];
console.log('matches:', matches.length);
if (matches.length) console.log('first match:', matches[0][0].slice(0, 200));
// Also check for the class variant
const re2 = /<p\b[^<>]*class="[^"]*"[^<>]*>\s*<a\b[^<>]*href="\/projects"[^<>]*>[\s\S]*?<\/a>\s*<\/p>/g;
const matches2 = [...html.matchAll(re2)];
console.log('matches2:', matches2.length);