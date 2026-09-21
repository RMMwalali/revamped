const s = await (await fetch('http://127.0.0.1:3105/')).text();
const ms = [...s.matchAll(/<h4[^>]*class="css-hj2ayb"[^>]*>([^<]+)<\/h4>/g)];
const m = ms[3];
console.log('4th h4:', JSON.stringify(m[1]));
const win = s.slice(Math.max(0, m.index - 500), m.index + 6000);
// find anchor start before h4 and its end after
const aOpen = win.lastIndexOf('<a ');
console.log('ANCHOR:', JSON.stringify(win.slice(aOpen, aOpen + 160)));
const fwd = s.slice(m.index, m.index + 9000);
const a2 = fwd.match(/<a title="([^"]+)" href="([^"]+)"/);
console.log('NEXT-LINK:', a2 && a2[1] + ' -> ' + a2[2]);
// subs after h4
console.log('SUBS:', [...fwd.slice(0, 4000).matchAll(/>(Mall Programmes,|Brand Campaigns, Case Studies|Sponsorship, Activations, |Venue Transformation|Year-Round[^<]*|Seasonal[^<]*|Vacant[^<]*|Campaigns[^<]*)</g)].map(x => x[1]));
