import fs from 'fs';
const h = fs.readFileSync('dist/_served.html', 'utf8');
const s = fs.readFileSync('dist/index.html', 'utf8');
// how is 3930 ref'd in script srcs (non-flight)? already saw /assets/root/_. Check _next usage
const direct = h.match(/<script[^>]*src="[^"]*3930-5a2b1ec52287565c[^"]*"/g);
console.log('direct 3930 script tags', JSON.stringify(direct));
for (const m of ['/_next/static/chunks/3930-5a2b1ec52287565c']) console.log(m, h.indexOf(m));
// is css-5ohagv unique in src and served?
let c=-1,n=0; while((c=h.indexOf('css-5ohagv',c+1))>=0)n++;
console.log('css-5ohagv in served', n);
c=-1;n=0; while((c=s.indexOf('css-5ohagv',c+1))>=0)n++;
console.log('css-5ohagv in src', n);
// does the events band same structure appear is the "about" or other pages? check dist for other index.html with css-5ohagv
import path from 'path';
const pages=[];
(function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(e.name==='index.html'){ try{ if(fs.readFileSync(p,'utf8').includes('css-5ohagv')) pages.push(p);}catch{} } } })('dist');
console.log('pages with events band', pages);