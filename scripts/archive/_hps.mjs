import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:\\BACKUPS\\STILLLCRAFT\\_home5.html', html);
// Find the highlight projects slider
const sliderIdx = html.indexOf('Highlight projects');
// Find the card container after the slider
const cardArea = html.slice(sliderIdx, sliderIdx + 5000);
// Find "participants", "industry", "event type", "location" in the card area
for (const term of ['participants', 'industry', 'event type', 'Event Type', 'location', 'Location', 'see full case study', '00']) {
  const i = cardArea.indexOf(term);
  console.log(`${term}: ${i >= 0 ? 'FOUND at ' + i : 'not found'}`);
}
// Show the card area
console.log('\n=== Card area (first 3000 chars) ===');
console.log(cardArea.slice(0, 3000));