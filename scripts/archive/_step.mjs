import { applyNav } from './transform.mjs';
import http from 'node:http';

const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});

// Manually step through applyNav
let h = html;
const NAV_LABELS = [
  ['Iventions', 'StillCraft'],
  ['Home', 'Home'],
];
for (const [from, to] of NAV_LABELS) {
  h = h.replace(new RegExp(`>(\\s*)${from}(\\s*)<`, 'g'), `>$1${to}$2<`);
}
console.log('after NAV_LABELS:', (h.match(/\/projects/g)||[]).length);

// applyFlightIA - skip, can't import easily

// The menu removal loop
for (const href of ['/service/congresses', '/projects']) {
  const esc = href.replace(/\//g, '\\/');
  h = h.replace(new RegExp(`<p\\b[^<>]*>\\s*<a\\b[^<>]*href="${esc}"[^<>]*>[\\s\\S]*?<\\/a>\\s*<\\/p>`, 'g'), '');
  h = h.replace(new RegExp(`<a\\b[^<>]*href="${esc}"[^<>]*>[\\s\\S]*?<\\/a>`, 'g'), '');
}
console.log('after menu removal:', (h.match(/\/projects/g)||[]).length);

// Blog removal
h = h.replace(/<a\b[^>]*href="\/insights"[^>]*>[\s\S]*?<\/a>/gi, '');
h = h.replace(/<p\b[^<>]*>\s*<a\b[^<>]*href="\/insights"[^<>]*>[\s\S]*?<\/a>\s*<\/p>/gi, '');
h = h.replace(/<a\b[^>]*href="\/insights"[^>]*>\s*<span[^>]*>\s*Blog\s*<\/span>\s*<\/a>/gi, '');
h = h.replace(/<p\b[^<>]*class="styles_contents_menu_item[^"]*"[^<>]*>\s*<\/p>/gi, '');
console.log('after blog removal:', (h.match(/\/projects/g)||[]).length);