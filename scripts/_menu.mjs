import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:/BACKUPS/STILLLCRAFT/_h.html', html);
// Find the menu items in the Explore section
for (const term of ['Space Activation', 'Projects']) {
  const positions = [];
  let pos = 0;
  while ((pos = html.indexOf(term, pos)) >= 0) {
    positions.push(pos);
    pos += term.length;
  }
  console.log(`${term}: ${positions.length}x`);
}
// Show the menu area
const menuIdx = html.indexOf('styles_contents_menu_item');
console.log('menu item class at', menuIdx);
// Show the menu area
console.log('\n=== Menu area ===');
console.log(html.slice(227600, 228300));