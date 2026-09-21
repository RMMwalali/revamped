const base = 'http://localhost:3000';
for (const p of ['/insights', '/insights/', '/insight', '/insight/choosing-an-event-management-company']) {
  const r = await fetch(base + p, { redirect: 'manual' });
  console.log(r.status, p, '->', r.headers.get('location') || '(no redirect)');
}
for (const p of ['/', '/about', '/projects', '/contact', '/service/events', '/service/exhibits']) {
  const t = await (await fetch(base + p)).text();
  const blog = t.includes('>Blog<') || t.includes('href="/insights"') || t.includes('/insight/');
  console.log(p, blog ? 'HAS BLOG REF' : 'clean');
}
