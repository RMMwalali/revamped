// Public URLs for the service pages, named after what the menu calls them.
// The pages themselves still live at their original template paths in dist/
// (and saved admin edits are keyed by those paths), so:
//   - a request for the new URL is served from the original page,
//   - a request for an old URL is redirected (301) to the new one,
//   - every link in served HTML (hrefs, metadata and the Next.js data the
//     menus hydrate from) is rewritten to the new URL.
// Nothing about the design or behaviour of the pages changes.
export const SERVICE_ROUTES = [
  // [original path, public path]
  ['/service/exhibits', '/service/mall-calendar-programming'],
  ['/service/congresses', '/service/mall-space-monetization'],
  ['/service/events', '/service/brand-activations'],
];

const TO_INTERNAL = new Map(SERVICE_ROUTES.map(([o, n]) => [n, o]));
const TO_PUBLIC = new Map(SERVICE_ROUTES);
const trim = (p) => (p.length > 1 ? p.replace(/\/(index\.html)?$/, '') : p);

// New public URL -> the original path the page is stored under (else null).
export function internalPath(pathname) {
  return TO_INTERNAL.get(trim(pathname)) || null;
}

// Old URL -> where it now lives (else null). Used for 301 redirects.
export function publicRedirect(pathname) {
  return TO_PUBLIC.get(trim(pathname)) || null;
}

// The original path a page is stored under -> its public path.
export function publicPath(key) {
  return TO_PUBLIC.get(key) || key;
}

const SLUGS = { exhibits: 'mall-calendar-programming', congresses: 'mall-space-monetization', events: 'brand-activations' };
// "/service/events" (+ "/", "?", "#", quote or escaped quote after it), in
// plain HTML, absolute URLs and the escaped JSON inside Next.js flight data.
const LINK_RE = /\/service\/(exhibits|congresses|events)(?![A-Za-z0-9_-])/g;
// Next.js canonical-URL parts for the page being viewed, e.g.
//   \"c\":[\"\",\"service\",\"events\"]  - keeps the address bar on the new URL.
const CANON_RE = /(\\?"c\\?":\[\\?"\\?",\\?"service\\?",\\?")(exhibits|congresses|events)(\\?")/g;

export function applyRouteNames(html) {
  if (typeof html !== 'string' || !html.includes('/service/') && !html.includes('service')) return html;
  return html
    .replace(LINK_RE, (m, slug) => '/service/' + SLUGS[slug])
    .replace(CANON_RE, (m, a, slug, b) => a + SLUGS[slug] + b);
}
