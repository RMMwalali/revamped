import { readFile } from 'node:fs/promises';
const BS = String.fromCharCode(92);
const DQ = String.fromCharCode(34);
const t = await readFile('./scripts/transform.mjs', 'utf8');
const lines = t.split('\n');
// find the fMark line
const li = lines.findIndex((l) => l.indexOf('fMark') >= 0 && l.indexOf('const') >= 0);
console.log('fMark line no:', li + 1);
const line = lines[li];
console.log('codes:', [...line].map((c) => (c === BS ? 'BS' : c === DQ ? 'DQ' : c)).join(''));
