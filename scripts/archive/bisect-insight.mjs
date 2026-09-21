// Bisect: apply pipeline steps cumulatively, write variants for browser test.
import { readFile, writeFile } from 'node:fs/promises';
import { getOverrides, applyOverrides } from './overrides.mjs';
import {
  getBrand, applyBrand, applyNav, stripThirdParty,
  applyGlobalSwaps, applyFooterAddresses, applyHeroVideo,
  applyContentFlight, applyImgDims, applySplash, applyStyleBlocks,
  applyFooterFix, applyTeamRoster,
  FILE_CONTENT, LOGO_ROWS, LOGO_NAMES, HERO_VIDEO_URL,
  HERO_VIDEO_MOBILE_URL, HERO_POSTER_URL, mobileFor, posterFor,
} from './transform.mjs';
import { getCMS, applyStructuredCMS } from './cms.mjs';

const key = '/insight/iventions-london-hub';
let html = await readFile('dist/insight/iventions-london-hub/index.html', 'utf8');
const brand = await getCMS().then(() => getBrand());
const cms = await getCMS().catch(() => null);
const steps = [];
const snap = (name) => steps.push([name, html]);
snap('00-raw');
if (!process.env.SC_NOSTRIP) html = stripThirdParty(html);
snap('01-strip');
html = applyBrand(html, brand);
snap('02-brand');
html = applyNav(html, key);
snap('03-nav');
html = applyOverrides(html, await getOverrides(key), {});
snap('04-dboverride');
const fileItems = [...(FILE_CONTENT[key] || []),
  ...((LOGO_ROWS[key] || []).filter((r) => !/Testimonial/i.test(r.orig_html))),
  ...((LOGO_NAMES[key] || []).map((n) => ({ el_id: n.id, kind: 'text', value: n.name, orig_html: n.old })))];
if (fileItems.length) html = applyOverrides(html, fileItems, {});
snap('05-fileitems');
html = applyGlobalSwaps(html, key);
snap('06-swaps');
html = applyHeroVideo(html, HERO_VIDEO_URL, HERO_VIDEO_MOBILE_URL, HERO_POSTER_URL);
snap('07-hero');
if (cms) html = applyStructuredCMS(html, cms, key);
snap('08-cms');
html = applyFooterAddresses(html);
snap('09-footer');
html = applyContentFlight(html, key);
snap('10-flight');
html = applyTeamRoster(html);
snap('11-team');
html = applyStyleBlocks(html, brand);
snap('12-style');
html = await applyImgDims(html);
snap('13-imgdims');
html = applySplash(html, key);
snap('14-splash');
html = applyFooterFix(html, key);
snap('15-footerfix');
for (const [n, h] of steps) await writeFile(`dist/_bisect-${n}.html`, h);
console.log('wrote', steps.length, 'variants');
process.exit(0);
