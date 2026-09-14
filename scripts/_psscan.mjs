import vm from 'node:vm';
const res = await fetch('http://127.0.0.1:3000/projects', { headers: { 'user-agent': 'test' } });
const g = await res.text();
console.log('served size', g.length);
// find inline <script>...</script> that starts with self.__next_f
const scripts = [...g.matchAll(/<script>((?:[^<]|<(?!\/script>))*?)<\/script>/g)];
console.log('inline scripts', scripts.length);
for (const m of scripts) {
  const code = m[1];
  if (!code.includes('self.__next_f')) continue;
  try { new vm.Script(code); }
  catch (e) { console.log('PARSE FAIL len', code.length, e.message); console.log('around:', JSON.stringify(code.slice(0, 120)) + ' ... ' + JSON.stringify(code.slice(-120))); }
}
// count literal </script> inside pushes
for (const m of g.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
  const chunk = m[1];
  if (chunk.includes('</script>')) console.log('PUSH CONTAINS </script> len', chunk.length);
}
console.log('done');