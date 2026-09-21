import http from 'node:http';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
// Find the sc-voices section in the static HTML
const voicesIdx = html.indexOf('sc-voices');
// Find the section tag
const sectionStart = html.indexOf('<section class="sc-voices">', voicesIdx);
const sectionEnd = html.indexOf('</section>', sectionStart);
console.log('section from', sectionStart, 'to', sectionEnd);
console.log('=== Full sc-voices section ===');
console.log(html.slice(sectionStart, sectionEnd+10));