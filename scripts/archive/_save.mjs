import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:\\BACKUPS\\STILLLCRAFT\\_home4.html', html);
// Find the sc-voices section
const voicesIdx = html.indexOf('sc-voices');
const sectionStart = html.indexOf('<section class="sc-voices">', voicesIdx);
const sectionEnd = html.indexOf('</section>', sectionStart);
console.log('section from', sectionStart, 'to', sectionEnd);
// Show the section
const section = html.slice(sectionStart, sectionEnd+10);
console.log('Section length:', section.length);
console.log('Has CLIENT VOICES:', section.includes('CLIENT VOICES'));
console.log('Has testimonial cards:', (section.match(/data-sc-voice="testimonial"/g)||[]).length);
// Check the parent wrapper
const before = html.slice(Math.max(0,sectionStart-500), sectionStart);
console.log('\n=== Before section ===');
console.log(before.slice(-500));
// Check after
const after = html.slice(sectionEnd, sectionEnd+500);
console.log('\n=== After section ===');
console.log(after.slice(0, 500));