import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:\\BACKUPS\\STILLLCRAFT\\_home5.html', html);
// Check the h3 class in the slider
const h3Matches = [...html.matchAll(/<h3[^>]*class="([^"]*)"[^>]*>/g)];
console.log('h3 classes:', [...new Set(h3Matches.map(m=>m[1]))]);
// Check for css-zwnf0y
console.log('css-zwnf0y count:', (html.match(/css-zwnf0y/g)||[]).length);
// Check for css-1csbsx5
console.log('css-1csbsx5 count:', (html.match(/css-1csbsx5/g)||[]).length);
// Check the HL_NEW data
const distHtml = require('fs').readFileSync('dist/index.html', 'utf8');
console.log('dist css-zwnf0y count:', (distHtml.match(/css-zwnf0y/g)||[]).length);
console.log('dist css-1csbsx5 count:', (distHtml.match(/css-1csbsx5/g)||[]).length);