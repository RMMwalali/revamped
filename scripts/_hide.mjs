import http from 'node:http';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
// Check for CSS rules that might hide the section
const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/g;
let m;
while ((m = styleRe.exec(html))) {
  const css = m[1];
  if (css.includes('css-5ohagv') || css.includes('sc-voices') || css.includes('css-0')) {
    const rules = [...css.matchAll(/[^{}]*\{[^{}]*\}/g)];
    for (const r of rules) {
      if (/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0/.test(r[0])) {
        console.log('HIDDEN RULE:', r[0].slice(0, 200));
      }
    }
  }
}
// Check the parent elements of sc-voices
const voicesIdx = html.indexOf('sc-voices');
let pos = voicesIdx;
let depth = 0;
while (pos > 0 && depth < 10) {
  const tagStart = html.lastIndexOf('<div', pos);
  if (tagStart < 0) break;
  const tagEnd = html.indexOf('>', tagStart);
  if (tagEnd < 0) break;
  const tag = html.slice(tagStart, tagEnd+1);
  if (/class="[^"]*css-[^"]*"/.test(tag) && /display\s*:\s*none|visibility\s*:\s*hidden/.test(tag)) {
    console.log('HIDDEN PARENT:', tag.slice(0, 300));
  }
  pos = tagStart;
  depth++;
}
console.log('Done checking');