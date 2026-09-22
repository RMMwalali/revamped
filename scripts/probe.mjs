import { writeFileSync } from 'node:fs';
const out = {};
const ares = await (await fetch('http://localhost:3105/about')).text();
out.served = {
  len: ares.length,
  team_accordion: (ares.match(/data-sc-voice="team"/g) || []).length,
  scvo_class: (ares.match(/class="sc-vo"/g) || []).length,
  scvo_media_img: (ares.match(/sc-vo-media/g) || []).length,
  portrait_imgs: (ares.match(/_portrait\.(?:jpg|png|webp)/g) || []).length,
  join_our_team: /join our team/i.test(ares),
  teamMount_present: ares.includes('sc-team') || ares.includes('sc-voices-grid'),
};
const donorRes = await (await fetch('https://iventions.com/about', { headers: { 'user-agent': 'Mozilla/5.0' } })).text();
out.donor = {
  len: donorRes.length,
  scvo_class: (donorRes.match(/class="sc-vo"/g) || []).length,
  portraits_imgs: (donorRes.match(/_portrait\.(?:jpg|png|webp)/g) || []).length,
  iventions_word: /iventions/i.test(donorRes),
};
writeFileSync(process.env.TEMP + '\\donor-out.json', JSON.stringify(out, null, 1), 'utf8');
console.log(JSON.stringify(out, null, 1));
