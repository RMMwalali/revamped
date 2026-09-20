import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/projects',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:\\BACKUPS\\STILLLCRAFT\\_projects.html', html);
// Find the card area
for (const term of ['participants', 'industry', 'event type', 'see full case study', 'icon icon', '00', 'location']) {
  const i = html.indexOf(term);
  console.log(`${term}: ${i >= 0 ? 'FOUND at ' + i : 'not found'}`);
}
// Show the card area
const cardIdx = html.indexOf('ProjectListSection_project');
console.log('\nProjectListSection at', cardIdx);
if (cardIdx >= 0) {
  console.log(html.slice(cardIdx, cardIdx+2000));
}