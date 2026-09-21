import http from 'node:http';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
// Check the highlight projects slider area for the card structure
const sliderIdx = html.indexOf('Highlight projects');
// Find the card container
const cardIdx = html.indexOf('css-lgaqy6', sliderIdx);
console.log('css-lgaqy6 at', cardIdx);
if (cardIdx >= 0) {
  console.log('=== Card area ===');
  console.log(html.slice(cardIdx-200, cardIdx+3000).replace(/\n/g,' '));
}