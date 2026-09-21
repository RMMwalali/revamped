import http from 'node:http';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
// Check the inject function
const injectIdx = html.indexOf('var inject=');
console.log('=== Inject function ===');
console.log(html.slice(injectIdx, injectIdx+800));
// Check if there's a CSS display:none on the parent
const css5ohagvIdx = html.indexOf('css-5ohagv');
console.log('\n=== css-5ohagv CSS rules ===');
// Find all CSS rules that mention css-5ohagv
const cssRe = /[^{}]*css-5ohagv[^{}]*\{[^{}]*\}/g;
const matches = [...html.matchAll(cssRe)];
matches.forEach(m=>console.log('  ', m[0]));
// Check for visibility:hidden or display:none near the section
const sectionArea = html.slice(Math.max(0,css5ohagvIdx-500), css5ohagvIdx+500);
const hiddenRules = [...sectionArea.matchAll(/visibility:\s*hidden|display:\s*none/g)];
console.log('\nHidden rules near section:', hiddenRules.length);