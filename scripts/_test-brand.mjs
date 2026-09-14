import { applyBrand } from './scripts/transform.mjs';
const brand = { site_name: 'StillCraft Events', logo_src: '/assets/custom/stillcraft-logo.png', primary_color: '#1B2A4A' };
const html = '<head></head><figure class="styles_logo__7LWm4 css-0"><div class="css-sjw2nw"><img data-nimg="fill" style="position:absolute;height:100%;width:100%;left:0;top:0;right:0;bottom:0;color:transparent" src="/assets/cms/wp-content/uploads/2025/06/icon-logo.svg"></div></figure>';
const out = applyBrand(html, brand);
console.log('has sc-logo-style:', out.includes('sc-logo-style'));
console.log('has mix-blend-mode:normal:', out.includes('mix-blend-mode:normal'));
console.log('has object-fit:contain:', out.includes('object-fit:contain'));
console.log(out);
process.exit(0);