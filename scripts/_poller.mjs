import http from 'node:http';

const seen = new Set();
setInterval(() => {
  console.error('--- poll ---');
}, 400);

fetch('http://localhost:3000/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'super@stillcraftevents.co.ke', password: 'stillwrong1' }),
}).then((r) => r.json()).then((j) => console.error('resp:', JSON.stringify(j))).catch((e) => console.error('err', e.message));

const first = Date.now() + 1000;
let count = 0;
const timer = setInterval(() => {
  count++;
  if (count > 20) { clearInterval(timer); process.exit(0); }
  const { execSync } = { execSync: null };
}, 100);