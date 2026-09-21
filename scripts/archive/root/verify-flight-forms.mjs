const html = await (await fetch('http://localhost:3000/')).text();
const slugs = ['stillcraft-london-hub', 'do-you-need-an-international-event-agency'];
for (const s of slugs) {
  const plain = html.split(s).length - 1;
  console.log(s, 'plain-occurrences:', plain);
}
// section wrapper occurrences
for (const w of ['styles_invention__bakTB', 'Inside</span><span', 't-338', 't-339', 't-340']) {
  console.log(w, ':', html.split(w).length - 1);
}
// find end of invention section: look for what follows the last insight card
const last = html.lastIndexOf('/insight/do-you-need-an-international-event-agency');
console.log('--- tail after 2nd card link:');
console.log(html.slice(last, last + 2500));
