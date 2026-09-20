import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:/BACKUPS/STILLLCRAFT/_h.html', html);
// Find the sc-voices section
const voicesIdx = html.indexOf('sc-voices');
const sectionStart = html.indexOf('<section class="sc-voices">', voicesIdx);
const sectionEnd = html.indexOf('</section>', sectionStart);
const section = html.slice(sectionStart, sectionEnd+10);
console.log('Section length:', section.length);
console.log('Has CLIENT VOICES:', section.includes('CLIENT VOICES'));
console.log('Has testimonial cards:', (section.match(/data-sc-voice="testimonial"/g)||[]).length);
// Check the parent wrapper
const before = html.slice(Math.max(0,sectionStart-300), sectionStart);
console.log('\nBefore section:', before.slice(-300));
// Check if there's a React root that might wipe it
const reactRoot = html.indexOf('__next');
console.log('\n__next at', reactRoot);
// Check the injected JS
const injectIdx = html.indexOf('var inject=');
console.log('inject at', injectIdx);
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