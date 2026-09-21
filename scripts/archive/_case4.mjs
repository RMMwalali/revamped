import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/project/easter-at-galleria-mall',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:\\BACKUPS\\STILLLCRAFT\\_case2.html', html);
// Find "In Their Words" and "Placeholder" context
for (const term of ['In Their Words', 'Placeholder', 'icon icon', '00']) {
  const i = html.indexOf(term);
  if (i >= 0) {
    console.log(`\n=== "${term}" at ${i} ===`);
    console.log(html.slice(Math.max(0,i-300), i+500).replace(/\n/g,' '));
  }
}