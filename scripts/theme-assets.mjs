// One-shot: swap distinctive legacy brand hexes inside built JS chunks and
// CSS files (all dist copies). Only rare brand tokens are touched; common
// values left alone. Needed because production serves CSS statically while
// local dev themes it at runtime (applyTheme in serve.mjs) — without this
// bake, production keeps the legacy lime/dark palette.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const MAP = [
  ['9c93e8', '0d0d0d'], ['8072ff', '0d0d0d'], ['bfb8ff', '0d0d0d'],
  ['141415', '0d0d0d'], ['1e1e1e', '0d0d0d'],
  ['e0ff98', '97562E'], ['608ff3', '97562E'], ['ddd9ff', '97562E'], ['546162', '0d0d0d'],
  ['f3efeb', 'FFFFFF'], ['f3efe9', 'FFFFFF'],
  ['eae3dc', 'F5F1EC'], ['efebe8', 'F5F1EC'],
  ['d1f3f5', 'F5F1EC'], ['ffddc4', 'F5F1EC'], ['f7ffdc', 'F5F1EC'],
];
// The template's dark also travels as rgba(30, 30, 30, a) (dividers, the
// footer spotlight mask): same brand near black, alpha kept, same length.
// Light rust tint (rust #97562E at 20% over white) for --purple section bands.
const PURPLE_BAND = '#EADDD5';
const RGBA_DARK = /(rgba?\(\s*)30(\s*,\s*)30(\s*,\s*)30(?=\s*[,)])/gi;
async function files(d, exts, out = []) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) await files(f, exts, out);
    else if (exts.some((x) => e.name.endsWith(x))) out.push(f);
  }
  return out;
}
let changed = 0;
// Both chunk copies: dist/assets/root (source of the mirror) and dist/_next,
// which production serves directly.
for (const f of [...await files('dist/assets/root/_next/static/chunks', ['.js']), ...await files('dist/_next/static/chunks', ['.js'])]) {
  let t = await readFile(f, 'utf8');
  const before = t;
  for (const [a, b] of MAP) t = t.replace(new RegExp('#' + a, 'gi'), '#' + b);
  t = t.replace(RGBA_DARK, (m, a, b, c) => a + '13' + b + '13' + c + '13');
  if (t !== before) { await writeFile(f, t, 'utf8'); changed++; console.log('themed', f.split(/[/\\]/).pop()); }
}
// CSS is served statically in production (no runtime applyTheme there), so
// bake the same palette into every CSS copy (dist/_next mirrors assets/root).
for (const f of await files('dist', ['.css'])) {
  let t = await readFile(f, 'utf8');
  const before = t;
  for (const [a, b] of MAP) t = t.replace(new RegExp('#' + a, 'gi'), '#' + b);
  t = t.replace(RGBA_DARK, (m, a, b, c) => a + '13' + b + '13' + c + '13');
  // --purple is a section BACKGROUND under dark text (the template's light
  // lavender band). Mapped to near black it hid that text completely; a light
  // rust tint keeps the band in the brand palette and the text readable.
  t = t.replace(/--purple:#[0-9a-fA-F]{6}\b/g, '--purple:' + PURPLE_BAND);
  if (t !== before) { await writeFile(f, t, 'utf8'); changed++; console.log('themed css', f.split(/[/\\]/).pop()); }
}
console.log('done, changed=' + changed);
