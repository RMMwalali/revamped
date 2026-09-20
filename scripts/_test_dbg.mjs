import http from 'node:http';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});

// Test the exact regex from the debug code
const esc = '/projects'.replace(/\//g, '\\/');
console.log('esc:', JSON.stringify(esc));
const re = new RegExp(`href="${esc}"`, 'g');
console.log('regex source:', re.source);
const m = [...html.matchAll(re)];
console.log('matches:', m.length);