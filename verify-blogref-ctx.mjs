const html = await (await fetch('http://localhost:3000/')).text();
for (const needle of ['>Blog<', 'href="/insights"', '/insight/']) {
  let idx = -1, k = 0;
  while ((idx = html.indexOf(needle, idx + 1)) >= 0 && k++ < 8) {
    console.log('=== ' + needle + ' occ ' + k + ': ...' + html.slice(Math.max(0, idx - 160), idx + 80).replace(/\s+/g, ' ') + '...');
  }
  if (!k) console.log('=== ' + needle + ': none');
}
