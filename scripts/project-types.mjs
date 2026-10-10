// The quote form's "Project type" dropdown lists the site's own services
// (the menu items), not the template's (Exhibits, Corporate Event, Congress,
// Roadshow, ...). The form reads the options from the page data
// (contactPage.quoteBlock.projectType[].label), pre-selects the first one and
// submits the chosen label as Project_Type - so replacing the list in the
// page data and in the pre-rendered HTML is all it takes.
import { safeReplace, verifyFlight } from './flight.mjs';

export const PROJECT_TYPES = [
  'Mall Calendar Programming',
  'Mall Space Monetization',
  'Brand Activations',
  'Other (please specify)',
];

const BS = String.fromCharCode(92);
const FQ = BS + '"';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function matchBracket(s, i) {
  let depth = 0;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (c === BS) { k++; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return k + 1; }
  }
  return -1;
}
// End of the <div ...> element opening at `at` (balanced on <div> tags).
function divEnd(html, at) {
  const re = /<div\b[^>]*>|<\/div>/g;
  re.lastIndex = at;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return -1;
}

function applyFlight(html) {
  const marker = FQ + 'projectType' + FQ + ':[';
  const want = PROJECT_TYPES.map((label) => ({ label }));
  // As it sits inside a push("...") string: JSON with every " escaped.
  const enc = JSON.stringify(want).replace(/"/g, FQ);
  const seen = new Set();
  let at = 0;
  while (true) {
    const i = html.indexOf(marker, at);
    if (i < 0) break;
    const open = i + marker.length - 1;
    const end = matchBracket(html, open);
    if (end < 0) break;
    const raw = html.slice(open, end);
    if (raw.includes('label') && raw !== enc) seen.add(raw);
    at = end;
  }
  const before = verifyFlight(html).bad;
  let out = html;
  for (const raw of seen) out = safeReplace(out, raw, enc);
  return verifyFlight(out).bad > before ? html : out;
}

function applyStatic(html) {
  let at = 0;
  while (true) {
    const lab = html.indexOf('>Project type</span>', at);
    if (lab < 0) break;
    const open = html.indexOf('<div class="styles_dropdown_wrapper_multi_', lab);
    if (open < 0 || open - lab > 400) { at = lab + 1; continue; }
    const end = divEnd(html, open);
    if (end < 0) break;
    let block = html.slice(open, end);
    // Selected value: the first label span, before the arrow icon.
    block = block.replace(/(<span[^>]*class="Label_label__[^"]*"[^>]*>)([^<]*)(<\/span>)/, (m, a, t, b) => a + esc(PROJECT_TYPES[0]) + b);
    // Option list.
    const listOpen = block.indexOf('<div class="styles_dropdown_wrapper_multi_select__');
    if (listOpen >= 0) {
      const listEnd = divEnd(block, listOpen);
      const optTpl = /<div class="styles_dropdown_wrapper_multi_select_options__[^"]*">(<span[^>]*>)[^<]*<\/span><\/div>/.exec(block.slice(listOpen, listEnd));
      if (listEnd > listOpen && optTpl) {
        const head = /^<div[^>]*>/.exec(block.slice(listOpen))[0];
        const optOpen = optTpl[0].slice(0, optTpl[0].indexOf('>') + 1);
        const spanOpen = optTpl[1].replace(/\sdata-sc-id="[^"]*"/, '');
        const opts = PROJECT_TYPES.map((t) => optOpen + spanOpen + esc(t) + '</span></div>').join('');
        block = block.slice(0, listOpen) + head + opts + '</div>' + block.slice(listEnd);
      }
    }
    html = html.slice(0, open) + block + html.slice(end);
    at = open + block.length;
  }
  return html;
}

export function applyProjectTypes(html) {
  if (typeof html !== 'string' || html.indexOf('projectType') < 0) return html;
  return applyStatic(applyFlight(html));
}
