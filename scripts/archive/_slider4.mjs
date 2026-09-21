import http from 'node:http';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
// Check the highlight projects slider area
const sliderIdx = html.indexOf('Highlight projects');
console.log('=== Highlight projects slider ===');
console.log(html.slice(sliderIdx-500, sliderIdx+3000).replace(/\n/g,' '));