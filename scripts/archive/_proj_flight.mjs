import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/projects',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:/BACKUPS/STILLLCRAFT/_p.html', html);
// Find all self.__next_f.push chunks
const pushRe = /self\.__next_f\.push\((\[[\s\S]*?\])\)/g;
let pm, idx = 0, bad = 0;
while ((pm = pushRe.exec(html))) {
  idx++;
  const arg = pm[1];
  try { JSON.parse(arg); }
  catch(e) {
    bad++;
    console.log('push #' + idx + ' BAD:', e.message, 'len', arg.length);
    const p = e.message.match(/position (\d+)/);
    if (p) { const pos = Number(p[1]); console.log('  around:', JSON.stringify(arg.slice(Math.max(0,pos-80), pos+80))); }
    else console.log('  head:', JSON.stringify(arg.slice(0,200)));
  }
}
console.log('total pushes:', idx, 'bad:', bad);
// Also check for any script with type application/json
const jsonScriptRe = new RegExp('<script type="application/json"([^>]*)>([\\s\\S]*?)</script>', 'g');
let jm, jidx = 0;
while ((jm = jsonScriptRe.exec(html))) {
  jidx++;
  const content = jm[2];
  try { JSON.parse(content); console.log('json script #' + jidx + ' OK, len', content.length); }
  catch(e) { console.log('json script #' + jidx + ' BAD:', e.message); }
}
console.log('total json scripts:', jidx);