import { readFileSync } from 'node:fs';
const html = readFileSync('dist/index.html', 'utf8');
function cutBalancedDiv(html, start) {
  let depth = 0, i = start;
  while (i < html.length) {
    if (html.startsWith('</div', i) && /[\s>]/.test(html[i + 5] || '')) {
      const gt = html.indexOf('>', i); if (gt < 0) return -1;
      depth--; i = gt + 1; if (depth === 0) return i;
    } else if (html.startsWith('<div', i) && /[\s>]/.test(html[i + 4] || '')) {
      const gt = html.indexOf('>', i); if (gt < 0) return -1;
      if (html[gt - 1] !== '/') depth++; i = gt + 1;
    } else i++;
  }
  return -1;
}
const start = html.indexOf('<div class="css-0"><div class="css-5ohagv">');
const end = cutBalancedDiv(html, start);
const stats = html.indexOf('<div class="css-0"><div class="css-4ysux8">');
console.log('start', start, 'end', end, 'stats', stats, 'end===stats', end === stats);
console.log('band inner head:', html.slice(start + 60, start + 300));
console.log('band inner tail:', html.slice(end - 300, end));