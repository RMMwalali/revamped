// Edge Routing Middleware (framework-agnostic): HTML navigations -> api/page.js,
// everything else falls through to the static filesystem / other API functions.
export default function middleware(request) {
  const url = new URL(request.url);
  const p = url.pathname;

  if (p.startsWith('/api/')) return undefined;
  if (/\/[^/]*\.[a-z0-9]+$/i.test(p)) return undefined;
  if (
    p.startsWith('/_next/') ||
    p.startsWith('/assets/') ||
    p.startsWith('/upload/') ||
    p.startsWith('/icons/') ||
    p.startsWith('/vendor/')
  ) return undefined;

  const target = new URL(request.url);
  target.pathname = '/api/page';
  target.searchParams.set('path', p);
  return new Response(null, {
    headers: { 'x-middleware-rewrite': target.toString() },
  });
}

export const config = {
  matcher: ['/((?!api|_next|assets|upload|icons|vendor|favicon\\.ico).*)'],
};