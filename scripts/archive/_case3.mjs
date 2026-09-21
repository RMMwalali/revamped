import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/project/easter-at-galleria-mall',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:\\BACKUPS\\STILLLCRAFT\\_case2.html', html);
// Find the key sections
for (const term of ['participants', 'industry', 'event type', 'location', 'see full case study', 'icon icon', '00', 'The Situation', 'What We Did', 'The Result', 'In Their Words']) {
  const i = html.indexOf(term);
  console.log(`${term}: ${i >= 0 ? 'FOUND at ' + i : 'not found'}`);
}
// Check the visible content
const bodyStart = html.indexOf('<body');
const bodyEnd = html.indexOf('</body>');
const body = html.slice(bodyStart, bodyEnd);
// Check for the case study content
console.log('\nHas "The Situation":', body.includes('The Situation'));
console.log('Has "What We Did":', body.includes('What We Did'));
console.log('Has "The Result":', body.includes('The Result'));
console.log('Has "In Their Words":', body.includes('In Their Words'));
// Check for placeholder text
console.log('Has "Placeholder":', body.includes('Placeholder'));
console.log('Has "[Placeholder":', body.includes('[Placeholder'));