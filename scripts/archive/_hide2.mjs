import http from 'node:http';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
// Check for CSS rules that might hide the section
const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/g;
let m;
while ((m = styleRe.exec(html))) {
  const css = m[1];
  // Check for visibility:hidden or display:none
  if (/visibility\s*:\s*hidden|display\s*:\s*none/.test(css)) {
    const rules = [...css.matchAll(/[^{}]*\{[^{}]*\}/g)];
    for (const r of rules) {
      if (/visibility\s*:\s*hidden|display\s*:\s*none/.test(r[0])) {
        console.log('HIDDEN RULE:', r[0].slice(0, 300));
      }
    }
  }
}
// Check the parent divs of sc-voices for inline styles
const voicesIdx = html.indexOf('sc-voices');
let pos = voicesIdx;
let depth = 0;
while (pos > 0 && depth < 15) {
  const tagStart = html.lastIndexOf('<div', pos);
  if (tagStart < 0) break;
  const tagEnd = html.indexOf('>', tagStart);
  if (tagEnd < 0) break;
  const tag = html.slice(tagStart, tagEnd+1);
  if (/style="[^"]*visibility|style="[^"]*display\s*:\s*none/.test(tag)) {
    console.log('INLINE HIDDEN PARENT:', tag.slice(0, 400));
  }
  pos = tagStart;
  depth++;
}
console.log('Done');