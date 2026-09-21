const s = await (await fetch('http://127.0.0.1:3105/')).text();
const pat = /\\"children\\":\\"((?:Brand Activations|Mall Space Monetisation|Mall Space Activation|Our Work|Events|Exhibits|Congresses|Sports|Retail & Malls|Retail \\u0026 Malls))\\"/g;
let m, n = 0;
while ((m = pat.exec(s)) && n < 40) { console.log(JSON.stringify(m[1])); n++; }
console.log('---also raw-quote form above was empty; now menu titles---');
const pat2 = /\\"title\\":\\"((?:Brand Activations|Mall Space Monetisation|Mall Space Activation|Our Work|Events|Exhibits|Congresses|Sports|Retail & Malls))\\"/g;
n = 0;
while ((m = pat2.exec(s)) && n < 40) { console.log('title:', JSON.stringify(m[1])); n++; }
