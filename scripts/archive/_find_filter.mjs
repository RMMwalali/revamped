import http from 'node:http';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});

// Find /projects/filter occurrences
const re = /\/projects\/filter/g;
let m, i = 0;
while ((m = re.exec(html)) !== null) {
  const ctx = html.slice(Math.max(0,m.index-30), m.index+50);
  console.log(`${i++}: pos=${m.index} ctx=${JSON.stringify(ctx)}`);
}
console.log('total /projects/filter:', i);