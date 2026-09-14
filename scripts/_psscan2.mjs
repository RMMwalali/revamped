import vm from 'node:vm';
const res = await fetch('http://127.0.0.1:3000/projects', { headers: { 'user-agent': 'test' } });
const g = await res.text();
console.log('size', g.length);
const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
let m, n = 0, bad = 0;
while ((m = re.exec(g))) {
  n++;
  const code = m[1];
  if (!code.trim()) continue;
  if (code.includes('<a') && code.length > 5000 && code[0] === '<') { continue; }
  try { new vm.Script(code); }
  catch (e) {
    bad++;
    console.log('PARSE FAIL script #' + n + ' len=' + code.length + ' ' + e.message);
    console.log(' head:', JSON.stringify(code.slice(0, 100)));
    console.log(' tail:', JSON.stringify(code.slice(-150)));
  }
}
console.log('scripts', n, 'bad', bad);