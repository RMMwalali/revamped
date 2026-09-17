const html = await (await fetch('http://localhost:3000/')).text();
// find all /insight/ links
const links = [...html.matchAll(/href="(\/insight\/[^"]+)"/g)].map(x => x[1]);
console.log('insight links:', links.length, [...new Set(links)].join(' | '));
// section context: find nearest <section before first card
const first = html.indexOf('/insight/');
const secStart = html.lastIndexOf('<section', first);
console.log('--- section open tag:', html.slice(secStart, secStart + 300).replace(/\s+/g, ' '));
// heading text near section start
const head = html.slice(secStart, first);
const heads = [...head.matchAll(/<(h2|h3|p)[^>]*>([^<>]{3,80})<\/(h2|h3|p)>/g)].map(x => x[2].trim());
console.log('--- headings in section:', heads.join(' | '));
// data-sc-ids in section
const ids = [...head.matchAll(/data-sc-id="([^"]+)"/g)].map(x => x[1]);
console.log('--- sc ids:', [...new Set(ids)].join(','));
