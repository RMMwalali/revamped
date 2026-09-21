import http from 'node:http';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
// Check if sc-voices is in the static HTML (before the injected JS)
const voicesIdx = html.indexOf('sc-voices');
const secIdx = html.indexOf('var sec=');
console.log('sc-voices at', voicesIdx);
console.log('var sec= at', secIdx);
console.log('Is sc-voices before injected JS:', voicesIdx < secIdx);
// Show the static HTML around the css-5ohagv wrapper
const wrapperIdx = html.indexOf('css-5ohagv');
console.log('css-5ohagv at', wrapperIdx);
if (wrapperIdx >= 0) {
  console.log('=== css-5ohagv context ===');
  console.log(html.slice(wrapperIdx-300, wrapperIdx+500).replace(/\n/g,' '));
}
// Check if the section is empty
const sectionIdx = html.indexOf('<section class="sc-voices">');
console.log('section tag at', sectionIdx);
// Check for the grid
const gridIdx = html.indexOf('sc-voices-grid');
console.log('sc-voices-grid at', gridIdx);
// Check for testimonial cards in static HTML
const staticCards = [...html.slice(0, secIdx).matchAll(/data-sc-voice="testimonial"/g)];
console.log('testimonial cards in static HTML:', staticCards.length);