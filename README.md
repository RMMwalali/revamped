# StillCraft Events Co. — Website

The website for StillCraft Events Co., a Nairobi-based event agency. It was
originally built by cloning another agency's live Next.js site verbatim (same
stack output: Next.js App Router + Emotion + Motion + Lenis + Three.js/R3F)
and then rebranding it in place through the pipeline in `scripts/`. The site
is served as static files — no re-implementation, no mock content.

## Prerequisites

- Node.js 18+ (`node --version`)
- npm (`npm --version`)
- Playwright Chromium (only needed for scraping / verification):
  `npx playwright install chromium`

## Setup

```bash
cd revamped
npm install
```

## Run (view in browser)

```bash
npm run serve
```

Then open <http://localhost:3000>.

`npm run serve` uses `scripts/serve.mjs`, a tiny static server that also shims
the Next.js image optimizer (`/_next/image?url=…` → local file), so hydrated
images resolve exactly like on the live site.

Plain static hosts work too (the site ships `compat.js` + `sw.js`, which
register a service worker that serves those same optimizer URLs locally):

```bash
npx serve dist -l 3000 --cors
```

## Stop the server

If `npm run serve` is running in the foreground, `Ctrl+C` stops it. To free
port 3000 from another shell:

```bash
lsof -ti:3000 | xargs kill
```

## Restart the project

```bash
lsof -ti:3000 | xargs kill 2>/dev/null; npm run serve
```

Or run detached in the background (logs to `serve.log`):

```bash
nohup node scripts/serve.mjs 3000 > serve.log 2>&1 &
```

## Rebuild pipeline

| Command | What it does |
|---|---|
| `npm run build` | `rebuild.mjs` (scraped → `dist`, scripts preserved, URLs localized) + `mirror.mjs` (assets at original absolute paths) |
| `node scripts/scrape.mjs` | Re-scrape the 9 core routes into `scraped/` |
| `node scripts/scrape-extra.mjs` | `/home`, legal pages |
| `node scripts/scrape-rest.mjs` | All `/insight/*`, `/project/*`, `/projects/*` routes |
| `node scripts/scrape-rest2.mjs` | Newly discovered routes (check `routes.py` output first) |
| `node scripts/assets.mjs` | Download every asset referenced by `scraped/` |
| `node scripts/fetch-chunks.mjs` | Download chunks referenced by HTML/JS but missing locally |
| `node scripts/crawl-assets.mjs` | Visit every `dist` page, list same-origin 404s → `missing-assets.txt` |
| `node scripts/verify3.mjs` | Render check + screenshots (`clone-home.png`, `clone-events.png`) |

Typical refresh after re-scraping:

```bash
node scripts/rebuild.mjs; node scripts/assets.mjs; node scripts/mirror.mjs
```

## Project structure

```text
scraped/            source of truth: raw HTML captured from the original template site
dist/               the servable site (54 pages)
  index.html        home, /home/index.html mirrors it (original links Home → /home)
  about/  contact/  insights/  projects/  service/  insight/  project/
  _next/  upload/  icons/      mirrored to original absolute paths
  assets/cms/       CMS images  |  assets/root/_next/  JS/CSS/fonts
  sw.js  compat.js  image-optimizer shim for plain static hosts
scripts/            pipeline (see table above)
```

## Notes / expected console noise

These are harmless and also occurred (or are equivalent) on the original
source site the build was cloned from:

- `ERR_BLOCKED_BY_CLIENT` for `cookiebot` / `cloudflareinsights` — your
  adblocker, not the site.
- `POST /cdn-cgi/rum` 404 — Cloudflare beacon; not part of the site.
- `? _rsc=` 404s — Next.js RSC prefetch has no static equivalent; link
  clicks fall back to full-page navigation, which works.
- Two CMS images 404 on the origin the assets were sourced from
  (`GP12879.jpg`, `origen-historia-mwc.jpg`) — broken there too, by design.
- React hydration warning #418 in console — attribute-level mismatch from URL
  localization; React recovers and the page renders identically.
