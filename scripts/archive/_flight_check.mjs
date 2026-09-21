import http from 'node:http';
import { writeFileSync } from 'node:fs';
const html = await new Promise((res,rej)=>{
  http.get('http://localhost:3000/',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);
});
writeFileSync('C:\\BACKUPS\\STILLLCRAFT\\_home5.html', html);
// Check the flight data for the testimonial section
const flightIdx = html.indexOf('self.__next_f');
console.log('flight at', flightIdx);
// Find the testimonial section in flight data
const secIdx = html.indexOf('sc-voices');
console.log('sc-voices at', secIdx);
// Check if the section is in flight data
const flightData = html.slice(flightIdx);
const secInFlight = flightData.indexOf('sc-voices');
console.log('sc-voices in flight:', secInFlight >= 0 ? 'YES' : 'NO');
// Check the inject function
const injectIdx = html.indexOf('var inject=');
console.log('inject at', injectIdx);
// Check if css-5ohagv is in flight data
const css5ohagvInFlight = flightData.indexOf('css-5ohagv');
console.log('css-5ohagv in flight:', css5ohagvInFlight >= 0 ? 'YES' : 'NO');
// Check if the section is inside a script tag
const scriptStart = html.lastIndexOf('<script', secIdx);
const scriptEnd = html.indexOf('</script>', secIdx);
console.log('section in script:', scriptStart >= 0 && scriptEnd >= 0 && scriptStart < secIdx && secIdx < scriptEnd);
// Check the parent element
const beforeSection = html.slice(Math.max(0,secIdx-500), secIdx);
console.log('Before section:', beforeSection.slice(-300));