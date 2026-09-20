import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/projects',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:/BACKUPS/STILLLCRAFT/_p.html', html);
// Check for missing script files
const scriptRe = /<script([^>]*)src="([^"]*)"/g;
let m, missing = 0;
while ((m = scriptRe.exec(html))) {
  const src = m[2];
  if (src.startsWith('/')) {
    const fs = require('fs');
    const filePath = 'dist' + src;
    if (!fs.existsSync(filePath)) {
      console.log('MISSING:', src);
      missing++;
    }
  }
}
console.log('Missing scripts:', missing);
// Check flight data
const flightIdx = html.indexOf('self.__next_f');
const flightBlock = html.slice(flightIdx);
let inStr = false, esc = false;
for (let i = 0; i < flightBlock.length; i++) {
  const c = flightBlock[i];
  if (inStr) {
    if (esc) { esc = false; }
    else if (c === '\\') { esc = true; }
    else if (c === '"') { inStr = false; }
  } else {
    if (c === '"') inStr = true;
  }
}
console.log('Flight data unterminated:', inStr);