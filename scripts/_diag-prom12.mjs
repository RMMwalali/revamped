import fs from 'fs';
const t = fs.readFileSync('C:/Users/SERENI~1/AppData/Local/Temp/opencode/page-home.js', 'utf8');
console.log(JSON.stringify(t.slice(1600, 4400)));