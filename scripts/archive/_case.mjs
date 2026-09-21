import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/project/easter-at-galleria-mall',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:\\BACKUPS\\STILLLCRAFT\\_case.html', html);
console.log('saved', html.length, 'bytes');
// Check for placeholder terms
for (const term of ['participants', 'industry', 'event type', 'see full case study', 'icon icon', '00', 'location']) {
  const i = html.indexOf(term);
  console.log(`${term}: ${i >= 0 ? 'FOUND at ' + i : 'not found'}`);
}
// Show the first 2000 chars
console.log('\n=== First 2000 chars ===');
console.log(html.slice(0, 2000));