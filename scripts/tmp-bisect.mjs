import {readFile} from 'node:fs/promises';
import {getOverrides} from './overrides.mjs';
import {getCMS} from './cms.mjs';
import * as T from './transform.mjs';
const {getBrand, stripThirdParty, removeBadges, applyBrand, applyNav, applyGlobalSwaps,
  applyLegalFix, applyFooterAddresses, applyHeroVideo, applyContentFlight, applyLinks,
  applyStyleBlocks, HERO_VIDEO_URL, HERO_VIDEO_MOBILE_URL, HERO_POSTER_URL, mobileFor, posterFor} = T;
import {applyStructuredCMS} from './cms.mjs';

const h4s = (html, tag) => {
  const m = [...html.matchAll(/<h4[^>]*class="css-hj2ayb"[^>]*>([^<]+)<\/h4>/g)].map(x => x[1]);
  console.log(tag, JSON.stringify(m));
};
const key = '/';
let html = await readFile('dist/index.html', 'utf8');
h4s(html, 'raw');
html = stripThirdParty(html); h4s(html, 'strip');
html = removeBadges(html); h4s(html, 'badges');
html = applyBrand(html, await getBrand()); h4s(html, 'brand');
html = applyNav(html, key); h4s(html, 'nav');
html = T.applyOverrides ? html : html;
const {applyOverrides} = await import('./overrides.mjs');
html = applyOverrides(html, await getOverrides(key), {}); h4s(html, 'dboverride');
html = applyGlobalSwaps(html, key); h4s(html, 'swaps');
const brand = await getBrand();
const cms = await getCMS().catch(() => null);
html = applyHeroVideo(html, (cms && cms.hero && cms.hero.video_url) || brand.hero_video_src || HERO_VIDEO_URL, null, null); h4s(html, 'hero');
if (cms) html = await applyStructuredCMS(html, cms, key); h4s(html, 'cms');
for (const [name, fn] of Object.entries({statsFix: T.applyStatsFix, citiesFix: T.applyCitiesFix, logosFix: (h) => T.applyLogosFix(h, []), footerSingle: T.applyFooterSingleOffice, highlights: T.applyHighlightsFix, slider: T.applySliderFix, share: T.applyShareImage, meta: (h) => T.applyMetaFix(h, key), values: T.applyValuesFix, svcCards: (h) => T.applyServiceCardsFix(h, key), listing: T.applyListingStaticFix, portfolio: T.applyPortfolioFix, split: T.applySplitTextFix, cardTitles: T.applyCardTitlesFix})) {
  try { html = await fn(html); } catch (e) { console.log(name, 'THREW', e.message); }
  h4s(html, name);
}
await (await import('./db.mjs')).pool.end();
