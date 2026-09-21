import {readFileSync} from 'node:fs';
const local = readFileSync('dist/index.html', 'utf8');
const prod = await (await fetch('https://revamped-rho.vercel.app/')).text();
const EMPTY = 'self.__next_f.push([1,""])';
const c = (h) => h.split(EMPTY).length - 1;
console.log('local empty-pushes:', c(local), 'len:', local.length);
console.log('prod empty-pushes:', c(prod), 'len:', prod.length);
