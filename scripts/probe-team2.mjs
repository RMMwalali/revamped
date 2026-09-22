import { writeFileSync } from 'node:fs';
const html = await (await fetch('http://localhost:3105/about')).text();
const lines = [];

// 1) served static markup (post-transform, pre-hydration) roster markers
lines.push('## served /about static markup ##');
lines.push('sc-team__member = ' + (html.match(/sc-team__member/g) || []).length);
lines.push('sc-team__mono   = ' + (html.match(/sc-team__mono/g) || []).length);
lines.push('sc-vo           = ' + (html.match(/class="sc-vo"/g) || []).length);
lines.push('sc-vo-media img = ' + (html.match(/sc-vo-media/g) || []).lengthonge);
lines.push('Join our team   = ' + html.includes('Join our team'));

// 2) team JSON payload — grab the escaped members array and pull title/photo
const KEY = '\\u0022members\\u0022:[';
const i0 = html.indexOf(KEY);
lines.push('\n## flight members array ##');
lines.push('members["idx]' = ' + i0);
if (i0 >= 0) {
  const start = i0 + KEY.length;
  let depth = 1, j = start;
  const cap = html.indexOf('end', start);
  while (j < html.length && depth > 0 && j - start < 6_000_000) {
    const chunk = html[j];
    if (chunk === '\\' && (html[j + 1] === '\\' || html[j + 1] === 'u' || html[j + 1] === '"')) { j += 2; continue; }
    if (chunk === '[') depth++;
    else if (chunk === ']') { depth--; if (depth === 0) break; }
    j++;
  }
  const raw = html.slice(start, j);
  // decode the double-escaped flight JSON into readable JSON
  let decoded = '';
  try { decoded = JSON.parse('"' + raw.replace(/^"?/, '').replace(/"?$/, '') + '"'); } catch {}
  // simpler: just visually find title + sourceUrl pairs in the raw chunk
  const re = /\u003c|title\\u0022:\\u0022([^\\]{1,50}?)\\u0022[\\s\\S]{0,1200}?sourceUrl\\u0022:\\u0022([^"\\]+\.(?:jpg|png|webp))[^\\]*\u0022/g;
}
