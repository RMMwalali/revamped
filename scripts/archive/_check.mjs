import http from 'node:http';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
console.log('len:', html.length);
console.log('has /projects:', html.includes('href="/projects"'));
console.log('has Piedmont:', html.includes('Piedmont'));
console.log('has StillCraft:', html.includes('StillCraft'));
console.log('has Iventions:', html.includes('Iventions'));
// Check footer area
const idx = html.indexOf('href="/projects"');
console.log('first /projects at:', idx);
if (idx > 0) console.log('context:', html.slice(idx-50, idx+100));