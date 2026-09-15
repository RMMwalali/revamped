import { readFile } from 'node:fs/promises';
const html = await readFile('dist/insight/iventions-london-hub/index.html', 'utf8');
const pushes = html.split('self.__next_f.push(').slice(1).join('\n');
// raw non-ASCII presence inside pushes?
const nonAscii = new Set();
for (const ch of pushes) { const c = ch.codePointAt(0); if (c > 127) nonAscii.add('U+' + c.toString(16)); }
console.log('non-ascii in pushes:', [...nonAscii].slice(0, 20).join(' '));
// escape-style census in pushes
const styles = {
  'backslash-u (\\uXXXX)': (pushes.match(/\\u[0-9a-fA-F]{4}/g) || []).length,
  'backslash-n': (pushes.match(/\\n/g) || []).length,
  'backslash-quote': (pushes.match(/\\"/g) || []).length,
  'double-backslash': (pushes.match(/\\\\/g) || []).length,
  'literal-newline': (pushes.match(/\n/g) || []).length,
  'literal-tab': (pushes.match(/\t/g) || []).length,
};
console.log(styles);
// find length-prefixed rows: TAG,hexlen,  — scan raw for row starts
const re = /(^|\\n)([0-9a-f]+):([TAOoUSsLlGgMmV]),([0-9a-f]+),/g;
let m, rows = [];
while ((m = re.exec(pushes))) rows.push(`${m[2]}:${m[3]},len=0x${m[4]}(= ${(parseInt(m[4], 16))})`);
console.log('length-prefixed rows:', rows.length);
console.log(rows.slice(0, 20).join('\n'));
process.exit(0);
