// Exact-string fixes to compiled client chunks that cannot be fixed upstream
// (they are the donor site's built output). Idempotent: running it twice, or on
// an already-patched file, changes nothing. Run at the end of `npm run build`
// so a rebuild can never silently bring the crashes back.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const PATCHES = [
  {
    // Home page service cards ("See what we create") build their link as
    // "/service/" + slug from the donor's slugs (events/exhibits/congresses).
    // The service pages are public under their menu names (scripts/routes.mjs),
    // so map the slug to that name. Same card, same behaviour, right URL.
    match: 'serviceTitle:l}=e;return',
    edits: [
      [
        'href:"".concat(k.f.SERVICE).concat((0,_._t)(r)),title:"".concat(t," - ").concat(l)',
        'href:"".concat(k.f.SERVICE).concat((0,_._t)({events:"brand-activations",exhibits:"mall-calendar-programming",congresses:"mall-space-monetization"}[r]||r)),title:"".concat(t," - ").concat(l)',
      ],
    ],
  },
  {
    // About page "talent" panel. It finds the active .js-talent-item with
    // querySelectorAll(...)[index] and calls getBoundingClientRect() on it with
    // no check. We replace the donor's team list with our own section, so on this
    // site there are zero such elements: the lookup is undefined, the call throws
    // inside a layout effect, and the whole page turns into "Application error".
    match: 'js-talent-item',
    edits: [
      [
        'let e=n.getBoundingClientRect().top-t.getBoundingClientRect().top;r.current.style.setProperty("--distance"',
        'let e=n?n.getBoundingClientRect().top-t.getBoundingClientRect().top:0;r.current.style.setProperty("--distance"',
      ],
      [
        'let t=n.getBoundingClientRect().top-e.getBoundingClientRect().top;r.current.style.setProperty("--distance"',
        'let t=n?n.getBoundingClientRect().top-e.getBoundingClientRect().top:0;r.current.style.setProperty("--distance"',
      ],
    ],
  },
];

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.js')) yield p;
  }
}

const roots = ['dist/_next/static/chunks', 'dist/assets/root/_next/static/chunks'].map((d) => path.resolve(d));
let changed = 0, already = 0;
for (const root of roots) {
  for await (const file of walk(root)) {
    let src = await readFile(file, 'utf8');
    let out = src;
    for (const p of PATCHES) {
      if (!out.includes(p.match)) continue;
      for (const [from, to] of p.edits) {
        if (out.includes(from)) out = out.split(from).join(to);
        else if (out.includes(to)) already++;
      }
    }
    if (out !== src) { await writeFile(file, out, 'utf8'); changed++; console.log('patched', path.relative(process.cwd(), file)); }
  }
}
console.log(`patch-chunks: ${changed} file(s) patched, ${already} edit(s) already applied`);
