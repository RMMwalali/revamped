import http from 'node:http';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
// Show the sc-voices section
const voicesIdx = html.indexOf('sc-voices');
console.log('=== sc-voices section ===');
console.log(html.slice(voicesIdx-200, voicesIdx+1500).replace(/\n/g,' '));