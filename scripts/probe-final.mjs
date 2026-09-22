import { writeFileSync } from 'node:fs';
const t = {};
// --- served local /about ---
const lh = await (await fetch('http://localhost:3105/about')).text();
t.served_len = lh.length;
t.served_sc_team_member = (lh.match(/sc-team__member/g) || []).length;
t.served_sc_team_mono = (lh.match(/sc-team__mono/g) || []).length;
t.served_sc_vo = (lh.match(/class="sc-vo"/g) || []).length;
t.served_sc_vo_media_img = (lh.match(/sc-vo-media/g) || []).length;
t.served_join_our_team = /join our team/i.test(lh);
t.served_talent_refs = (lh.match(/styles_talent__AlRC3/g) || []).length;
// portraits referenced anywhere in served payload
t.served_portrait_refs = (lh.match(/_portrait\.jpg/g) || []).length;
// which mount script is embedded
t.served_teamMount = lh.includes('function teamMountScript');   // monogram sc-team
t.served_voicesMount = lh.includes('sc-voices-grid');           // voices sc-vo
// --- donor iventions.com/about ---
const dh = await (await fetch('https://iventions.com/about')).text();
t.donor_len = dh.length;
t.donor_sc_vo = (dh.match(/class="sc-vo"/g) || []).length;
t.donor_sc_vo_media_img = (dh.match(/sc-vo-media/g) || []).length;
t.donor_portrait_refs = (dh.match(/_portrait\.jpg/g) || []).length;
// donor roster names (in card order): title + portrait pairs
const names = [];
let i = 0, c = 0;
const key = '"title":"';
while ((i = dh.indexOf(key, i)) >= 0 && c < 200) {
  const j = dh.indexOf('","', i);
  if (j < 0) break;
  const title = dh.slice(i + key.length, j);
  const k = dh.indexOf('sourceUrl":"', j);
  if (k < 0) break;
  const kEnd = dh.indexOf('"', k + 12);
  if (kEnd < 0) break;
  const url = dh.slice(k + 12, kEnd);
  names.push((title.length > 3 && !/^(Home|About|Contact|Join|Our|The|StillCraft|What|How|Why)$/i.test(title)) ? title : null);
  i = kEnd + 1;
  c++;
}
const roster = names.filter(Boolean);
t.donor_roster_count = roster.length;
t.donor_roster_sample = roster.slice(0, 6);
writeFileSync(process.env.PROBE_OUT || 'probe-out.txt', JSON.stringify(t, null, 2), 'utf8');
console.log(JSON.stringify(t, null, 2));
