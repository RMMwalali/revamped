const fs = require('fs');
const path = require('path');
const dir = 'dist/assets/root/_next/static/chunks';
const files = fs.readdirSync(dir).map((f) => path.join(dir, f)).filter((f) => /\.js$/.test(f));
let foundList = [];
for (const f of files) {
  let src;
  try { src = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  const keys = ['ProjectSliderActions', 'ProjectSlider', 'js-project-description'];
  for (const k of keys) if (src.includes(k)) { foundList.push({ f: f.split('\\').pop(), k, size: fs.statSync(f).size }); break; }
}
console.log(JSON.stringify(foundList, null, 1));