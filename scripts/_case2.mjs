import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/project/easter-at-galleria-mall',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:\\BACKUPS\\STILLLCRAFT\\_case.html', html);
// Find the placeholder sections
for (const term of ['participants', 'industry', 'event type', '00', 'location']) {
  const i = html.indexOf(term);
  if (i >= 0) {
    console.log(`\n=== "${term}" at ${i} ===`);
    console.log(html.slice(Math.max(0,i-200), i+500).replace(/\n/g,' '));
  }
}