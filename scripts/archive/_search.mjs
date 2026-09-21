import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:\\BACKUPS\\STILLLCRAFT\\_home5.html', html);
// Search for the placeholder terms the user mentioned
for (const term of ['participants', 'industry', 'event type', 'see full case study', '00', 'icon icon', 'location']) {
  const i = html.indexOf(term);
  console.log(`${term}: ${i >= 0 ? 'FOUND at ' + i : 'not found'}`);
}
// Check the dist HTML directly
const distHtml = require('fs').readFileSync('dist/index.html', 'utf8');
for (const term of ['participants', 'industry', 'event type', 'see full case study', '00']) {
  const i = distHtml.indexOf(term);
  console.log(`dist ${term}: ${i >= 0 ? 'FOUND at ' + i : 'not found'}`);
}