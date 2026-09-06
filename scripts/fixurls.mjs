import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('dist');
const assetsRoot = 'assets/root';

// Fix url(...) inside CSS files (fonts, mask svg)
const cssDir = path.join(OUT, 'assets', 'root', '_next', 'static', 'css');
async function processCss() {
  for (const e of await readdir(cssDir)) {
    if (!e.endsWith('.css')) continue;
    const f = path.join(cssDir, e);
    let css = await readFile(f, 'utf8');
    css = css
      .replace(/url\(\/_next\/static\/([^)]+)\)/g, `url("/${assetsRoot}/_next/static/$1")`)
      .replace(/url\(\/(test-mask\.svg)\)/g, `url("/${assetsRoot}/$1")`)
      .replace(/url\(\/(upload\/[^)]+)\)/g, `url("/${assetsRoot}/$1")`)
      .replace(/url\(\/(icons\/[^)]+)\)/g, `url("/${assetsRoot}/$1")`);
    await writeFile(f, css, 'utf8');
    console.log('CSS rewritten:', path.relative(OUT, f));
  }
}

// Fix url(...) inside inline emotion <style> tags in HTML
const htmlFiles = [];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full);
    else if (e.name.endsWith('.html')) htmlFiles.push(full);
  }
}

async function processHtml() {
  await walk(OUT);
  for (const f of htmlFiles) {
    let html = await readFile(f, 'utf8');
    html = html
      .replace(/url\(\/_next\/static\/([^)]+)\)/g, `url("/${assetsRoot}/_next/static/$1")`)
      .replace(/url\(\/(test-mask\.svg)\)/g, `url("/${assetsRoot}/$1")`)
      .replace(/url\(\/(upload\/[^)]+)\)/g, `url("/${assetsRoot}/$1")`)
      .replace(/url\(\/(icons\/[^)]+)\)/g, `url("/${assetsRoot}/$1")`)
      // background-image url(https://cms.iventions.com/...) already handled, but ensure no strays
      .replace(/url\((https:\/\/cms\.iventions\.com)(\/[^)]+)\)/g, `url("/assets/cms$2")`);
    await writeFile(f, html, 'utf8');
    console.log('HTML rewritten:', path.relative(OUT, f));
  }
}

await processCss();
await processHtml();
console.log('DONE CSS/HTML url rewrite');
