const h = await (await fetch('http://127.0.0.1:3000/')).text();
for (const href of ['/service/congresses', '/service/sports']) {
  console.log('--- remaining', href, 'contexts:');
  const re = new RegExp(`<a\\b[^<>]*href="${href.replace(/\//g, '\\/')}"[^<>]*>([\\s\\S]{0,120})`, 'g');
  let m, n = 0;
  while ((m = re.exec(h)) && n < 6) {
    console.log('   >', m[1].replace(/\s+/g, ' ').slice(0, 110));
    n++;
  }
}
// menu overlay: extract all plain-text anchors to show final menu
console.log('--- plain menu anchors on /:');
const re2 = /<a\b[^<>]*href="([^"]+)"[^<>]*>\s*([A-Za-z &;]+?)\s*<\/a>/g;
let m2;
while ((m2 = re2.exec(h))) console.log('   ', m2[1], '=>', m2[2]);
