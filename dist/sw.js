/* CLONE-COMPAT service worker (not part of the original site).
 * Purpose: serve Next.js image-optimizer URLs (/_next/image?url=...) from local
 * files when the clone is hosted on a plain static server with no optimizer.
 * Everything else passes through to the network untouched. */
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname !== '/_next/image') return;
  const src = u.searchParams.get('url');
  if (!src) return;
  const target = src.startsWith('/') ? src : '/' + src;
  if (/^https?:\/\//.test(target)) return; // external: leave to network
  e.respondWith(fetch(target).then((r) => (r.ok ? r : fetch(e.request))));
});
