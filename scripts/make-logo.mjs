import { writeFileSync } from 'node:fs';

function letter(ch, x) {
  const p = (n) => +(x + n).toFixed(1);
  switch (ch) {
    case 'S':
      return `<path d="M${p(11.5)} 1.2H${p(7.8)}C${p(6.8)} 1.2 ${p(6)} 2 ${p(6)} 3V4.5H${p(12)}C${p(13.8)} 4.5 ${p(15)} 5.5 ${p(15)} 7.2C${p(15)} 9 ${p(13.8)} 10 ${p(12)} 10H${p(6)}V13H${p(12.8)}C${p(15.2)} 13 ${p(16.5)} 14.5 ${p(16.5)} 16.8C${p(16.5)} 19 ${p(15)} 19.8 ${p(12.8)} 19.8H${p(7.8)}C${p(6.8)} 19.8 ${p(6)} 19 ${p(6)} 18V16.8" fill="white"/>`;
    case 'T':
      return `<rect x="${p(0)}" y="0.5" width="8" height="3.5" fill="white"/><rect x="${p(2.6)}" y="0.5" width="2.8" height="19" fill="white"/>`;
    case 'I':
      return `<rect x="${p(0)}" y="0.5" width="4" height="19" fill="white"/>`;
    case 'L':
      return `<rect x="${p(0)}" y="0.5" width="4" height="19" fill="white"/><rect x="${p(0)}" y="15.5" width="12" height="4" fill="white"/>`;
    case 'C':
      return `<path d="M${p(14)} 19.5L${p(9.8)} 15.5C${p(8.8)} 16.5 ${p(7.2)} 17.2 ${p(5)} 17.2C${p(1.8)} 17.2 ${p(0)} 15 ${p(0)} 12.2C${p(0)} 8.5 ${p(3.5)} 7 ${p(8.5)} 6.2V5.5C${p(8.5)} 4 ${p(7.5)} 3.2 ${p(5.8)} 3.2C${p(4.2)} 3.2 ${p(3)} 3.8 ${p(2.8)} 5H${p(0)}C${p(0.2)} 2.5 ${p(2.2)} 1.2 ${p(5.5)} 1.2C${p(9)} 1.2 ${p(11)} 3 ${p(11)} 5.8V19.5H${p(14)}ZM${p(8)} 13.2C${p(9.2)} 13.2 ${p(10)} 12.6 ${p(10)} 11.5V9C${p(9.4)} 9.1 ${p(8.5)} 9.2 ${p(7.8)} 9.3C${p(5)} 9.6 ${p(3)} 10.3 ${p(3)} 12C${p(3)} 13.2 ${p(4)} 13.2 ${p(5.5)} 13.2H${p(8)}Z" fill="white"/>`;
    case 'R':
      return `<path d="M${p(0)} 0.5H${p(6)}L${p(12.5)} 10C${p(13.5)} 11.5 ${p(14.2)} 12.8 ${p(14.8)} 13.8V0.5H${p(18)}V19.5H${p(12.5)}L${p(6)} 10C${p(5.1)} 8.5 ${p(4.3)} 7.2 ${p(3.5)} 6.2V19.5H${p(0)}V0.5Z" fill="white"/>`;
    case 'A':
      return `<path d="M${p(12)} 19.5L${p(4.5)} 1.3H${p(1.5)}L${p(-6)} 19.5H${p(-3)}L${p(-1)} 14.5H${p(7)}L${p(9)} 19.5H${p(12)}ZM${p(-2.2)} 11.5L${p(1.5)} 3.5L${p(5)} 11.5H${p(-2.2)}Z" fill="white"/>`;
    case 'F':
      return `<rect x="${p(0)}" y="0.5" width="13" height="3.5" fill="white"/><rect x="${p(0)}" y="0.5" width="4" height="19" fill="white"/><rect x="${p(0)}" y="9" width="11" height="3.3" fill="white"/>`;
    default:
      return '';
  }
}

const widths = { S: 18, T: 11, I: 7, L: 15, C: 16, R: 20, A: 17, F: 16 };
const spacing = { S: 3, T: 3, I: 3, L: 3, C: 3, R: 3, A: 3, F: 2 };
const word = 'STILLCRAFT';

let x = 0;
const parts = [];
for (const ch of word) {
  parts.push(letter(ch, x));
  x += widths[ch] + spacing[ch];
}

const width = x;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" viewBox="0 0 ${width} 20" fill="none">
  <g style="mix-blend-mode:difference">
    ${parts.join('\n    ')}
  </g>
</svg>`;

writeFileSync('dist/upload/icon-logo.svg', svg, 'utf8');
writeFileSync('dist/assets/root/upload/icon-logo.svg', svg, 'utf8');
writeFileSync('dist/assets/cms/wp-content/uploads/2025/06/icon-logo.svg', svg, 'utf8');
console.log(`wrote STILLCRAFT logo (${width}x20)`);
