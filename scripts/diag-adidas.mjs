import fs from 'node:fs';
const html = fs.readFileSync('dist/project/adidas-display-wall/index.html', 'utf8');
// Strip scripts to see readable static structure
const staticHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script>...</script>');
// Insert newlines before each opening tag for readability
const pretty = staticHtml
  .replace(/(<section\b|<div class="styles_|<h1\b|<h2\b|<h3\b|<h6\b|<p\b|<span data-sc|<img\b|<\/section>)/g, '\n$1')
  ;
// pull data-sc-id text nodes map
const ids = {};
const re = /data-sc-id="(t-?\d+|i-?\d+)">([^<]{0,200})</g;
let m;
while ((m = re.exec(html)) !== null) ids[m[1]] = m[2];
console.log('--- data-sc-id -> visible text (from full html incl flight) ---');
for (const [k, v] of Object.entries(ids)) console.log(k.padEnd(8), v.slice(0, 100));
fs.writeFileSync('scripts/_adidas-pretty.html', pretty);
console.log('\npretty written, head:');
console.log(pretty.slice(0, 4000));