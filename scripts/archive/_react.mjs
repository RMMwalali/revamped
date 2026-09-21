import http from 'node:http';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
// Check if the sc-voices section is inside a React root that might wipe it
const voicesIdx = html.indexOf('sc-voices');
// Find the nearest parent div with class containing "css-0" or "css-5ohagv"
const before = html.slice(Math.max(0,voicesIdx-2000), voicesIdx);
console.log('=== Before sc-voices (last 2000 chars) ===');
console.log(before.slice(-1500).replace(/\n/g,' '));
// Check if there's a React root marker
const reactRoot = html.indexOf('__next');
console.log('\n__next at', reactRoot);
// Check the injected JS
const secIdx = html.indexOf('var sec=');
console.log('\n=== Injected JS ===');
console.log(html.slice(secIdx, secIdx+2000));