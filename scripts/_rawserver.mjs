import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.argv[2] || 'dist';
const PORT = parseInt(process.argv[3] || '8087', 10);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const server = http.createServer((req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const cands = [];
    const full = path.join(ROOT, p.replace(/^\//, ''));
    cands.push(full);
    if (p === '/') cands.push(path.join(ROOT, 'index.html'));
    if (path.extname(full) === '' || full.endsWith('/')) cands.push(full + '.html', path.join(full, 'index.html'));
    for (const f of cands) {
      if (fs.existsSync(f) && fs.statSync(f).isFile()) {
        const ext = path.extname(f).toLowerCase();
        res.writeHead(200, { 'content-type': MIME[ext] || 'text/html' });
        res.end(fs.readFileSync(f));
        return;
      }
    }
    res.writeHead(404); res.end('nf');
  } catch (e) { res.writeHead(500); res.end('err'); }
});
server.listen(PORT, () => console.log('raw', PORT, 'root', ROOT));