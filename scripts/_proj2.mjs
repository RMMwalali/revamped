import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/projects',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:/BACKUPS/STILLLCRAFT/_p.html', html);
// Find the card area
const cardIdx = html.indexOf('ProjectListSection_project');
console.log('ProjectListSection at', cardIdx);
if (cardIdx >= 0) {
  console.log('=== Card area ===');
  console.log(html.slice(cardIdx, cardIdx+2000));
}
// Also check for "00" context
const zeroIdx = html.indexOf('">00<');
if (zeroIdx >= 0) {
  console.log('\n=== 00 context ===');
  console.log(html.slice(Math.max(0,zeroIdx-200), zeroIdx+200));
}