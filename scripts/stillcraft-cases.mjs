// StillCraft mall case studies — updated 2025-09-15 per client-provided copy.
// Images are kept (placeholder SVGs at /assets/stillcraft/mall-case/<slug>/…svg,
// swappable via /insider). Per-campaign numbers are NOT shown per case — only
// the programme-wide overview stat (33% footfall / 21% dwell) is shown once at
// the top of the projects index. Individual facts are placeholder dashes until
// a real, campaign-specific figure is confirmed.
//
// Source doc: "StillCraft Events Co. — Case Studies" (33% / 21% overview note).

export function servicesFor() {
  return [
    'Creative Concept & Design',
    'Build, Production & Install',
    'Mall Programming',
    'Branding & Experiential',
    'Hosting & Staffing',
  ];
}

// Top-of-page programme-wide proof (show once, not per case)
export const OVERVIEW_STATS = [
  { value: '33%', label: 'average rise in footfall' },
  { value: '21%', label: 'average increase in dwell time' },
  { note: "Measured across StillCraft's recent seasonal mall programming" },
  {
    disclaimer:
      'Figures reflect programme-wide tracking, not a confirmed individually measured result for every campaign listed. Individual results are described qualitatively unless a real campaign-specific figure is confirmed — update that write-up with the real figure when available.',
  },
];

// Per-case facts are intentionally minimal/dashed — real metrics are added
// per campaign only when confirmed. This keeps the 4-up facts grid rendering
// without publishing per-case estimates as if they were measured.
// Per-case facts stay qualitative until campaign-specific numbers are
// confirmed (brief §4): no per-campaign figures, no internal notes. The only
// numbers shown are the clearly-labelled programme-wide averages.
const PH_FACTS = [
  ['On site', 'planned, staffed and run by one StillCraft team'],
  ['For the season', 'timed to the retail moment it serves'],
  ['33% / 21%', 'programme-wide footfall and dwell averages'],
  ['Reported back', 'every season closes with a report'],
];

const CASE = [
  {
    databaseId: 1200,
    slug: 'easter-at-galleria-mall',
    title: 'Easter at Galleria Mall',
    location: 'Galleria Mall, Nairobi',
    industry: 'Retail & Malls',
    eventType: 'Brand Activation',
    participants: 3200,
    feet: '3,200',
    excerpt:
      'A family-focused Easter activation built around the holiday period to give visiting families a reason to stay longer than a shopping trip.',
    hero: 'Easter falls in a school holiday window when families are actively looking for somewhere to spend a day out. Galleria Mall partnered with StillCraft to give that window a destination — not just another place to shop.',
    challenge:
      'Easter falls in a school holiday window when families are actively looking for somewhere to spend a day out, but a mall with no programming behind it is just another place to shop, not a destination worth the drive.',
    whatWeDid:
      'StillCraft planned and delivered a family focused Easter activation at Galleria Mall, built around the holiday period to give visiting families a reason to stay longer than a shopping trip usually takes.',
    result:
      'The activation brought consistent family foot traffic through the Easter weekend, with strong engagement from children and parents alike, reinforcing Galleria as a place families choose to spend a holiday, not just pass through.',
    quote: '',
    facts: PH_FACTS,
  },
  {
    databaseId: 1201,
    slug: 'mothers-day-at-galleria-mall',
    title: "Mother's Day at Galleria Mall",
    location: 'Galleria Mall, Nairobi',
    industry: 'Retail & Malls',
    eventType: 'Brand Activation',
    participants: 2700,
    feet: '2,700',
    excerpt:
      "A gifting-focused Mother's Day programme timed to peak weekend footfall — giving the day a moment worth showing up for.",
    hero: "Mother's Day is a high-intent shopping weekend. Galleria Mall worked with StillCraft to give the day a visible, on-brand moment worth showing up for — not just a shopping errand.",
    challenge:
      "Mother's Day is a high intent shopping weekend, but without a moment built around it, the day passes as ordinary retail traffic rather than a chance to actually engage shoppers who are already there to spend.",
    whatWeDid:
      "StillCraft delivered a Mother's Day activation at Galleria Mall, a gifting focused programme timed to the weekend's peak footfall, giving the day a moment worth showing up for rather than just a shopping errand.",
    result:
      "The programme gave Galleria a visible, on brand presence during one of the year's highest value retail weekends, adding an experience layer to a day shoppers were already planning to spend at the mall.",
    quote: '',
    facts: PH_FACTS,
  },
  {
    databaseId: 1202,
    slug: 'world-cup-watch-party-at-galleria-mall',
    title: 'World Cup Watch Party at Galleria',
    location: 'Galleria Mall, Nairobi',
    industry: 'Retail & Malls',
    eventType: 'Live Event Viewing',
    participants: 5100,
    feet: '5,100',
    excerpt:
      'A live communal World Cup watch party — turning a global sporting moment into sustained foot traffic on site.',
    hero: 'A major sporting event draws people out looking for somewhere to watch together. Galleria Mall and StillCraft turned that pull into a live, communal event on site — not something shoppers watched at home instead of visiting.',
    challenge:
      'A major sporting event draws people out of their homes looking for somewhere to watch together, and a mall that captures that moment turns a one off night into real, sustained foot traffic, if it gets the format right.',
    whatWeDid:
      'StillCraft planned and ran a World Cup watch party at Galleria Mall, turning a global sporting moment into a live, communal event on site rather than something shoppers watched at home instead of visiting the mall.',
    result:
      "The watch party drew a strong crowd for the duration of the match, giving Galleria a genuine social and entertainment moment that went beyond its usual retail programming, and demonstrated the mall's range beyond seasonal retail calendar events.",
    quote: '',
    facts: PH_FACTS,
  },
  {
    databaseId: 1203,
    slug: 'christmas-at-westgate-mall',
    title: 'Christmas Campaign at Westgate',
    location: 'Westgate Mall, Nairobi',
    industry: 'Retail & Malls',
    eventType: 'Brand Activation',
    participants: 4300,
    feet: '4,300',
    excerpt:
      "A full seasonal Christmas programme built to give Westgate a genuine festive identity — not just standard decor.",
    hero: "Christmas is the single highest-stakes retail season. Westgate Mall's programming had to be the reason families chose to spend the holidays there — StillCraft built that identity.",
    challenge:
      "Christmas is the single highest stakes retail season of the year, the kind of period where a mall's programming either becomes the reason families choose to spend their holiday shopping there, or gets lost in a season where every retail destination is competing for the same limited attention.",
    whatWeDid:
      "StillCraft planned and delivered Westgate Mall's Christmas campaign, a full seasonal programme built to give the mall a genuine festive identity through the holiday period rather than standard seasonal decor alone.",
    result:
      'The campaign gave Westgate a distinct festive presence through its highest traffic season of the year, positioning the mall as a destination for the holiday period rather than one retail option among several.',
    quote: '',
    facts: PH_FACTS,
  },
  {
    databaseId: 1204,
    slug: 'valentines-at-sarit-centre',
    title: "Valentine's Day at Sarit Centre",
    location: 'Sarit Centre, Nairobi',
    industry: 'Retail & Malls',
    eventType: 'Brand Activation',
    participants: 3100,
    feet: '3,100',
    excerpt:
      "A romance-led Valentine's programme timed to the day's concentrated shopping window — giving visitors a reason to associate the day with Sarit itself.",
    hero: "Valentine's Day is one of the shortest, highest-intent windows — couples and gift shoppers moving with purpose. Sarit Centre and StillCraft gave the day a moment that stuck beyond the stores inside.",
    challenge:
      "Valentine's Day is one of the shortest, highest intent shopping windows of the year, couples and gift shoppers moving with a specific purpose, but a mall with no moment built around the day is easy to shop and just as easy to forget.",
    whatWeDid:
      "StillCraft delivered a Valentine's Day activation at Sarit Centre, a romance led programme timed to the day's concentrated shopping window, giving visitors a reason to associate the day with the mall itself, not just the stores inside it.",
    result:
      "The activation gave Sarit Centre a distinct presence during one of the year's shortest, most competitive retail windows, adding an experience layer to a day that otherwise passes quickly.",
    quote: '',
    facts: PH_FACTS,
  },
  {
    databaseId: 1205,
    slug: 'easter-at-sarit-centre',
    title: 'Easter at Sarit Centre',
    location: 'Sarit Centre, Nairobi',
    industry: 'Retail & Malls',
    eventType: 'Brand Activation',
    participants: 2900,
    feet: '2,900',
    excerpt:
      'A family-focused Easter activation built around the holiday window to give families a genuine reason to spend the day at Sarit.',
    hero: 'Easter families want a full day out, not just an errand. Sarit Centre and StillCraft built the holiday around that — a reason to spend the day at the mall.',
    challenge:
      "Easter's school holiday timing means families are actively looking for a full day out, not just an errand, and a mall's ability to capture that day depends entirely on having something worth the visit beyond retail alone.",
    whatWeDid:
      'StillCraft planned and delivered a family focused Easter activation at Sarit Centre, built around the holiday window to give visiting families a genuine reason to spend their day at the mall.',
    result:
      'The activation drew strong family engagement through the Easter period, reinforcing Sarit Centre as a holiday destination for families rather than a retail stop alone.',
    quote: '',
    facts: PH_FACTS,
  },
  {
    databaseId: 1206,
    slug: 'valentines-at-southfield-mall',
    title: "Valentine's Day at Southfield",
    location: 'Southfield Mall, Nairobi',
    industry: 'Retail & Malls',
    eventType: 'Brand Activation',
    participants: 3500,
    feet: '3,500',
    excerpt:
      "A romance-led Valentine's programme timed to the concentrated shopping window — distinct presence in a short, competitive window.",
    hero: "Valentine's Day is short and fiercely competitive. Southfield Mall and StillCraft gave it a distinct, romance-led presence that outlasted the shopping trip.",
    challenge:
      "Valentine's Day is one of the shortest, highest intent shopping windows of the year, and a mall with no moment built around it is easy to shop and just as easy to forget.",
    whatWeDid:
      "StillCraft delivered a Valentine's Day activation at Southfield Mall, a romance led programme timed to the day's concentrated shopping window.",
    result:
      'The activation gave Southfield a distinct presence during a short, highly competitive retail window, adding an experience layer to a day that otherwise passes quickly.',
    quote: '',
    facts: PH_FACTS,
  },
  {
    databaseId: 1207,
    slug: 'easter-at-southfield-mall',
    title: 'Easter at Southfield Mall',
    location: 'Southfield Mall, Nairobi',
    industry: 'Retail & Malls',
    eventType: 'Brand Activation',
    participants: 4100,
    feet: '4,100',
    excerpt:
      'A family-focused Easter activation built around the holiday window — something beyond retail alone.',
    hero: 'Easter is a full-day-out brief. Southfield Mall and StillCraft built the holiday around that — family programming beyond retail.',
    challenge:
      "Easter's school holiday timing means families are actively looking for a full day out, and a mall's ability to capture that day depends on offering something beyond retail alone.",
    whatWeDid:
      'StillCraft planned and delivered a family focused Easter activation at Southfield Mall, built around the holiday window.',
    result:
      'The activation drew strong family engagement through the Easter period, reinforcing Southfield as a holiday destination for families.',
    quote: '',
    facts: PH_FACTS,
  },
  {
    databaseId: 1208,
    slug: 'mothers-day-at-southfield-mall',
    title: "Mothers Day at Southfield",
    location: 'Southfield Mall, Nairobi',
    industry: 'Retail & Malls',
    eventType: 'Brand Activation',
    participants: 3000,
    feet: '3,000',
    excerpt:
      "A gifting-focused Mother's Day programme timed to peak weekend footfall — visible presence on a high-value weekend.",
    hero: "Mother's Day is high-intent. Southfield Mall and StillCraft gave it a visible, gifting-focused presence at peak footfall — not just ordinary traffic.",
    challenge:
      "Mother's Day is a high intent shopping weekend, but without a moment built around it, the day passes as ordinary retail traffic.",
    whatWeDid:
      "StillCraft delivered a Mother's Day activation at Southfield Mall, a gifting focused programme timed to peak weekend footfall.",
    result:
      "The programme gave Southfield a visible presence during one of the year's highest value retail weekends.",
    quote: '',
    facts: PH_FACTS,
  },
  {
    databaseId: 1209,
    slug: 'fathers-day-at-southfield-mall',
    title: "Father's Day at Southfield",
    location: 'Southfield Mall, Nairobi',
    industry: 'Retail & Malls',
    eventType: 'Brand Activation',
    participants: 2600,
    feet: '2,600',
    excerpt:
      "A shorter, sharper Father's Day programme — consistent seasonal coverage across both family gifting days.",
    hero: "Father's Day is often under-programmed next to Mother's Day. Southfield Mall kept coverage consistent across both — StillCraft delivered the sharper counterpart.",
    challenge:
      "Father's Day is a smaller but real gifting moment, often under programmed compared to its Mother's Day counterpart earlier in the year.",
    whatWeDid:
      "StillCraft delivered a Father's Day activation at Southfield Mall, a shorter, sharper programme built as a counterpart to the mall's Mother's Day activation.",
    result:
      "The activation gave Southfield consistent seasonal coverage across both major family gifting days in the calendar, not just one.",
    quote: '',
    facts: PH_FACTS,
  },
  {
    databaseId: 1210,
    slug: 'christmas-at-southfield-mall',
    title: 'Christmas at Southfield Mall',
    location: 'Southfield Mall, Nairobi',
    industry: 'Retail & Malls',
    eventType: 'Brand Activation',
    participants: 5600,
    feet: '5,600',
    excerpt:
      'The anchor Christmas campaign capping a year in which StillCraft ran five seasonal moments for Southfield in a row.',
    hero: 'Christmas is where a seasonal identity lands or gets lost. Southfield Mall capped a full year of StillCraft programming — five moments in a row — with its anchor festive campaign.',
    challenge:
      'Christmas is the single highest stakes retail season of the year, and the moment a mall\'s identity for the season either lands or gets lost among competing destinations.',
    whatWeDid:
      "StillCraft planned and delivered Southfield Mall's Christmas campaign, the anchor season of a full year of programming already run for the mall.",
    result:
      'The campaign gave Southfield a distinct festive identity through its highest traffic season, capping a year in which StillCraft ran five seasonal moments for the mall in a row.',
    quote: '',
    facts: PH_FACTS,
  },
];

export function caseBySlug(slug) {
  return CASE.find((c) => c.slug === slug);
}

export function allCases() {
  return CASE.map((c) => ({ ...c }));
}

export default CASE;
