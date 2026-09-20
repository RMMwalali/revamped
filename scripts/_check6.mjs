import http from 'node:http';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});

// Check if the debug message is in the response
console.log('has [applyNav]:', html.includes('[applyNav]'));
console.log('has href="/projects":', html.includes('href="/projects"'));
console.log('len:', html.length);

// Check what the server is actually serving
const idx = html.indexOf('href="/projects"');
if (idx >= 0) {
  console.log('context:', JSON.stringify(html.slice(idx-50, idx+80)));
}