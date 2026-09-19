import { readFile } from 'node:fs/promises';

const src = await readFile('dist/assets/root/_next/static/chunks/vendors-27161c75-1ac32bdba4aff7a0.js', 'utf8');
for (const at of [16085, 18592, 12550, 10269]) {
  console.log(`\n===== around offset ${at} =====`);
  console.log(src.slice(Math.max(0, at - 1200), at + 1800));
}