import http from 'node:http';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
// Check the highlight projects card structure
const sliderIdx = html.indexOf('Highlight projects');
const cardIdx = html.indexOf('css-lgaqy6', sliderIdx);
console.log('css-lgaqy6 at', cardIdx);
if (cardIdx >= 0) {
  console.log('=== Card area ===');
  console.log(html.slice(cardIdx-200, cardIdx+3000).replace(/\n/g,' '));
}
// Also check for "see full case study" text
const sfcsIdx = html.toLowerCase().indexOf('see full case study');
console.log('\nsee full case study at', sfcsIdx);
// Check for "00" 
const zeroIdx = html.indexOf('">00<');
console.log('00 at', zeroIdx);
// Check for participants/industry/event type
for (const term of ['participants', 'industry', 'event type', 'Event Type', 'Industry']) {
  const i = html.indexOf(term);
  console.log(`${term} at`, i);
}