const s = await (await fetch('http://127.0.0.1:3105/')).text();
let i = 0, n = 0;
while ((i = s.indexOf('service\\/sports', i)) >= 0 && n < 8) {
  console.log('ESC', n, JSON.stringify(s.slice(Math.max(0, i - 120), i + 60)));
  i += 10; n++;
}
i = 0; n = 0;
while ((i = s.indexOf('service/sports', i)) >= 0 && n < 8) {
  console.log('RAW', n, JSON.stringify(s.slice(Math.max(0, i - 120), i + 60)));
  i += 10; n++;
}
