import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';

const src = 'Stillcraft_logo.png';
const buf = readFileSync(src);

// Square PNG favicons: logo centered with 10% padding on transparent background
for (const [size, out] of [
  [256, 'dist/assets/root/favicon.png'],
  [192, 'dist/web-app-manifest-192x192.png'],
  [512, 'dist/web-app-manifest-512x512.png']
]) {
  const padded = Math.round(size * 0.88);
  const resized = await sharp(buf).resize(padded, padded, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  const canvas = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left: Math.round((size - padded) / 2), top: Math.round((size - padded) / 2) }])
    .png().toBuffer();
  await writeFile(out, canvas);
  console.log(`wrote ${out} (${size}x${size}, ${canvas.length} bytes)`);
}

// ICO: use sharp's pipeline - create 32bpp BMP-style ICO manually
const icoSize = 256;
const icoResized = await sharp(buf).resize(icoSize, icoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
// For ICO, we embed a PNG directly (modern Windows supports PNG-in-ICO)
// ICO header(6) + dir_entry(16) + PNG data
const icoDirEntry = Buffer.alloc(16);
icoDirEntry[0] = icoSize;  // width
icoDirEntry[1] = icoSize;  // height
icoDirEntry[2] = 0;        // color palette
icoDirEntry[3] = 0;        // reserved
icoDirEntry.writeUInt16LE(1, 4);   // color planes
icoDirEntry.writeUInt16LE(32, 6);  // bits per pixel
icoDirEntry.writeUInt32LE(icoResized.length, 8);  // data size
icoDirEntry.writeUInt32LE(22, 12); // data offset (6 + 16)

const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0);  // reserved
icoHeader.writeUInt16LE(1, 2);  // type: icon
icoHeader.writeUInt16LE(1, 4);  // image count

const icoBuf = Buffer.concat([icoHeader, icoDirEntry, icoResized]);
await writeFile('dist/favicon.ico', icoBuf);
await writeFile('dist/assets/root/favicon.ico', icoBuf);
console.log(`wrote favicon.ico (${icoBuf.length} bytes)`);
console.log('done');
process.exit(0);
