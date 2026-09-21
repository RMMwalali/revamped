import {readFileSync} from 'node:fs';
const s = readFileSync('C:/Users/SERENI~1/AppData/Local/Temp/opencode/prod-about.html', 'utf8');
console.log('len', s.length);
console.log('old about chunk refs:', s.split('page-1086f123f968dd96').length - 1);
console.log('new about chunk refs:', s.split('page-fd9d75e5d0bdf437').length - 1);
console.log('stale7051:', s.split('6e38258f').length - 1);
