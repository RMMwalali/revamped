import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:\\BACKUPS\\STILLLCRAFT\\_home6.html', html);
// Check the injected JS
const injectIdx = html.indexOf('var inject=');
console.log('inject at', injectIdx);
// Show the injected JS
console.log('\n=== Injected JS ===');
console.log(html.slice(injectIdx, injectIdx+1500));
// Check if the section is in the static HTML
const sectionStart = html.indexOf('<section class="sc-voices">');
console.log('\nsection at', sectionStart);
// Check the parent wrapper
const before = html.slice(Math.max(0,sectionStart-200), sectionStart);
console.log('Before section:', before.slice(-200));
// Check if there's a React root that might wipe it
const reactRoot = html.indexOf('__next');
console.log('\n__next at', reactRoot);
// Check if the section is inside a script tag
const scriptStart = html.lastIndexOf('<script', sectionStart);
const scriptEnd = html.indexOf('</script>', sectionStart);
console.log('section in script:', scriptStart >= 0 && scriptEnd >= 0 && scriptStart < sectionStart && sectionStart < scriptEnd);
// Check for CSS that might hide it
const cssIdx = html.indexOf('.sc-voices{');
console.log('sc-voices CSS at', cssIdx);
// Check for visibility:hidden or display:none near the section
const nearSection = html.slice(Math.max(0,sectionStart-1000), sectionStart);
const hiddenRules = [...nearSection.matchAll(/visibility:\s*hidden|display:\s*none/g)];
console.log('Hidden rules near section:', hiddenRules.length);