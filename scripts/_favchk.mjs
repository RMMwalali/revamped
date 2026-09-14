import { readFileSync } from 'node:fs';
for (const p of ['dist/assets/root/favicon.png', 'dist/favicon.ico', 'dist/assets/root/favicon.ico', 'dist/web-app-manifest-192x192.png', 'dist/web-app-manifest-512x512.png']) {
  try {
    const b = readFileSync(p);
    if (p.endsWith('.png')) console.log(p, 'PNG', b.readUInt32BE(16), 'x', b.readUInt32BE(20));
    else console.log(p, 'ICO bytes', b.length, 'sig', b.toString('latin1', 0, 6));
  } catch (e) { console.log(p, 'MISSING'); }
}
process.exit(0);