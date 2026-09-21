import http from 'node:http';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
console.log('has /projects:', html.includes('href="/projects"'));
console.log('has Piedmont:', html.includes('Piedmont'));
console.log('has StillCraft:', html.includes('StillCraft'));
console.log('has Iventions:', html.includes('Iventions'));
console.log('len:', html.length);