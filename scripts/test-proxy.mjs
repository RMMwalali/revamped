// Test fetching via Next image proxy vs direct CMS
const direct = 'https://cms.iventions.com/wp-content/uploads/2025/06/Events-1.jpg';
const enc = encodeURIComponent('https://cms.iventions.com/wp-content/uploads/2025/06/Events-1.jpg');
const viaProxy = `https://iventions.com/_next/image?url=${enc}&w=1920&q=70`;

function sig(buf) {
  const b = [...buf.slice(0, 16)];
  const hex = b.map(x => x.toString(16).padStart(2, '0')).join(' ');
  const ascii = b.map(x => (x >= 32 && x <= 126 ? String.fromCharCode(x) : '.')).join('');
  return { hex, ascii };
}

const d = await fetch(direct, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://iventions.com/',
  }
});
const dbuf = Buffer.from(await d.arrayBuffer());
console.log('DIRECT', d.status, d.headers.get('content-type'), dbuf.length, JSON.stringify(sig(dbuf)));

const p = await fetch(viaProxy, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  }
});
const pbuf = Buffer.from(await p.arrayBuffer());
console.log('PROXY ', p.status, p.headers.get('content-type'), pbuf.length, JSON.stringify(sig(pbuf)));
