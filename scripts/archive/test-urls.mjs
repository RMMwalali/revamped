const urls = [
  'https://cms.iventions.com/wp-content/uploads/2025/07/Quote.jpg',
  'https://cms.iventions.com/wp-content/uploads/2025/06/Events-1.jpg',
  'https://cms.iventions.com/wp-content/uploads/2025/07/Contact.jpg',
  'https://cms.iventions.com/wp-content/uploads/2026/07/UEFA-Champions-League-Final-2026-1-scaled-1.webp',
];
const h = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://iventions.com/', 'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' };
for (const u of urls) {
  const r = await fetch(u, { headers: h });
  const b = Buffer.from(await r.arrayBuffer());
  const s = b.slice(0, 14).toString('latin1').replace(/[^\x20-\x7e]/g, '.');
  console.log(u.split('/').pop(), '| status', r.status, '| ct', r.headers.get('content-type'), '| len', b.length, '| sig', s);
}
