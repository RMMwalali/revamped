import { writeFileSync, readFileSync } from 'node:fs';
const html = await (await fetch('http://localhost:3105/about')).text();
const buff = Buffer.from(html, 'utf8');
const out = [];
out.push('## local served /about — team roster flight ##');
// The team roster in the flight payload ships as an escaped JSON "members" array
// of {title, content, featuredImage:{node:{sourceUrl}}, memberTemplate:{role,funImage,...}}.
let i = 0, matches = 0;
const key = '\\"members\\":[';
const re = /\\"title\\":\\"((?:[^\\"\\]|\\.)*)\\",\\"content\\":\\"((?:[^\\"\\]|\\.)*)\\",\\"featuredImage\\":\{\\"node\\":\{\\"sourceUrl\\":\\"((?:[^\\"\\]|\\.)*)\\",\\"contentType\\":[\s\S]*?\\"memberTemplate\\"[\s\S]*?\\"role\\":\\"((?:[^\\"\\]|\\.)*)\\"/g;
let m;
while ((m = re.exec(html))) {
  matches++;
  const name = m[1].replace(/\\\\/g, '\\').replace(/\"/g, '"');
  const url = m[3].replace(/\\\\/g, '\\').replace(/\"/g, '"');
  out.push((matches) + '\t' + name + '\t' + m[4].trim() + '\t' + url.split('/').pop());
}
out.push('team member entries matched: ' + matches);
// fallback: count monogram cards that are actually served
out.push('sc-team__member in final html: ' + (html.match(/sc-team__member/g) || []).length);
out.push('sc-vo in final html: ' + (html.match(/class="sc-vo"/g) || []).length);
writeFileSync('team-probe.txt', out.join('\n'), 'utf8');
