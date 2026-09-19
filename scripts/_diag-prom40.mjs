import fs from 'fs';
const s = fs.readFileSync('dist/index.html', 'utf8');
const start = s.indexOf('<div class="css-5ohagv">');
console.log('band start', start);
// find balanced close of css-5ohagv using quick counting via '</div>'
let depth = 0, i = start, end = -1;
while (i < s.length) {
  const op = s.indexOf('<div class="css-5ohagv">', i);
  const cl = s.indexOf('</div>', i);
  const nxt = op >= 0 && op < cl ? op : cl;
  if (nxt === cl) { depth--; if (depth === 0) { end = cl + 6; break; } i = cl + 6; }
  else { depth++; i = op + '<div class="css-5ohagv">'.length; }
}
console.log('band end', end, 'len', end - start);
const band = s.slice(start, end);
console.log('SLIDER_TEMPLATE_MARKS present:', ['UEFA','Pfizer','CordenPharma','Menzies','Midas','Adevinta','Adidas','FedEx','Turkish','VEEAM'].filter(m => band.includes(m)));
console.log('band has what sliders?', ['css-lvtjah','css-12ybk68','css-41c6dw','css-1w327c','css-woa673','css-zme24x','css-jp7bfh','css-qg5m4o'].map(m => [m, band.includes(m)]));
// what follows immediately after band end
console.log('after band', JSON.stringify(s.slice(end, end + 300)));
// what precedes band start
console.log('before band', JSON.stringify(s.slice(start - 200, start)));