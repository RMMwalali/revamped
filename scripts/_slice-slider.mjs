import { readFile, writeFile } from 'node:fs/promises';
import { verifyFlight, safeReplacePairs } from './flight.mjs';

const html14 = await readFile('dist/_steps/14-applyHighlightsFix.html', 'utf8');

const BS = String.fromCharCode(92);
const FQ = BS + '"';
const TM_RE = /(UEFA|Pfizer|CordenPharma|Menzies|Midas|Adevinta|Adidas|FedEx|Turkish|VEEAM)/;
const SLIDER_TEMPLATE_MARKS = ['EventSliderActions', 'SliderItems', 'aria-label="testimonial'];

function cutBalancedDiv(html, open) {
  const tagM = /^<div/.exec(html.slice(open, open + 10));
  if (!tagM) return -1;
  const gt = html.indexOf('>', open);
  if (gt < 0) return -1;
  const re = /<(\/?)div(?=[\s>])/g;
  re.lastIndex = gt + 1;
  let depth = 1, m, end = -1;
  while ((m = re.exec(html))) {
    if (m[1] === '/') { depth--; if (depth === 0) { end = m.index; break; } }
    else { const e = html.indexOf('>', m.index); if (e > 0 && html[e - 1] !== '/') depth++; }
    if (re.lastIndex > open + 500000) break;
  }
  return end >= 0 ? end + 4 : -1;
}

// Replicate each sub-step separately.
let v1 = html14, v2 = html14, v3 = html14, v4 = html14, v5 = html14, v6 = html14, v7 = html14;

// --- 1) facet rows removal ---
{
  const lvt = v1.indexOf('<div class="Container_container_grid__LWYyb css-lvtjah">');
  const pOpen = '<div class="css-zme24x">';
  const rows = [];
  let scan = lvt;
  for (let k = 0; k < 4; k++) { const o = v1.lastIndexOf(pOpen, scan - 1); if (o < 0) break; rows.unshift(o); scan = o; }
  const ends = rows.map((o) => cutBalancedDiv(v1, o));
  if (ends.some((e) => e < 0)) { console.log('s1: abort no ends'); }
  else {
    for (let k = 3; k >= 0; k--) v1 = v1.slice(0, rows[k]) + v1.slice(ends[k]);
  }
}

// --- 2) quotes container ---
{
  const s = v2.indexOf('<div class="Container_container_grid__LWYyb css-lvtjah">');
  if (s >= 0) {
    const e = cutBalancedDiv(v2, s);
    if (e > 0) { v2 = v2.slice(0, s) + v2.slice(e); }
  }
}

// --- 3) arrows + counter ---
{
  const s = v3.indexOf('<div class="Container_container_grid__LWYyb css-12ybk68">');
  if (s >= 0) {
    const e = cutBalancedDiv(v3, s);
    if (e > 0 && v3.slice(s, e).includes('EventSliderActions')) v3 = v3.slice(0, s) + v3.slice(e);
  }
}

// --- 4) leader-photos strip ---
{
  const s = v4.indexOf('<div class="css-41c6dw">');
  if (s >= 0) {
    const e = cutBalancedDiv(v4, s);
    if (e > 0) v4 = v4.slice(0, s) + v4.slice(e);
  }
}

// --- 5) case-link buttons ---
{
  const re = /<div class="css-jp7bfh">[\s\S]*?see full case study[\s\S]*?<\/a><\/div>/g;
  let m; const hits = [];
  while ((m = re.exec(v5))) hits.push([m.index, m.index + m[0].length]);
  hits.sort((a, b) => b[0] - a[0]);
  for (const [a, b] of hits) v5 = v5.slice(0, a) + v5.slice(b);
}

// --- 6) flight testimonial arrays empty ---
{
  try {
    const tkeys = [FQ + 'testimonials' + FQ + ':{' + FQ + 'edges' + FQ + ':[', FQ + 'testimonials' + FQ + ':'];
    for (const tkey of tkeys) {
      let idx = v6.indexOf(tkey);
      let guard = 0;
      while (idx >= 0 && guard++ < 6) {
        let open = idx + tkey.length - 1;
        if (v6[open] !== '[') {
          if (tkey.endsWith(':[')) break;
          if (v6[open] === ':' && v6[open + 1] === '[') open = open + 1;
          else if (v6[open] === ':') {
            const ek = FQ + 'edges' + FQ + ':[';
            const ei = v6.indexOf(ek, idx);
            if (ei < 0 || ei - idx > 400) { idx = v6.indexOf(tkey, idx + tkey.length); continue; }
            open = ei + ek.length - 1;
          } else { idx = v6.indexOf(tkey, idx + tkey.length); continue; }
        }
        let depth = 0, k = open, end = -1;
        for (; k < v6.length; k++) {
          const c = v6[k];
          if (c === BS) { k++; continue; }
          if (c === '[') depth++;
          else if (c === ']') { depth--; if (depth === 0) { end = k; break; } }
          if (k - open > 120000) break;
        }
        if (end < 0) break;
        const inner = v6.slice(open + 1, end);
        if (!inner.includes('testimonialTemplate') || !TM_RE.test(inner)) { idx = v6.indexOf(tkey, end); continue; }
        const badBefore = (() => { try { return verifyFlight(v6).bad; } catch { return 0; } })();
        const cand = safeReplacePairs(v6, [[inner, '']]);
        if (cand !== v6) { try { if (verifyFlight(cand).bad <= badBefore) v6 = cand; } catch {} }
        idx = v6.indexOf(tkey, idx + 2);
      }
    }
  } catch {}
}

// --- 7) preloads ---
{
  const re = /<link\b[^>]*(?:\/)?(?:Adel-Kertesz|Theresa-Ruivo|Bruno-Sciamanna|Camilla-Di-Zenzo|Ella-McClary|Costanza-Rota|Jo-Harrison|Testimonials_|Testimonial_|UEFA-logo|Pfizer-logo)[^>]*>\s*/g;
  v7 = v7.replace(re, '');
}

const outdir = 'dist/_steps-slice';
for (const [n, v] of [
  ['s01-facets', v1], ['s02-quotes', v2], ['s03-arrows', v3], ['s04-leader', v4],
  ['s05-buttons', v5], ['s06-flight-edges', v6], ['s07-preloads', v7],
]) {
  await writeFile(`${outdir}/${n}.html`, v);
  const vf = verifyFlight(v);
  console.log(`${n.padEnd(20)} rows=${vf.rows} bad=${vf.bad} len=${v.length}`);
}