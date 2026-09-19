// Rebuild pipeline step by step, capturing intermediate HTML for bisection.
import { readFile, writeFile } from 'node:fs/promises';
import { getOverrides, applyOverrides } from './overrides.mjs';
import { getCMS, applyStructuredCMS } from './cms.mjs';
import { applyBrand, getBrand } from './transform.mjs';
import {
  stripThirdParty, removeBadges, applyNav, applyGlobalSwaps, applyLegalFix,
  applyHeroVideo, applyStatsFix, applyCitiesFix, applyLogosFix, applyFooterSingleOffice,
  applyHighlightsFix, applySliderFix, applyShareImage, applyMetaFix, applyValuesFix,
  applyServiceCardsFix, applyListingStaticFix, applyPortfolioFix, applySplitTextFix,
  applyCardTitlesFix, applyCaseMetaFix, applyFooterAddresses, applyContentFlight,
  applyLinks, applyTeamRoster, applyTeamSectionFix, applyHomeVoices, applyStyleBlocks, applyImgDims, encodeAssetSpaces,
  removeStaleProjectCards, applySplash, applyFooterFix,
  FILE_CONTENT, LOGO_ROWS, LOGO_NAMES, HERO_VIDEO_URL,
  HERO_VIDEO_MOBILE_URL, HERO_POSTER_URL, mobileFor, posterFor,
} from './transform.mjs';
import { verifyFlight, safeReplaceVerified } from './flight.mjs';

const key = '/';
let html = await readFile('dist/index.html', 'utf8');
const out = 'dist/_steps';
let step = 0;
const save = async (name) => {
  step++;
  await writeFile(`${out}/${String(step).padStart(2, '0')}-${name}.html`, html);
  const v = verifyFlight(html);
  console.log(`${String(step).padStart(2, '0')} ${name.padEnd(26)} rows=${v.rows} bad=${v.bad} len=${html.length}`);
};

html = stripThirdParty(html); await save('stripThirdParty');
html = removeBadges(html); await save('removeBadges');
html = applyBrand(html, await getBrand()); await save('applyBrand');
html = applyNav(html, key); await save('applyNav');
html = applyOverrides(html, await getOverrides(key), { noFlightPatch: false }); await save('applyOverrides-db');
const fileItems = [...(FILE_CONTENT[key] || []),
  ...((LOGO_ROWS[key] || []).filter(r => !/Testimonial/i.test(r.orig_html))),
  ...((LOGO_NAMES[key] || []).map(n => ({ el_id: n.id, kind: 'text', value: n.name, orig_html: n.old })))];
if (fileItems.length) { html = applyOverrides(html, fileItems, { noFlightPatch: false }); await save('applyOverrides-files'); }
html = applyGlobalSwaps(html, key); await save('applyGlobalSwaps');
const __brand = await getBrand();
const __cms = await getCMS().catch(() => null);
const __heroUrl = (__cms && __cms.hero && __cms.hero.video_url) || __brand.hero_video_src || HERO_VIDEO_URL;
const __heroMob = (__cms && __cms.hero && __cms.hero.video_mobile_url) || mobileFor(__heroUrl) || HERO_VIDEO_MOBILE_URL;
const __heroPos = posterFor(__heroUrl) || HERO_POSTER_URL;
html = applyHeroVideo(html, __heroUrl, __heroMob, __heroPos); await save('applyHeroVideo');
if (__cms) { html = await applyStructuredCMS(html, __cms, key); await save('applyStructuredCMS'); }
html = applyStatsFix(html); await save('applyStatsFix');
html = applyCitiesFix(html); await save('applyCitiesFix');
html = applyLogosFix(html, __cms && __cms.logos && Array.isArray(__cms.logos.items) ? __cms.logos.items : []); await save('applyLogosFix');
html = applyFooterSingleOffice(html); await save('applyFooterSingleOffice');
html = applyHighlightsFix(html, key); await save('applyHighlightsFix');
html = applySliderFix(html, key); await save('applySliderFix');
html = applyHomeVoices(html, key, __cms); await save('applyHomeVoices');
html = applyShareImage(html); await save('applyShareImage');
html = applyMetaFix(html, key); await save('applyMetaFix');
html = applyValuesFix(html, key); await save('applyValuesFix');
html = applyServiceCardsFix(html, key); await save('applyServiceCardsFix');
html = applyListingStaticFix(html); await save('applyListingStaticFix');
html = applyPortfolioFix(html); await save('applyPortfolioFix');
html = applySplitTextFix(html); await save('applySplitTextFix');
html = applyCardTitlesFix(html); await save('applyCardTitlesFix');
html = applyCaseMetaFix(html, key); await save('applyCaseMetaFix');
html = applyFooterAddresses(html); await save('applyFooterAddresses');
html = applyContentFlight(html, key); await save('applyContentFlight');
html = applyLinks(html, 'localhost:3000', key); await save('applyLinks');
html = applyTeamRoster(html, __cms); await save('applyTeamRoster');
html = applyTeamSectionFix(html, __cms); await save('applyTeamSectionFix');
html = applyStyleBlocks(html, await getBrand()); await save('applyStyleBlocks');
html = await applyImgDims(html); await save('applyImgDims');
html = encodeAssetSpaces(html); await save('encodeAssetSpaces');
html = removeStaleProjectCards(html); await save('removeStaleProjectCards');
html = applySplash(html, key); await save('applySplash');
html = applyFooterFix(html, key); await save('applyFooterFix');

await writeFile('dist/_served.html', html);
console.log('final len', html.length);