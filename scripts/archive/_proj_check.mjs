import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/projects',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:/BACKUPS/STILLLCRAFT/_p.html', html);
// Check for unterminated strings in inline scripts
const scriptRe = /<script>([\s\S]*?)<\/script>/g;
let m, bad = 0;
while ((m = scriptRe.exec(html))) {
  const content = m[1];
  if (content.length < 20) continue;
  let inStr = false, esc = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inStr) {
      if (esc) { esc = false; }
      else if (c === '\\') { esc = true; }
      else if (c === '"') { inStr = false; }
    }
  }
  if (inStr) { bad++; console.log('UNTERMINATED STRING in script len', content.length); }
}
console.log('Bad scripts:', bad);
// Check for the flight data
const flightIdx = html.indexOf('self.__next_f');
console.log('flight at', flightIdx);
// Check for any obvious issues
const bodyStart = html.indexOf('<body');
const bodyEnd = html.indexOf('</body>');
const body = html.slice(bodyStart, bodyEnd);
// Check for Iventions
const iventions = [...body.matchAll(/Iventions/g)].filter(m => {
  const ctx = body.slice(Math.max(0,m.index-50), m.index+50);
  return !ctx.includes('replace(/IVENTIONS') && !ctx.includes("replace(/Iventions");
});
console.log('Iventions in body:', iventions.length);
// Check copyright
const copyrights = [...html.matchAll(/Copyright[^<]*/g)];
console.log('Copyrights:', copyrights.map(c=>c[0]));