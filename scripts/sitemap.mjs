// sitemap.xml + robots.txt, generated per request from the same route list the
// redirects use. Static files drift the moment a case is added, and a sitemap
// that advertises a URL which 404s or 302s is worse than none at all.
//
// The retired donor insight URLs and the stale project slugs are deliberately
// absent: they redirect to /projects, and listing a redirect target invites
// crawlers to index the wrong page.
import { allCases } from './stillcraft-cases.mjs';

// Ordered by importance: home and the money pages first, cases after.
const STATIC_ROUTES = [
  ['/', '1.0', 'weekly'],
  ['/projects', '0.9', 'weekly'],
  ['/service/brand-activations', '0.8', 'monthly'],
  ['/service/mall-calendar-programming', '0.8', 'monthly'],
  ['/service/mall-space-monetization', '0.8', 'monthly'],
  ['/contact', '0.8', 'monthly'],
  ['/about', '0.7', 'monthly'],
  ['/cookie-policy', '0.2', 'yearly'],
  ['/privacy-policy', '0.2', 'yearly'],
  ['/legal-notice-terms-of-use', '0.2', 'yearly'],
];

const xmlEscape = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function originOf(host) {
  return 'https://' + String(host || '').split(',')[0].trim();
}

export function buildSitemap(host) {
  const origin = originOf(host);
  const urls = [
    ...STATIC_ROUTES.map(([p, pri, freq]) => ({ loc: origin + p, pri, freq })),
    ...allCases().map((c) => ({
      loc: origin + '/project/' + c.slug,
      pri: '0.6',
      freq: 'monthly',
    })),
  ];
  const body = urls
    .map(
      (u) =>
        '  <url>\n' +
        '    <loc>' + xmlEscape(u.loc) + '</loc>\n' +
        '    <changefreq>' + u.freq + '</changefreq>\n' +
        '    <priority>' + u.pri + '</priority>\n' +
        '  </url>'
    )
    .join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body +
    '\n</urlset>\n'
  );
}

export function buildRobots(host) {
  return (
    'User-agent: *\n' +
    'Allow: /\n' +
    // The CMS is a private admin surface; the API tree is not content.
    'Disallow: /insider\n' +
    'Disallow: /api/\n' +
    'Disallow: /editbar.js\n' +
    '\n' +
    'Sitemap: ' + originOf(host) + '/sitemap.xml\n'
  );
}
