import http from 'node:http';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
// Check if the debug message is in the response
console.log('has [applyNav]:', html.includes('[applyNav]'));
// Check if /projects is in the response
console.log('has /projects:', html.includes('href="/projects"'));
// Check the footer area
const idx = html.indexOf('href="/projects"');
console.log('first /projects at:', idx);