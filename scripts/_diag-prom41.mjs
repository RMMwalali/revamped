import fs from 'fs';
function cutBalancedDiv(html, start) {
  let depth = 0;
  let i = start;
  while (i < html.length) {
    if (html.startsWith('</div', i) && /[\s>]/.test(html[i + 5] || '')) {
      const gt = html.indexOf('>', i);
      if (gt < 0) return -1;
      depth--;
      i = gt + 1;
      if (depth === 0) return i;
    } else if (html.startsWith('<div', i) && /[\s>]/.test(html[i + 4] || '')) {
      const gt = html.indexOf('>', i);
      if (gt < 0) return -1;
      if (html[gt - 1] !== '/') depth++;
      i = gt + 1;
    } else {
      i++;
    }
  }
  return -1;
}
for (const [name, file] of [['src', 'dist/index.html'], ['served', 'dist/_served.html']]) {
  const h = fs.readFileSync(file, 'utf8');
  const s = h.indexOf('<div class="css-5ohagv">');
  if (s < 0) { console.log(name, 'no band'); continue; }
  const e = cutBalancedDiv(h, s);
  const band = h.slice(s, e);
  console.log('\n' + name, 'start', s, 'end', e, 'len', e - s);
  console.log('selftest balanced:', (() => { let d = 0, i = s; for (; i < e; i++) { const c = h[i]; if (c === '<' && h.startsWith('<div', i)) d++; if (c === '<' && h.startsWith('</div>', i)) d--; } return d; })());
  console.log('first 700 chars:', JSON.stringify(band.slice(0, 700)));
  console.log('last 300 chars:', JSON.stringify(band.slice(-300)));
  console.log('after band:', JSON.stringify(h.slice(e, e + 200)));
  console.log('before band 120:', JSON.stringify(h.slice(s - 120, s)));
  // what's inside band markers
  console.log('band markers:', ['css-lvtjah','css-12ybk68','css-41c6dw','css-1w327c','css-woa673','css-zme24x','css-jp7bfh','css-qg5m4o','css-h3wi0l','alt="Leader"','EventSliderActions','see full case study','css-t8q91a','css-9nnxn7','css-olu4sz','css-3rlusp','css-ctko3l'].map(m => [m, band.includes(m)]));
}