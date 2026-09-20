import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:\\BACKUPS\\STILLLCRAFT\\_home3.html', html);
// Find the sc-voices section in the static HTML
const voicesIdx = html.indexOf('sc-voices');
console.log('sc-voices at', voicesIdx);
// Show 3000 chars around it
console.log('=== sc-voices section ===');
console.log(html.slice(voicesIdx-100, voicesIdx+3000).replace(/\n/g,' '));