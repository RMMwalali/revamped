// StillCraft content guide (client's "StillCraft Events Website - Content
// Guide", highlighted PDF edition) applied to the service and legal pages.
//
// Why a separate pass: these pages still carried the template agency's copy
// in slots the earlier per-element rows (stillcraft-content.mjs) could not
// reach — the hero line and intro, card descriptions, the services list
// details, FAQ answers and closing headings live in the Next.js flight data,
// and some only changed in the first-paint markup, so hydration put the old
// copy back. This pass sets each slot by its place in the page data (anchor +
// key + index), so the value is replaced wherever it currently stands, and
// rewrites the matching first-paint markup from the same value.
//
// Wording is the guide's, verbatim. Where the template has a slot the guide
// has no section for, the slot gets the guide's own heading for the content
// placed there (see the notes per page).
import { safeReplacePushes, verifyFlight, parseSeg, findLenRows, decodeFully, encodeJs } from './flight.mjs';

const BS = String.fromCharCode(92);
const FQ = BS + '"';

// ---------- encoding ----------
// Plain value -> the form a string takes inside a plain flight JSON row
// (push-string plane: JSON escapes are themselves escaped once more).
function encRow(s) {
  let out = '';
  for (const ch of String(s)) {
    if (ch === '\\') out += BS + BS + BS + BS;
    else if (ch === '"') out += BS + BS + BS + '"';
    else if (ch === '\n') out += BS + BS + 'n';
    else if (ch === '\r') out += BS + BS + 'r';
    else if (ch === '\t') out += BS + BS + 't';
    else if (ch === '<') out += BS + 'u003c';
    else if (ch === '>') out += BS + 'u003e';
    else if (ch === '&') out += BS + 'u0026';
    else out += ch;
  }
  return out;
}
// Raw flight row value -> plain text (both escape levels).
function decRow(raw) {
  let s = '', i = 0;
  const one = (str) => {
    let o = '';
    for (let k = 0; k < str.length; k++) {
      const c = str[k];
      if (c !== BS) { o += c; continue; }
      const n = str[k + 1];
      if (n === 'n') { o += '\n'; k++; }
      else if (n === 'r') { o += '\r'; k++; }
      else if (n === 't') { o += '\t'; k++; }
      else if (n === '"') { o += '"'; k++; }
      else if (n === BS) { o += BS; k++; }
      else if (n === 'u' && /^[0-9a-fA-F]{4}/.test(str.slice(k + 2, k + 6))) { o += String.fromCharCode(parseInt(str.slice(k + 2, k + 6), 16)); k += 5; }
      else o += c;
    }
    return o;
  };
  s = one(one(raw));
  void i;
  return s;
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = (s) => String(s)
  .replace(/&nbsp;/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const stripTags = (s) => String(s).replace(/<br\b[^>]*>/gi, ' ').replace(/<[^>]*>/g, ' ');
const norm = (s) => unesc(stripTags(s)).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- flight: set one field by anchor + key + index ----------
// Reads the raw value at the idx-th `\"key\":\"` after `anchor`, writes the
// new value in place (all copies of the anchor), and returns the old plain
// values so the first-paint markup can be matched against them.
function readRaw(html, at) {
  // `at` points just past the opening \" of the value; scan to the closing \"
  let k = at;
  while (k < html.length) {
    if (html[k] === BS) {
      if (html[k + 1] === '"') return k;
      k += 2;
      continue;
    }
    k++;
  }
  return -1;
}
function setField(html, spec, olds, readOnly) {
  const { anchor, key, idx = 0, value } = spec;
  const keyTok = key === 'ctaHeading'
    ? FQ + 'all' + FQ + ':' + FQ + 'inherit' + FQ + ',' + FQ + 'children' + FQ + ':' + FQ
    : FQ + key + FQ + ':' + FQ;
  let from = 0, guard = 0;
  while (guard++ < 4) {
    const a = html.indexOf(anchor, from);
    if (a < 0) break;
    let p = a - 1, n = -1;
    for (let i = 0; i <= idx; i++) {
      p = html.indexOf(keyTok, p + 1);
      if (p < 0 || p - a > 80000) { n = -1; break; }
      n = p;
    }
    from = a + anchor.length;
    if (n < 0) continue;
    const vs = n + keyTok.length;
    const ve = readRaw(html, vs);
    if (ve < 0) continue;
    const raw = html.slice(vs, ve);
    // Flight line breaks are \r\n, as the CMS stored them; HTML answers keep
    // their own markup. Closing headings are one string the page splits into
    // lines itself.
    const flightValue = key === 'ctaHeading' || key === 'alt' ? value.split('\n').join(' ')
      : /<p\b/.test(value) ? value : value.split('\n').join('\r\n');
    const next = encRow(flightValue);
    olds.push(decRow(raw));
    if (readOnly || raw === next) continue;
    const before = verifyFlight(html).bad;
    // In-place splice (plain JSON rows carry no byte length) ...
    let cand = html.slice(0, vs) + next + html.slice(ve);
    // ... unless that broke a length-framed row: then the framed path.
    if (verifyFlight(cand).bad > before) {
      cand = safeReplacePushes(html, keyTok + raw + FQ, keyTok + next + FQ);
      if (verifyFlight(cand).bad > before) continue;
    }
    html = cand;
  }
  return html;
}

// ---------- first paint: rewrite the static copy of a value ----------
const VOID = new Set(['br', 'img', 'input', 'hr', 'meta', 'link', 'source', 'wbr', 'col', 'area', 'base', 'embed', 'track', 'param']);
// Top-level child elements of an HTML fragment: [{start, end}].
function childElements(frag) {
  const out = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
  let depth = 0, start = -1, m;
  while ((m = re.exec(frag))) {
    const close = m[1] === '/', tag = m[2].toLowerCase(), self = m[3] === '/' || VOID.has(tag);
    if (close) {
      depth--;
      if (depth === 0 && start >= 0) { out.push({ start, end: re.lastIndex }); start = -1; }
    } else if (!self) {
      if (depth === 0) start = m.index;
      depth++;
    } else if (depth === 0) {
      out.push({ start: m.index, end: re.lastIndex });
    }
  }
  return out;
}
// End of the element opening at `open` (balanced on its own tag name).
function elementEnd(html, open) {
  const tag = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(html.slice(open, open + 20));
  if (!tag) return -1;
  const name = tag[1].toLowerCase();
  const re = new RegExp('<(/?)' + name + '\\b[^>]*>', 'gi');
  re.lastIndex = open;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[1]) { depth--; if (depth === 0) return re.lastIndex; }
    else depth++;
  }
  return -1;
}
const setUnitText = (unit, text, keepId) => {
  let u = keepId ? unit : unit.replace(/ data-sc-id="[^"]*"/g, '');
  let done = false;
  u = u.replace(/>([^<>]*[^<>\s][^<>]*)</, () => { done = true; return '>' + esc(text) + '<'; });
  return done ? u : unit;
};
// Split-text wrappers (`<div class="undefined will-change-transform">`, one
// child per rendered line): rebuild the children from the first one.
function rewriteSplit(seg, oldN, value) {
  const opener = /<div class="(?:css-0 )?undefined will-change-transform"[^>]*>/g;
  let out = '', last = 0, m, hit = false;
  while ((m = opener.exec(seg))) {
    const end = elementEnd(seg, m.index);
    if (end < 0) continue;
    const innerStart = m.index + m[0].length, innerEnd = end - '</div>'.length;
    const inner = seg.slice(innerStart, innerEnd);
    if (norm(inner) !== oldN) continue;
    let kids = childElements(inner), host = null;
    if (kids.length === 1) {
      const only = inner.slice(kids[0].start, kids[0].end);
      const o = /^<[^>]+>/.exec(only)[0];
      const sub = childElements(only.slice(o.length, only.length - (only.length - only.lastIndexOf('</'))));
      if (sub.length > 1) host = { open: o, close: only.slice(only.lastIndexOf('</')), body: only.slice(o.length, only.lastIndexOf('</')), kids: sub };
    }
    const lines = value.includes('\n') ? value.split('\n').map((l) => l.trim()).filter(Boolean) : [value];
    let built;
    if (host) {
      const units = host.kids.map((k) => host.body.slice(k.start, k.end));
      built = host.open + lines.map((l, i) => setUnitText(units[Math.min(i, units.length - 1)], l, i < units.length)).join('') + host.close;
    } else {
      if (!kids.length) continue;
      const units = kids.map((k) => inner.slice(k.start, k.end));
      built = lines.map((l, i) => setUnitText(units[Math.min(i, units.length - 1)], l, i < units.length)).join('');
    }
    built = built.replace(/--line-index: ?\d+/g, (() => { let n = 0; return () => '--line-index: ' + (n++); })());
    out += seg.slice(last, innerStart) + built;
    last = innerEnd;
    hit = true;
  }
  return hit ? out + seg.slice(last) : seg;
}
function rewriteStatic(html, olds, value) {
  const keys = [...new Set(olds.map(norm).filter((s) => s.length > 1))];
  if (!keys.length) return html;
  const plainNew = value.replace(/<[^>]*>/g, '').trim();
  const isHtml = /<p\b/.test(value);
  const parts = html.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)/gi);
  for (let i = 0; i < parts.length; i += 2) {
    let seg = parts[i];
    for (const k of keys) {
      // 1) split-text wrappers (multi-line headings, wrapped paragraphs)
      seg = rewriteSplit(seg, k, isHtml ? plainNew : value);
      // 2) <br>-separated lists (services details, mobile slider)
      seg = seg.replace(/(<div class="Paragraph_paragraph__SId_Y[^"]*"[^>]*>)((?:[^<]|<br class="css-0">)+)(<\/div>)/g,
        (m, a, body, c) => (body.includes('<br') && norm(body) === k ? a + value.split('\n').map((l) => esc(l.trim())).join('<br class="css-0">') + c : m));
      // 3) single text nodes
      seg = seg.replace(/>([^<>]+)</g, (m, t) => (norm(t) === k ? '>' + esc(plainNew.split('\n').join(' ')) + '<' : m));
      // 4) image alt text
      seg = seg.replace(/ alt="([^"]*)"/g, (m, t) => (norm(t) === k ? ' alt="' + esc(plainNew.split('\n').join(' ')).replace(/"/g, '&quot;') + '"' : m));
    }
    parts[i] = seg;
  }
  return parts.join('');
}

// ---------- page specs ----------
const SVC = 'LandingDynamicContentDynamicLayoutServicesLayout';
const FAQ = 'LandingDynamicContentDynamicLayoutFaqLayout';
const CTA = 'LandingDynamicContentDynamicLayoutCtaLayout';
const HERO = FQ + 'cardBlock' + FQ;
const CARDS = FQ + 'card' + FQ + ':[';
const QUOTE = FQ + 'quote' + FQ;
const f = (anchor, key, idx, value, also) => ({ anchor, key, idx, value, also: also || [] });
const p = (s) => '<p>' + s + '</p>\n';

// Malls & Retail ("Mall Calendar Programming", stored as /service/exhibits).
// Template slots -> guide: hero = "One calendar, run for you"; quote + three
// cards = "What We Take Off Your Plate" (Shop Launches and Tenant Support
// share the third card); services list = "Why Malls Bring Us In" (4) plus
// "Eight Moments, Planned Every Year", "What The Programme Moves" and its
// case-study placeholders; closing = "Let's Take The Calendar Off Your Plate".
const MALLS = [
  f(HERO, 'label', 0, 'One calendar, run for you.\nNot just planned.'),
  f(HERO, 'description', 0, "Building a year round programme in house means chasing vendors, staffing every activation, and hoping the entertainment lineup still makes sense by August. StillCraft plans, staffs, and runs the entire calendar for you, one team, accountable for every date on it, so your team can manage the center instead of managing a calendar."),
  f(QUOTE, 'quote', 0, "We run the calendar\nso your team\ndoesn't have to."),
  f(CARDS, 'heading', 0, 'Entertainment Programmes'),
  f(CARDS, 'description', 0, 'Recurring activations across four categories, Creative Economy, Family Entertainment, STEM, and Wellness, sourced, staffed, and run by us so your team never has to chase a vendor.'),
  f(CARDS, 'heading', 1, 'Seasonal Calendar'),
  f(CARDS, 'description', 1, 'Eight annual moments planned a year ahead of the retail curve, so your team is never scrambling to fill a date in the last month before it lands.'),
  f(CARDS, 'heading', 2, 'Shop Launches & Tenant Support'),
  f(CARDS, 'description', 2, "A proper opening day moment for every new tenant, coordinated directly with center management, so a launch never falls to whoever has time that week. Ongoing coordination that keeps individual tenants folded into the center's wider programme, without adding another task to your team's plate."),
  f(SVC, 'heading', 0, 'The team that stays accountable for the whole calendar.'),
  f(SVC, 'description', 0, 'We are not a vendor you book activation by activation. StillCraft plans and runs the full year, which means the calendar that gets approved in January is the same one your team sees delivered in December.'),
  f(SVC, 'name', 0, 'Eight Years Running Calendars, Not Just Planning Them'),
  f(SVC, 'detail', 0, 'Eight years staffing and delivering mall programming on the ground, with the vendor relationships and systems that come from doing it repeatedly, not just proposing it.'),
  f(SVC, 'name', 1, 'One Team From Planning To The Floor'),
  f(SVC, 'detail', 1, 'The team that builds your calendar is the same team that staffs and runs it, so nothing gets lost between a proposal deck and what actually shows up on the day.'),
  f(SVC, 'name', 2, 'Built Around Your Tenant Mix, Not A Template'),
  f(SVC, 'detail', 2, "Every calendar starts with your center's actual traffic patterns and tenant mix, and is planned to fit them, not pulled from a generic events list."),
  f(SVC, 'name', 3, 'Every Season Closes With A Report'),
  f(SVC, 'detail', 3, "You get a clear account of what each season delivered, so next year's calendar is planned on evidence, not guesswork."),
  f(SVC, 'name', 4, 'Eight Moments, Planned Every Year'),
  f(SVC, 'detail', 4, "New Year (January)\nValentine's Day (February)\nEaster Weekend\nMother's Day\nFather's Day\nBack To School\nHalloween\nChristmas"),
  f(SVC, 'name', 5, 'What The Programme Moves'),
  f(SVC, 'detail', 5, 'Handled end to end, and reported back. Eight years running calendars for shopping malls, more than eighty clients served, and one team accountable for every date, start to finish.'),
  f(SVC, 'name', 6, 'Footfall · Dwell Time · Tenant Sales'),
  f(SVC, 'detail', 6, 'Case study pending, figures to be added once client data is confirmed.'),
  // The guide drops the Father's Day / Galleria figures until real data is in.
  f(FAQ, 'answer', 3, p("Every season closes with a report. You get a clear account of what each season delivered, so next year's calendar is planned on evidence, not guesswork.")),
  f(CTA, 'alt', 0, "Let's take the calendar off your plate"),
  f(CTA, 'ctaHeading', 0, "Let's take the\ncalendar off\nyour plate", ["Let's take the calendar off your plate"]),
];

// Mall Space Activation and Space Monetization (stored as /service/congresses).
// hero = "Nobody In Kenya Owns The Space In Between"; cards = The Problem /
// The Opportunity / The Service; services list = "How It Works" (5 steps),
// "Revenue Model" and the two placeholder figures; FAQ answers that still
// carried the template's conference copy get the StillCraft answers.
const SPACE = [
  f(HERO, 'label', 0, 'Nobody in Kenya owns\nthe space in between.'),
  f(HERO, 'description', 0, 'When an anchor tenant exits, StillCraft steps in to run the space as a working, earning programme, curated, managed, and reported on, until it is properly relet by a permanent tenant. Not an event. A managed occupation of your space.'),
  f(HERO, 'title', 0, 'Talk to us about vacant unit'),
  f(QUOTE, 'quote', 0, 'A dark anchor drags\nthe whole property\ndown with it.'),
  f(CARDS, 'heading', 0, 'The Problem'),
  f(CARDS, 'description', 0, "Kenya's mall sector has been repeatedly hit by anchor tenant collapses, leaving large vacant units behind at malls. A dark anchor drags the whole property down with it. Foot traffic near it drops, and some smaller tenants can invoke lease clauses to reduce or exit their own rent once anchor occupancy falls below a set threshold."),
  f(CARDS, 'heading', 1, 'The Opportunity'),
  f(CARDS, 'description', 1, 'Real estate and leasing firms handle the long, formal process of landing a new permanent anchor. Event companies handle short, one off activations. Nobody is running the vacant unit itself, day to day, as a working, earning space while a permanent tenant is found.'),
  f(CARDS, 'heading', 2, 'The Service'),
  f(CARDS, 'description', 2, 'StillCraft becomes the team a mall calls the day an anchor unit goes dark, not to run one event in the space, but to manage it as a working, revenue generating programme until it is relet.'),
  f(SVC, 'heading', 0, 'How It Works'),
  f(SVC, 'description', 0, 'The unit is filled with a curated, rotating concept chosen to complement the existing tenant mix rather than compete with it, a vendor market, a themed experiential concept, or a single curated brand takeover, and StillCraft runs it continuously, not as a one off weekend. Its live performance then becomes the pitch that helps land the next permanent tenant.'),
  f(SVC, 'name', 0, 'Assessment & Curation'),
  f(SVC, 'detail', 0, 'Audit the space, its location relative to entrances and anchors, and the gap in the current tenant mix. Decide what fills it.'),
  f(SVC, 'name', 1, 'Vendor Sourcing'),
  f(SVC, 'detail', 1, 'Recruit and vet the occupants, local brands, vendors, or a curated concept, and manage the short term commercial terms with each.'),
  f(SVC, 'name', 2, 'Activation & Fit Out'),
  f(SVC, 'detail', 2, 'Lightweight, reversible fit out, signage, lighting, basic infrastructure, so the space hands back cleanly once it is relet.'),
  f(SVC, 'name', 3, 'Live Management'),
  f(SVC, 'detail', 3, 'Ongoing operation, typically one to six months, rotating vendors, keeping the space fresh, and running it day to day.'),
  f(SVC, 'name', 4, 'Handoff Or Renewal'),
  f(SVC, 'detail', 4, "The space's track record becomes the pitch for a permanent tenant, or the activation is extended if it is outperforming a traditional lease."),
  f(SVC, 'name', 5, 'Revenue Model: Hybrid'),
  f(SVC, 'detail', 5, 'A smaller retainer plus a performance bonus tied to footfall or revenue targets. Balances downside protection with upside alignment.'),
  f(SVC, 'name', 6, '75 to 80% (Placeholder)'),
  f(SVC, 'detail', 6, 'Average Nairobi mall occupancy, excluding anchor tenants.\nMonths to Years (Placeholder): typical time to land a new anchor lease.'),
  // Same pattern as the other two pages (the template's "Experts Answers").
  f(FAQ, 'title', 0, 'Mall space answers'),
  f(FAQ, 'answer', 0, p('A dark anchor drags the whole property down with it. Foot traffic near it drops, and some smaller tenants can invoke lease clauses to reduce or exit their own rent once anchor occupancy falls below a set threshold.')),
  f(FAQ, 'answer', 1, p('Real estate and leasing firms handle the long, formal process of landing a new permanent anchor. Event companies handle short, one off activations. When an anchor tenant exits, StillCraft steps in to run the space as a working, earning programme, curated, managed, and reported on, until it is properly relet by a permanent tenant.')),
  f(FAQ, 'answer', 2, p('Assessment and curation, vendor sourcing, a lightweight, reversible fit out, then live management, typically one to six months, rotating vendors, keeping the space fresh, and running it day to day, until handoff or renewal.')),
  f(FAQ, 'answer', 3, p('Hybrid: a smaller retainer plus a performance bonus tied to footfall or revenue targets. Balances downside protection with upside alignment.')),
  f(FAQ, 'questions', 4, 'Why is StillCraft the team for this?'),
  f(FAQ, 'answer', 4, p('StillCraft already has the two disciplines this requires, curating and running physical activations, and reporting outcomes back to a mall client. This is a natural extension of that, not a new business. Internationally, this gap has already become its own category: Primaris REIT committed $175 to $225 million to redevelop closed department store boxes into curated, multi tenant experiential programs, and a whole layer of pop up and space curation agencies (Storefront, Appear Here, xNomad) has grown up around exactly this work abroad.')),
  f(CTA, 'alt', 0, "Let's find out what your empty unit could be earning"),
  f(CTA, 'ctaHeading', 0, "Let's find out what\nyour empty unit\ncould be earning.", ["Let's find out what your empty unit could earn."]),
];

// Brand Activation ("Brands and Corporates", stored as /service/events).
// hero = "Strategy through delivery"; quote + cards = "What We're Brought In
// To Do" (ATL, BTL, and the opening question under the four engagement
// steps); services list = "Why Brands Bring Us In" (5) + "How An Engagement
// Runs" (two steps per item).
const BRANDS = [
  f(HERO, 'label', 0, 'Strategy through delivery.\nOne team, one brand, one bond built with your audience.'),
  f(HERO, 'description', 0, 'StillCraft is engaged as the team that plans a brand\'s next move and stays on to deliver it, from the boardroom to the ground. No handoffs between a strategist and a producer. No brief that gets reinterpreted by three different vendors along the way. One team, accountable for the relationship your brand builds with the people who matter to it.'),
  f(QUOTE, 'quote', 0, "What we're\nbrought in\nto do."),
  f(CARDS, 'heading', 0, 'Reach: Above The Line (ATL)'),
  f(CARDS, 'description', 0, 'Campaigns, sponsorships and launch moments built and placed to put your brand in front of the audience that matters, at the scale the moment deserves. Media Campaigns · Sponsorships · Large Format & OOH · Brand Launch Events.'),
  f(CARDS, 'heading', 1, 'Proximity: Below The Line (BTL)'),
  f(CARDS, 'description', 1, "Activations, roadshows and corporate environments that put your brand in your audience's hands, and shape how your own people experience it from the inside. Experiential Activations · Roadshows & Sampling · In-Person Promotions · Corporate Environments."),
  f(CARDS, 'heading', 2, 'Consult. Plan. Produce. Report.'),
  f(CARDS, 'description', 2, "Every brief we take on starts with the same question: what does your audience need to feel about this brand, and what will it take to earn that. From there, we build and run the full mix, at national reach and at arm's length, so the experience your audience has stays consistent no matter where they meet the brand."),
  f(SVC, 'heading', 0, 'The team that stays accountable from strategy to the last handshake.'),
  f(SVC, 'description', 0, "We are not a media buyer who outsources activations, or an events crew who outsources strategy. StillCraft has spent eight years planning and producing brand marketing under one roof, which means the idea that gets your audience's attention is the same idea that earns their trust once they're standing in front of you."),
  f(SVC, 'name', 0, 'Eight Years Delivering, Not Theorising'),
  f(SVC, 'detail', 0, 'Eight years running marketing and events for malls, brands and corporate teams, with the scars and the systems that come from doing it on the ground, repeatedly.'),
  f(SVC, 'name', 1, 'Your Strategist Is Your Producer'),
  f(SVC, 'detail', 1, 'The team that builds your plan is the same team that runs it, so nothing gets lost, watered down, or reinterpreted on the way to execution.'),
  f(SVC, 'name', 2, 'Built Around Your Audience, Not A Template'),
  f(SVC, 'detail', 2, 'Every engagement starts with your objective and your audience, and the plan is built to fit them, not pulled off a shelf.'),
  f(SVC, 'name', 3, 'Relationships That Compound'),
  f(SVC, 'detail', 3, 'We build programmes designed to deepen the bond between your brand and its audience over time, so trust builds engagement after engagement.'),
  f(SVC, 'name', 4, 'Every Engagement Closes With A Report'),
  f(SVC, 'detail', 4, 'You get a clear account of what the work delivered, so the next move with your audience is made on evidence.'),
  f(SVC, 'name', 5, 'Consult, Then Plan'),
  f(SVC, 'detail', 5, 'We sit down with your team to understand the audience, the objective and the timeline, before recommending ATL, BTL, or a blend of both.\nOne team maps the campaign end to end: media and placements alongside activations and environments, built around a single idea.'),
  f(SVC, 'name', 6, 'Produce, Then Report'),
  f(SVC, 'detail', 6, 'We run production and delivery ourselves, on the ground and on air, so the brand experience stays consistent from the first touch to the last.\nWe close the loop with a report on what moved, reach, engagement, sentiment, so the next programme builds on evidence, not guesswork.'),
  f(CTA, 'alt', 0, "Let's discuss your next activation"),
  f(CTA, 'ctaHeading', 0, "Let's discuss\nyour next\nactivation!", ['Lets discuss your next activation!']),
];

// Meta descriptions (search snippet / share card): the guide's own opening
// line for each page. The template's ("Planning a corporate conference?",
// "... corporate events across Europe") were still in place.
const META = {
  '/service/exhibits': 'StillCraft plans, staffs, and runs the entire calendar for you, one team, accountable for every date on it, so your team can manage the center instead of managing a calendar.',
  '/service/congresses': 'When an anchor tenant exits, StillCraft steps in to run the space as a working, earning programme, curated, managed, and reported on, until it is properly relet by a permanent tenant.',
  '/service/events': "StillCraft is engaged as the team that plans a brand's next move and stays on to deliver it, from the boardroom to the ground.",
};
const META_TAG = /(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")([^"]*)(")/g;
function setMeta(html, desc) {
  const olds = new Set();
  const parts = html.split(/(<script[\s\S]*?<\/script>)/gi);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i].replace(META_TAG, (m, a, v, c) => { olds.add(unesc(v)); return a + esc(desc).replace(/"/g, '&quot;') + c; });
  }
  html = parts.join('');
  const tok = FQ + 'content' + FQ + ':' + FQ;
  for (const o of olds) {
    if (o === desc) continue;
    // Earlier swaps may have written a bare "&" into the flight copy.
    for (const raw of new Set([encRow(o), encRow(o).split(BS + 'u0026').join('&')])) {
      html = safeReplacePushes(html, tok + raw + FQ, tok + encRow(desc) + FQ);
    }
  }
  return html;
}


// ---------- legal pages: whole body from the guide ----------
// Each legal page is one HTML block: static `<div class="legacies-template">`
// plus the same HTML as a length-framed flight text row. Both are replaced.
const li = (items) => '<ul>\n' + items.map((t) => '<li>' + t + '</li>').join('\n') + '\n</ul>';
const LEGAL = {
  '/cookie-policy': {
    h1: 'Cookie Policy',
    body: [
      '<h1>Cookie Policy</h1>',
      '<h2>How we collect, use and protect your personal information</h2>',
      '<h3>WHAT IS A COOKIE?</h3>',
      '<p>Cookies are small text files placed on your device when you visit a website. They help the Site run properly, remember your preferences, and give us a general sense of how visitors use the Site.</p>',
      '<h3>WHY DOES STILLCRAFT USE THESE COOKIES?</h3>',
      '<p>We use cookies to keep the Site secure and functional, to understand which pages and services visitors are interested in, and to support the enquiry and quote request forms on this Site.</p>',
      '<h3>TYPES OF COOKIES</h3>',
      li([
        'Strictly Necessary — lets the Site function (page navigation, security, form submission). Cannot be disabled.',
        'Analytics &amp; Performance — shows which pages get visited and how people move through the Site. Can be disabled.',
        'Functional — remembers preferences such as language or previously entered form details. Can be disabled.',
        'Marketing &amp; Social — supports embedded content from Instagram and LinkedIn, and measures campaign reach. Can be disabled.',
      ]),
      '<h3>THIRD-PARTY COOKIES</h3>',
      '<p>Some cookies are placed by third-party services StillCraft uses, rather than by StillCraft directly, including analytics providers (e.g. Google Analytics), social media platforms (e.g. Instagram, LinkedIn), and form/email service providers.</p>',
      '<h3>YOUR CHOICES: MANAGE, BLOCK OR DISABLE COOKIES</h3>',
      '<p>You can control or disable cookies at any time through your browser settings. Disabling strictly necessary cookies may affect how parts of the Site function, including form submissions.</p>',
      '<h3>UPDATES TO THE COOKIES POLICY</h3>',
      '<p>This Cookie Policy may be updated from time to time to reflect changes in the cookies used or for legal and regulatory reasons. Any changes will be posted on this page with an updated revision date.</p>',
    ].join('\n'),
  },
  '/privacy-policy': {
    h1: 'Privacy Policy',
    body: [
      '<h1>Privacy Policy</h1>',
      '<p>StillCraft Events Co. (“StillCraft”, “we”, “us”, or “our”) respects your privacy and is committed to handling personal information responsibly. This Privacy Policy explains how we collect, use, store and protect personal information when you visit stillcraftevents.co.ke, contact us, submit an enquiry, request a quotation, apply for a role, or otherwise interact with us. We process personal information in accordance with applicable Kenyan data-protection law, including the Data Protection Act, 2019 and applicable regulations.</p>',
      '<h3>INFORMATION WE COLLECT</h3>',
      li([
        'Your name and contact details',
        'Email address and telephone number',
        'Company or organisation name',
        'Information about your event, activation, campaign or project',
        'Details submitted through enquiry or quotation forms',
        'Information provided when applying for employment or working with us',
        'Communications you send to us',
        'Information about how you use our website',
        'Technical information such as browser type, device information, IP address and website activity',
        'Information collected through cookies and similar technologies',
      ]),
      '<h3>HOW WE USE YOUR INFORMATION</h3>',
      li([
        'Respond to enquiries and requests',
        'Prepare quotations, proposals and project recommendations',
        'Communicate with prospective and existing clients',
        'Plan and deliver events, activations and experiential programmes',
        'Manage business relationships',
        'Process job applications and recruitment enquiries',
        'Improve our website, services and user experience',
        'Understand website traffic and how visitors use our website',
        'Maintain website security and functionality',
        'Meet legal, regulatory or contractual obligations',
        'Protect our legitimate business interests and prevent misuse of our services',
      ]),
      '<h3>HOW WE PROCESS PERSONAL INFORMATION</h3>',
      li([
        'Respond to a request you have made',
        'Take steps at your request before entering into a contract',
        'Perform or manage a contractual relationship',
        'Comply with a legal obligation',
        'Protect legitimate business interests',
        'Obtain and rely on your consent where consent is required',
      ]),
      '<h3>WHO WE MAY SHARE INFORMATION WITH</h3>',
      li([
        'Website and hosting providers',
        'Email and communications providers',
        'Form and enquiry-management providers',
        'Analytics providers',
        'Professional advisers',
        'Technology and software providers',
        'Event and production partners where necessary to deliver a project',
        'Government, regulatory or law-enforcement authorities where required by law',
      ]),
      '<p>We do not sell your personal information.</p>',
    ].join('\n'),
  },
};
// Rewrite the flight text row whose HTML starts with the page's <h1>. The
// row can span several pushes, so the push contents are merged into the
// first push (order kept, the others emptied - the same shape flight.mjs
// uses), the row is re-encoded and its byte length recomputed.
function setLegalRow(html, h1, body) {
  const delim = 'self.__next_f.push(';
  const parts = html.split(delim);
  const segs = parts.slice(1).map(parseSeg);
  if (!segs.length || segs.some((x) => !x)) return html;
  const content = segs.map((x) => x.content).join('');
  const row = findLenRows(content).find((r) => decodeFully(content.slice(r.payloadStart, r.payloadEnd)).startsWith('<h1>' + h1 + '</h1>'));
  if (!row) return html;
  const dec = decodeFully(content.slice(row.payloadStart, row.payloadEnd));
  const tail = /\s*$/.exec(dec)[0];
  const next = body + tail;
  if (next === dec) return html;
  const merged = content.slice(0, row.hdrLenStart) + Buffer.byteLength(next, 'utf8').toString(16) + ',' + encodeJs(next) + content.slice(row.payloadEnd);
  let out = parts[0] + delim + segs[0].prefix + merged + segs[0].suffix;
  for (let k = 1; k < segs.length; k++) out += delim + segs[k].prefix + segs[k].suffix;
  return out;
}
export function applyLegalCopy(html, page) {
  const L = LEGAL[page];
  if (!L || !html) return html;
  try {
    const open = html.indexOf('<div class="legacies-template">');
    if (open >= 0) {
      const end = elementEnd(html, open);
      if (end > open) {
        const start = open + '<div class="legacies-template">'.length;
        html = html.slice(0, start) + L.body + html.slice(end - '</div>'.length);
      }
    }
    const before = verifyFlight(html);
    const cand = setLegalRow(html, L.h1, L.body);
    const after = cand !== html ? verifyFlight(cand) : null;
    if (after && after.bad <= before.bad && after.rows >= before.rows) html = cand;
  } catch { /* keep the page as rendered */ }
  return html;
}

export const GUIDE_PAGES = {
  '/service/exhibits': MALLS,
  '/service/congresses': SPACE,
  '/service/events': BRANDS,
};

export function applyGuideCopy(html, page) {
  const specs = GUIDE_PAGES[page];
  if (!specs || !html) return html;
  // Read every slot's current value first. A slot whose current text equals
  // another slot's NEW text must be rewritten before that one, or its static
  // rewrite would also catch the freshly written copy (the old quote reads
  // exactly like the new hero line on the calendar page).
  const plan = specs.map((s) => {
    const olds = [...s.also];
    try { setField(html, s, olds, true); } catch { /* slot missing */ }
    return { s, olds: olds.filter((o) => norm(o) !== norm(s.value)) };
  });
  const newVals = new Set(specs.map((s) => norm(s.value)));
  const first = plan.filter((x) => x.olds.some((o) => newVals.has(norm(o))));
  const rest = plan.filter((x) => !first.includes(x));
  for (const { s, olds } of [...first, ...rest]) {
    try {
      html = setField(html, s, []);
      html = rewriteStatic(html, olds, s.value);
    } catch { /* keep the page as rendered */ }
  }
  if (META[page]) { try { html = setMeta(html, META[page]); } catch { /* keep */ } }
  return html;
}
