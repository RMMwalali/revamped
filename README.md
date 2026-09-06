# Iventions Clone

Pixel-faithful static clone of <https://iventions.com>, built from the live
site's own rendered HTML. Same stack output as the original (Next.js App
Router + Emotion + Motion + Lenis + Three.js/R3F), served as static files —
no re-implementation, no mock content.

## Prerequisites

- Node.js 18+ (`node --version`)
- npm (`npm --version`)
- Playwright Chromium (only needed for scraping / verification):
  `npx playwright install chromium`

## Setup

```powershell
cd C:\BACKUPS\STILLLCRAFT
npm install
```

## Run (view in browser)

```powershell
npm run serve
```

Then open <http://localhost:3000>.

`npm run serve` uses `scripts/serve.mjs`, a tiny static server that also shims
the Next.js image optimizer (`/_next/image?url=…` → local file), so hydrated
images resolve exactly like on the live site.

Plain static hosts work too (the clone ships `compat.js` + `sw.js`, which
register a service worker that serves those same optimizer URLs locally):

```powershell
npx serve dist -l 3000 --cors
```

## Stop the server

Free port 3000 (Windows PowerShell):

```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess) -Force
```

## Restart the project

```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess) -Force; Start-Sleep -Seconds 2; npm run serve
```

Or run detached in the background (logs to `serve.log`):

```powershell
Start-Process -FilePath "node" -ArgumentList "scripts/serve.mjs", "3000" -WorkingDirectory "C:\BACKUPS\STILLLCRAFT" -RedirectStandardOutput "C:\BACKUPS\STILLLCRAFT\serve.log" -WindowStyle Hidden
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

```powershell
node scripts/rebuild.mjs; node scripts/assets.mjs; node scripts/mirror.mjs
```

## Project structure

```text
scraped/            source of truth: raw HTML captured from the live site
dist/               the servable clone (54 pages)
  index.html        home, /home/index.html mirrors it (original links Home → /home)
  about/  contact/  insights/  projects/  service/  insight/  project/
  _next/  upload/  icons/      mirrored to original absolute paths
  assets/cms/       CMS images  |  assets/root/_next/  JS/CSS/fonts
  sw.js  compat.js  CLONE-COMPAT only: image-optimizer shim for plain hosts
scripts/            pipeline (see table above)
```

## Notes / expected console noise

These are harmless and also occur (or are equivalent) on the live site:

- `ERR_BLOCKED_BY_CLIENT` for `cookiebot` / `cloudflareinsights` — your
  adblocker, not the clone.
- `POST /cdn-cgi/rum` 404 — Cloudflare beacon; not part of the site.
- `? _rsc=` 404s — Next.js RSC prefetch has no static equivalent; link
  clicks fall back to full-page navigation, which works.
- Two CMS images 404 on the live origin itself
  (`GP12879.jpg`, `origen-historia-mwc.jpg`) — broken there too, by design.
- React hydration warning #418 in console — attribute-level mismatch from URL
  localization; React recovers and the page renders identically.
