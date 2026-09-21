import http from 'node:http';
import { readFile } from 'node:fs/promises';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    const map = { '/': '/index.html' };
    if (map[p]) p = map[p];
    let f = 'dist' + p;
    try { await readFile(f); } catch { f = 'dist' + p + '.html'; }
    let data;
    try { data = await readFile(f); } catch { data = await readFile('dist' + p + '/index.html'); }
    const ext = ('.' + f.split('.').pop()).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('nf'); }
}).listen(3459, () => console.log('raw static on 3459'));
