const s = await (await fetch('http://127.0.0.1:3105/')).text();
// flight h4 children near card markers: find children strings adjacent to card subs
for (const m of s.matchAll(/"children":"((?:Brand Activations|Mall Space Monetisation|Mall Space Activation|Our Work|Events|Exhibits|Congresses|Sports|Retail & Malls))"/g)) {
  console.log(JSON.stringify(m[1]), '@', m.index);
}
