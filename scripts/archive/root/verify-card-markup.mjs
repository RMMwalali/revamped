const html = await (await fetch('http://localhost:3000/')).text();
const i = html.indexOf('/insight/stillcraft-london-hub');
console.log(html.slice(Math.max(0, i - 1500), i + 1500));
