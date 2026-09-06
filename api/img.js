// /_next/image shim: redirect optimizer URLs to the underlying local file.
export default function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const u = new URL(req.url, `${proto}://${req.headers.host || 'local'}`);
  const src = u.searchParams.get('url');
  if (!src) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(204).end();
    return;
  }
  res.writeHead(302, { Location: src.startsWith('/') ? src : '/' + src });
  res.end();
}
