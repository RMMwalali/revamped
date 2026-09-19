import fs from 'fs';
const src = fs.readFileSync('dist/index.html', 'utf8');
const s = src.indexOf('css-5ohagv');
console.log('src band start', s);
// print the region 2000 before band start to find heading
console.log(JSON.stringify(src.slice(s - 2500, s + 400)));
// find any heading text near: search for "what our" / "case" / "clients" / "see what"
for (const k of ['our clients','clients say','case study','What our','See what we create','see what we','testimonials','Testimonials']) {
  let i=-1;const hs=[];while((i=src.toLowerCase().indexOf(k.toLowerCase(),i+1))>=0)hs.push(i);
  console.log(k, hs.slice(0,6));
}