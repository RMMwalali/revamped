import { readFileSync } from 'node:fs';
const t = {};
// --- donor iventions.com/about (fresh fetch, already captured to disk) ---
let donorBuf = '';
try { donorBuf = readFileSync(process.env.TEMP + '\\donor-about.html', 'utf8'); } catch {}
const dh = donorBuf;
const card = (body) => {
  const img = (/(?:<img[^>]+src="([^"]+)"|sourceUrl":"([^"]+))/.exec(body) || [])[1] || '';
  const name = (/<h3[^>]*>([^<]+)<\/h3>/.exec(body) || [])[1] || '';
  const title = (/(?:sc-vo-title|sc-talent__title|styles_talent_name__[^>]*>)([^<]+)/.exec(body) || [])[1] || '';
  return name.trim() + '\t' + title.trim() + '\t' + img.split('/').pop();
};
// donor card markers
t.donor_sc_vo_articles = (dh.match(/class="sc-vo"/g) || []).length;
t.donor_talent_section = (dh.match(/styles_talent__AlRC3/g) || []).length;
t.donor_talent_member = (dh.match(/styles_talent_name__AlRC3/g) || []).length;
const donorRe = /<article[^>]*class="[^"]*styles_talent__AlRC3[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
let m, donorNames = [];
while ((m = donorRe.exec(dh))) {
  const body = m[1];
  const img = (/(?:<img[^>]+src="([^"]+)"|sourceUrl":"([^"]+)")/.exec(body) || [])[1] || '';
  const name = (/<\s*h3[^>]*>([^<]+)<\/h3>/.exec(body) || [])[1] || '';
  if (name.trim()) donorNames.push(name.trim() + '\t' + img.split('/').pop());
}
t.donor_direct_articles = donorNames.length;
t.donor_direct_sample = donorNames.slice(0, 4);
const donorFlightRe = /"title":"([^"]{3,80})","content":"[^"]*","featuredImage":{"node":{"sourceUrl":"([^"]+\.(?:jpg|png|webp))"[\s\S]{0,2000}?"role":"([^"]{1,60})"/g;
let f, donorFlight = [];
while ((f = donorFlightRe.exec(dh))) {
  donorFlight.push(f[1] + '\t' + f[3] + '\t' + f[2].split('/').pop());
}
t.donor_flight_titles = donorFlight.length;
t.donor_flight_sample = donorFlight.slice(0, 6 vines);
t.donor_len = dh.length;
t.donor_join = dh.includes('Join our team');
await writeFileSync(process.env.TEMP + '\\donor-probe-out.txt', JSON.stringify(t, null, 1), 'utf8');
console.log(JSON.stringify(t, null, 1));
