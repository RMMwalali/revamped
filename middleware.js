// Edge routing: HTML navigations -> the page function, everything else static.
export function middleware(request) {
  const url = new URL(request.url);
  const p = url.pathname;

  // Never touch API routes, assets, or files with extensions
  if (p.startsWith('/api/')) return;
  if (/\/[^/]*\.[a-z0-9]+$/i.test(p)) return;
  if (
    p.startsWith('/_next/') ||
    p.startsWith('/assets/') ||
    p.startsWith('/upload/') ||
    p.startsWith('/icons/')
  ) return;

  url.pathname = '/api/page';
  url.searchParams.set('path', p);
  return Response.rewrite(url);
}

export const config = { matcher: '/:path*' };
