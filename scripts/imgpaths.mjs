// Shared width ladder for the image optimizer.
//
// Imported by both the build-time markup rewriter (scripts/optimize-images.mjs)
// and the runtime resizer (api/img.js / scripts/serve.mjs) so the widths that
// get written into `srcset` always hit a cache key the resizer serves.
//
// The small end matters as much as the large end: the template ships 32x32 blur
// placeholders that request w=32, so a ladder floored at 640 answered a
// placeholder with a 640px file, costing a header logo roughly the same as a
// hero. This mirrors how Next.js splits `imageSizes` (small) from
// `deviceSizes` (large).
export const LADDER = [16, 32, 48, 64, 96, 128, 256, 384, 512, 640, 750, 828, 1080, 1200, 1440, 1920, 2560, 3840];

// Nearest rung at or above w: the browser must never be given a file smaller
// than its candidate claims, which reads as a soft/blurry image.
export function snapWidth(w) {
  const n = Number(w) || 0;
  if (n <= 0) return 0;
  for (const l of LADDER) if (l >= n) return l;
  return LADDER[LADDER.length - 1];
}

// Raster formats we resize. gif is deliberately absent: animation must survive
// intact, and a still frame would be a visible regression. svg/ico are vector
// and pass through untouched.
const RESIZABLE = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp', 'tif', 'tiff']);
export function extOf(p) {
  const m = /\.([a-z0-9]+)$/i.exec(String(p).split('?')[0].split('#')[0]);
  return m ? m[1].toLowerCase() : '';
}
export function isResizable(p) { return RESIZABLE.has(extOf(p)); }
