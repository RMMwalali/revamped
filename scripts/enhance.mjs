import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('dist');

async function processHtml() {
  const files = [];
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.name.endsWith('.html')) files.push(full);
    }
  }
  await walk(OUT);

  const inject = `<!-- IVENTIONS:START -->
<link rel="stylesheet" href="/assets/iv-smooth.css">
<script src="/vendor/gsap.min.js"></script>
<script src="/vendor/ScrollTrigger.min.js"></script>
<script src="/vendor/lenis.min.js"></script>
<script src="/assets/iv-animate.js"></script>
<!-- IVENTIONS:END -->
</body>`;

  for (const f of files) {
    let html = await readFile(f, 'utf8');
    html = html.replace(/<!-- IVENTIONS:START -->[\s\S]*?<!-- IVENTIONS:END -->/g, ''); // idempotent
    html = html.replace(/(<\/body>)/i, inject);
    await writeFile(f, html, 'utf8');
    console.log('Injected into', path.relative(OUT, f));
  }
}

await processHtml();
console.log('DONE enhance');
