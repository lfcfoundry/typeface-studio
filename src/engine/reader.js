// Description composer (round 6): reads negations, degrees, "but" clauses, comparatives and "like X but Y" references,
// turns them into explicit axis decisions with reasons, and hands the leftover words to the word rules and mood layer.
// Plain ES module, no Node imports. read() below turns a brief into pen settings with reasons.
const AX = [ // [pattern, axis, sign, consume?] ; sign for boolean axes: true/false. consume = remove the phrase so later rules don't reread it
  // round 8: openness (aperture), squareness of bowls, and stress angle of the pen
  [/\bopen (letter ?forms?|letters|shapes|apertures?|counters|forms)\b|\b(wide|large|big|generous) apertures?\b|\bopen\b(?!\s*(spacing|letter[- ]?spacing))/, 'aperture', +1, true],
  [/\bclosed (letter ?forms?|letters|shapes|apertures?|counters|forms)\b|\b(tight|narrow|small) apertures?\b|\bclosed\b/, 'aperture', -1, true],
  [/\b(squarish|squareish|boxy|squared[- ]off|techno|rectangular|squircle|squircular|square bowls?|square curves?)\b/, 'square', +1, true],
  [/\b(circular|oval|round bowls?|perfectly round|true circles?)\b/, 'square', -1, true],
  [/\bcalligraph(ic|y)\b|\b(tilted|slanted|angled|diagonal|oblique|inclined) (axis|stress)\b|\bbroad[- ]?nib\b|\bpen[- ]?(like|drawn|written)\b/, 'stress', +1, true],
  [/\b(vertical|upright|straight|rational) (axis|stress)\b/, 'stress', -1, true],
  [/\bround (letters|shapes|bowls|forms|parts|letterforms)\b/, null, 0, true], // a noun phrase ("make the round letters square"), not a style word
  [/\b(hairline|delicate|fine|thin(ner)?) (\w+ )?(serifs?|hairlines?)\b|\bthin(ner)? (horizontal|vertical|cross) ?(strokes?|bars?|lines?)?\b|\bthin horizontals\b/, 'contrast', +1, true],
  [/\b(high|higher|strong|more|lots of|big) (stroke )?contrast\b|\bthick and thin\b|\bthicks? and thins?\b/, 'contrast', +1, true],
  [/\b(low|lower|less|little|no|minimal) (stroke )?contrast\b|\bmonoline\b|\beven strokes?\b|\buniform strokes?\b/, 'contrast', -1, true],
  [/\b(big|large|tall|high|bigger|larger|taller) x-?heights?\b/, 'xh', +1, true],
  [/\b(small|short|low|smaller|shorter) x-?heights?\b/, 'xh', -1, true],
  // round 10: "wider spacing" and "more space between letters" are spacing, not width
  [/\b(open|wide|wider|loose|looser|generous|more|extra|bigger|larger|roomier) (letter[- ]?)?spacing\b|\bspaced out\b|\bmore (space|room) between (the )?letters\b/, 'spacing', +1, true],
  [/\b(tight|tighter|narrow|narrower|less|smaller|closer) (letter[- ]?)?spacing\b|\bless (space|room) between (the )?letters\b/, 'spacing', -1, true],
  [/\bgeometric\b/, 'serif', false],
  [/\b(bold|bolder|boldest|heavy|heavier|thick|thicker|fat|fatter|chunky|chunkier|black|strong|stronger|beefy)\b/, 'weight', +1],
  [/\b(light|lighter|thin|thinner|delicate|hairline|fine|finer|skinny|slim|slimmer)\b/, 'weight', -1],
  [/\b(wide|wider|widest|extended|expanded|broad|broader)\b/, 'width', +1],
  [/\b(narrow|narrower|condensed|compressed|squeezed|skinny)\b/, 'width', -1],
  [/\b(loose|looser|airy|spacious|roomy|open spacing|wide spacing|spaced out|generous spacing|(loosely|widely|generously|openly) (spaced|set))\b/, 'spacing', +1],
  [/\b(tight|tighter|packed|compact|dense|crammed|tight spacing|(tightly|closely|densely) (spaced|set|packed))\b/, 'spacing', -1],
  [/\bsans?[- ]?serifs?\b|\bsans\b|\bno serifs?\b|\bwithout (the )?serifs?\b|\bserifless\b/, 'serif', false, true],
  [/\bslab(s|[- ]serifs?)?\b|\bserifs?\b|\bserifed\b/, 'serif', true],
  [/\b(round|rounded|rounder|roundish|soft|softer|curvy|bubbly)\b/, 'rounded', true],
  [/\b(sharp|sharper|angular|pointy|pointed|square|squared|crisp|edgy|geometric)\b/, 'rounded', false],
  [/\b(mono|monospace|monospaced|fixed[- ]width|typewriter|code|coding|programming|terminal)\b/, 'mono', true],
  [/\b(proportional)\b/, 'mono', false],
  // round 9: slant
  [/\b(italic|italics|slanted|slant|leaning|oblique|tilted|sloped|forward[- ]leaning|dynamic lean)\b/, 'italic', true],
  [/\b(upright|roman|vertical letters|straight up)\b/, 'italic', false],
];

// Round 9: theme recipes. A theme picks a whole style (and slant or letter shape) the way a designer would; explicit words
// in the same description still win. Each entry: pattern, axis settings, extra pen settings, short name for the why list.
const THEMES = [
  // round 23: owner's own words (1980s audiences, dyslexia, undersized screens, bubble letters); design judgments, not measured
  [/\b(undersized|too small|far (from|away)|back of the (room|hall)|conference room|projector|large room|big room)\b/, { weight: +1, spacing: +1, serif: false }, {}, 'seen from far away'],
  [/\bdyslexi[ac]s?\b|\bdyslexic users?\b/, { spacing: +1, width: +1, serif: false, weight: +0.5 }, { style: 'sans' }, 'easier reading for dyslexia (open spacing, clear sans)'],
  [/\bbubble (letters?|font|type|writing)\b|\bballoon letters?\b|\bpuffy\b/, { weight: +1, rounded: true, width: +1 }, { soft: true }, 'bubble letters'],
  [/(?=.*\b(1980s|eighties|80s|1980's)\b).*\b(children|kids?)\b/, { rounded: true, weight: +1, serif: false }, { soft: true }, '1980s children'],
  [/(?=.*\b(1980s|eighties|80s|1980's)\b).*\b(business(es)?|corporate|office)\b/, { serif: false, contrast: -1, spacing: 0 }, {}, '1980s business'],
  [/(?=.*\b(1980s|eighties|80s|1980's)\b).*\b(teen(s|agers?)?|youth)\b/, { weight: +1, width: +1, serif: false }, { slant: 10 }, '1980s teens'],
  [/(?=.*\b(1980s|eighties|80s|1980's)\b).*\b(movie|film|cinema)( posters?)?\b/, { weight: +1, width: -1, contrast: +1 }, {}, '1980s movie posters'],
  [/(?=.*\b(1980s|eighties|80s|1980's)\b).*\b(seniors?|senior citizens?|elderly|older (adults|people))\b/, { spacing: +1, width: +1, weight: +0.5, serif: false }, {}, '1980s seniors'],
  [/\btypewriter\b/, { mono: true }, { style: 'slab' }, 'typewriter'], // serif or not is left to the other words (the prototype's gold calls a plain typewriter face sans)
  [/\b(pirates?|treasure maps?|old maps?|antique maps?)\b/, { serif: true, contrast: +1, stress: +1 }, { style: 'serif' }, 'pirate map'],
  [/\b(sports?|sporty|athletic|athletics|fitness|gym|basketball|football|soccer|baseball|hockey|rugby|tennis|marathon)\b( brand| logo| team| wear| apparel)?/, { weight: +1, serif: false }, { slant: 10 }, 'sports'],
  [/\b(racing|motorsports?|race cars?|rally|livery|speed shop)\b/, { weight: +1, width: +1, serif: false }, { slant: 14 }, 'racing'],
  [/\bnewspaper (headlines?|masthead|banner)\b|\bheadline type\b|\btabloid\b/, { width: -1, weight: +1 }, {}, 'newspaper headline'],
  [/\b(sci[- ]?fi|futuristic|space ?age|spaceship|robots?|outer space)\b/, { serif: false, width: +1, rounded: false, square: +1 }, {}, 'sci-fi'],
  [/\b(cyberpunk|techno|neon city|hacker)\b/, { serif: false, square: +1, rounded: false }, {}, 'cyberpunk'],
  [/\b(wild west|western|wanted poster|saloon|rodeo|cowboys?)\b/, { serif: true, weight: +1 }, { style: 'slab' }, 'western'],
  [/\b(varsity|college jersey|jersey letters|letterman)\b/, { serif: true, weight: +1 }, { style: 'slab' }, 'varsity'],
  [/\bart deco\b|\b1920s\b|\broaring twenties\b|\bgatsby\b/, { serif: false, contrast: +1 }, {}, 'art deco'],
  [/\b(groovy|disco|1970s|70s|seventies|hippie)\b/, { rounded: true, weight: +1 }, {}, '1970s'],
  [/\b(handwritten|hand[- ]?written|handwriting|script|cursive|signature)\b/, { stress: +1 }, { slant: 12, italic: true }, 'handwritten'],
  [/\b(comic books?|comics|cartoons?|superheroe?s?|sound effects?)\b/, { weight: +1, rounded: true }, { slant: 8 }, 'comic book'],
  [/\b(military|army|stencil|navy|surplus|tactical)\b/, { weight: +1, rounded: false, square: +1, serif: false }, {}, 'military'],
  [/\b(arcade|8[- ]?bit|video games?|retro games?|pixel)\b/, { mono: true, square: +1, rounded: false }, {}, 'arcade'],
  [/\b(road signs?|highway|signage|wayfinding|airport signs?)\b/, { serif: false, aperture: +1 }, {}, 'road signs'],
  [/\b(medieval|fantasy|renaissance|knights?|castles?|wizards?)\b/, { serif: true, stress: +1, contrast: +1 }, { style: 'serif' }, 'medieval'],
  [/\b(wedding|invitations?)\b/, { contrast: +1, serif: true }, { slant: 10, italic: true }, 'invitation'],
  [/\b(novels?|books? (text|body)|literary|book interior)\b/, { serif: true }, { style: 'serif' }, 'book'],
  // round 10: friendly moods round the stroke ends and lower the contrast a little
  // round 21b: small screens and display uses (weights and spacing are real-font habits: small text wants more weight and room; display wants weight)
  [/\b(small (phone|screen|screens|text|size|sizes)|tiny (text|labels?|print|type)|smartwatch|smart watch|watch face|medicine bottles?|fine print|captions?|subtitles?|labels? on)\b/, { weight: +1, spacing: +1 }, {}, 'small screen or small text'],
  [/\b(smartwatch|smart watch|watch face|dashboards?|spreadsheets?|tables? of numbers|lots of numbers|data tables?|stock tickers?|license plates?)\b/, { width: -1 }, { style: 'sans' }, 'numbers and tight spaces'],
  [/\b(billboards?|banners?|marquee|big display|display type|hero text|storefront|shop sign|signboard)\b/, { weight: +1 }, {}, 'display use'],
  [/\b(friendly|friendlier|cute|gentle|kids?|kiddy|children'?s?|childlike|playful|cuddly|toddlers?|nursery|baby|babies|preschool|kindergarten|toys?|teddy|huggable|cheerful|bubbly)\b/, { rounded: true }, { soft: true }, 'friendly'],
];
const STRONG = /\b(very|extremely|super|really|extra|ultra|so|much|way|incredibly)\b/, MILD = /\b(slightly|a bit|a little|a touch|somewhat|kind of|kinda|bit|little|mildly|a tad)\b/;
// well-known fonts that are not on Google Fonts -> metric-compatible or closest Google Fonts family
const ALIAS = { helvetica: 'arimo', arial: 'arimo', 'times new roman': 'tinos', times: 'tinos', courier: 'cousine', 'courier new': 'cousine', futura: 'jost', garamond: 'ebgaramond',
  'comic sans': 'comicneue', georgia: 'gelasio', calibri: 'carlito', cambria: 'caladea', impact: 'anton', baskerville: 'librebaskerville', bodoni: 'bodonimoda', gotham: 'montserrat',
  'gill sans': 'lato', avenir: 'nunitosans', 'proxima nova': 'montserrat', frutiger: 'hind', verdana: 'dejavusans', rockwell: 'robotoslab', clarendon: 'arvo', didot: 'playfairdisplay', 'franklin gothic': 'librefranklin', 'sf pro': 'inter', 'san francisco': 'inter', segoe: 'opensans' };
const NEG = /\b(not|no|without|nothing|never|non|isn'?t|aren'?t|don'?t|avoid|anything but)\b/;
export function compose(brief, { families = {}, axesOf = null } = {}) {
  let s = ' ' + String(brief).toLowerCase().replace(/[’']/g, "'") + ' '; const why = [], set = {}, strength = {}; let ref = null;
  // 1. "like X" reference to a font family
  const m = s.match(/\b(?:like|similar to|in the style of|based on|inspired by|than|compared to|compared with|(?:a |an )?(?:modern |new |fresh |updated )?(?:take|twist|spin|version|update|redesign) (?:on|of)|alternative to|replacement for)\s+(?:an?\s+|the\s+)?([a-z0-9 ]+?)(?=\s*(?:,|\bbut\b|\bwith\b|\bwithout\b|\bonly\b|\bjust\b|\band\b|\.|$))/);
  if (m) { const name = m[1].trim().replace(/\s+(font|typeface)$/, ''); const key = ALIAS[name] || name.replace(/\s+/g, ''); if (families[key]) { ref = { name, family: key, z: families[key] }; s = s.replace(m[0], ' '); why.push({ axis: 'reference', value: key, because: `"${m[0].trim()}"` }); } }
  // 2. clauses: later clauses win; "but / though / yet / however / while" start a new clause
  const clauses = s.split(/,|;|\.|\bbut\b|\bthough\b|\byet\b|\bhowever\b|\bwhile\b|\bwhereas\b/);
  const consumed = [];
  clauses.forEach((c, ci) => {
    // neither X nor Y -> both directions cancel: the axis stays regular
    const nn = c.match(/\bneither\s+(\w+)\s+nor\s+(\w+)/); if (nn) { for (const [re, axis] of AX) if (re.test(nn[1]) || re.test(nn[2])) { set[axis] = 0; why.push({ axis, value: 0, because: `"${nn[0].trim()}"` }); } consumed.push(nn[0]); c = c.replace(nn[0], ' '); }
    // split the clause into negated and plain parts: negation runs from the negator to the end of the clause, "too" softens it to a cap
    const parts = []; const nm = c.match(NEG); if (nm) { parts.push([c.slice(0, nm.index), false]); parts.push([c.slice(nm.index), true]); } else parts.push([c, false]);
    for (const [txt, neg] of parts) { const cap = neg && /\b(too|overly|that|very|so|black|ultra|extra|super)\b/.test(txt); // "not too heavy", "not black": a limit, not the opposite
      // "less X" flips X; "more X" keeps it
      const words = txt.split(/\b(?=less\b|more\b)/);
      for (const w of words) { const flip = /^less\b/.test(w) !== neg; const deg = STRONG.test(w) ? 1.6 : MILD.test(w) ? 0.5 : 1;
        let ww = w; for (const [re, axis, sign, eat] of AX) { const hit = ww.match(re); if (!hit) continue; if (eat) ww = ww.replace(hit[0], axis !== 'serif' && /serif/.test(hit[0]) ? ' serif ' : ' '); if (axis === null) { consumed.push(hit[0]); continue; }
          // a clause that asks for both directions of one axis is a deliberate contrast or a conflict: leave it to the word rules
          const both = AX.some(([r2, a2, s2]) => a2 === axis && s2 !== sign && r2.test(ww)); if (both && !neg) { why.push({ axis, value: 'conflict', because: `"${w.trim()}"` }); set['_x' + axis] = ci; continue; }
          // the serif rule: "no serifs" / "sans serif" already mean false, so a negator only flips plain "serif"
          let v = sign; const selfNeg = (axis === 'serif' && sign === false) || /^(less|low|lower|no|minimal|more|high|higher) /.test(hit[0]); /* the phrase already carries its own direction */ const f = flip && !selfNeg && !(axis === 'serif' && /\bwith\b/.test(w) && !neg);
          if (cap && !selfNeg) { if (set[axis] === undefined || set[axis] === sign) { why.push({ axis, value: 'limit', because: `"${w.trim()}"` }); strength[axis] = Math.min(strength[axis] ?? 1, 0.5); } consumed.push(hit[0]); continue; }
          if (typeof v === 'boolean') v = f ? !v : v; else v = f ? -v : v;
          // within one clause the first match per axis wins; later clauses override earlier ones
          if (set['_c' + axis] === ci) { consumed.push(hit[0]); continue; }
          set[axis] = v; set['_c' + axis] = ci; strength[axis] = typeof v === 'number' ? deg : 1; consumed.push(hit[0]);
          why.push({ axis, value: v, because: `"${w.trim()}"` + (ci ? ' (later wins)' : '') }); } }
      if (neg) consumed.push(txt); }
  });
  for (const k of Object.keys(set)) if (k.startsWith('_x') && set['_c' + k.slice(2)] === set[k]) delete set[k.slice(2)];
  // themes fill only what the words left open (explicit words win), and add pen extras (style, slant, italic shapes)
  const extra = {}; const low = ' ' + String(brief).toLowerCase() + ' ';
  for (const [re, axesT, ex, name] of THEMES) { if (!re.test(low)) continue; const hit = low.match(re)[0].trim(); const pre = low.slice(Math.max(0, low.indexOf(hit) - 24), low.indexOf(hit)), tdeg = STRONG.test(pre) ? 1.6 : MILD.test(pre) ? 0.5 : 1;
    if (consumed.some(c => NEG.test(c) && c.includes(hit))) continue; /* round 10: "not playful", "not a sports brand" don't trigger the theme */
    for (const [a, v] of Object.entries(axesT)) if (set[a] === undefined && !('_c' + a in set)) { const fr = typeof v === 'number' && Math.abs(v) < 1 && v !== 0; /* round 23: a fractional theme value means a smaller step */ set[a] = fr ? Math.sign(v) : v; strength[a] = typeof v === 'number' ? tdeg * (fr ? Math.abs(v) : 1) : 1; why.push({ axis: a, value: v, because: `theme "${name}" ("${hit}")` }); }
    for (const [a, v] of Object.entries(ex)) if (extra[a] === undefined) { if (a === 'slant' && set.italic === false) continue; if (a === 'style' && set.serif === false) continue; extra[a] = a === 'slant' ? Math.round(v * tdeg) : v; why.push({ axis: a, value: v, because: `theme "${name}" ("${hit}")` }); }
    /* theme words stay in the text, so the word rules and mood layer still hear them */ }
  for (const k of Object.keys(set)) if (k.startsWith('_c') || k.startsWith('_x')) delete set[k];
  // leftover text for the word rules and mood layer: drop everything the composer read, including negated phrases
  let rest = ' ' + String(brief).toLowerCase() + ' '; if (ref) rest = rest.replace(m[0].trim(), ' ');
  for (const c of consumed.sort((a, b) => b.length - a.length)) if (c.trim()) rest = rest.split(c.trim()).join(' ');
  rest = rest.replace(/\b(but|though|yet|not|no|without|less|more|very|slightly|a bit|a little|neither|nor|too)\b/g, ' ').replace(/\s+/g, ' ').trim();
  return { set, strength, ref, why, rest, extra };
}

// ---- settings for the pen engine (app-ready/index.js design()) ----
import { METRICS, FAMILIES } from './families.js';
const FAM = Object.fromEntries(Object.entries(FAMILIES).map(([k, z]) => [k, Object.fromEntries(METRICS.map((m, j) => [m, z[j]]))]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/**
 * read(brief, { base, rest }) -> { settings, why, rest, ref }
 * base: starting pen settings (e.g. RECOMMENDED). rest: optional callback that maps the leftover text to extra settings
 * (plug the app's word rules + mood layer in here); the composer's explicit choices always win over it.
 */
// round 10: follow-up tweaks ("a little less round", "twice as bold", "same as before but tighter") change the font the person
// just made. The app passes its current settings as `current`; read() uses them as the starting point when the words sound
// like a follow-up, and says so with refine: true.
const FOLLOW = /^\s*(a (little|bit|touch|tad|lot)|slightly|much|way|even|more|less|make (it|them|the letters)|now|again|same|twice|half|double|triple|just|still|also|and|but|too|bit|keep)\b|\b(than before|as before|same as before|than that|than this|than now|than it is|this time|instead|the same but)\b|^\s*\w+er\b(?!\s+\w+\s+\w+\s+\w+)/;
export const isFollowUp = brief => FOLLOW.test(String(brief).toLowerCase());
// "twice as bold", "half as wide", "three times the spacing": a measured factor instead of one step
const MULT = /\b(twice|two times|2x|double|half|three times|3x|triple|one and a half times|1\.5x)\s+(as\s+|the\s+)?(\w+)/;
const MULT_F = { twice: 2, 'two times': 2, '2x': 2, double: 2, half: 0.5, 'three times': 3, '3x': 3, triple: 3, 'one and a half times': 1.5, '1.5x': 1.5 };
export function read(brief, { base = {}, rest = null, current = null } = {}) {
  const refine = !!current && isFollowUp(brief);
  const c = compose(brief, { families: FAM }); const s = { stem: 90, width: 1, contrast: 0.05, xHeight: 520, spacing: 1, caps: 'butt', slab: false, mono: false, ...base, ...(refine ? current : {}) };
  if (c.ref) { const z = c.ref.z; // start from the referenced family's measured shape
    s.stem = Math.round(clamp(90 * (1 + 0.45 * z.stem), 40, 170)); s.width = +clamp(1 + 0.16 * z.nadv, 0.76, 1.3).toFixed(3); s.contrast = +clamp(0.05 + 0.25 * z.contrast, 0, 0.7).toFixed(3);
    s.xHeight = Math.round(clamp(520 + 40 * z.xr, 450, 590)); s.spacing = +clamp(1 + 0.12 * z.sb, 0.82, 1.22).toFixed(3); s.slab = z.foot > 0.45; s.serifModels = s.slab; s.mono = z.mono > 1.2; if (z.topw < -0.3 && z.foot < 0.2) s.caps = 'round'; }
  if (rest && c.rest && !refine) Object.assign(s, rest(c.rest) || {}); // a follow-up keeps the current font; mood guesses don't move it
  // in a follow-up, a plain step ("bolder") is a smaller nudge, 0.6 of a full real-font step (bold 1.68x becomes 1.36x)
  const k = a => (c.strength[a] ?? 1) * (refine ? 0.6 : 1), d = c.set, s0 = { ...s };
  // round 9: explicit words move as far as real fonts do (Google Fonts variable fonts: bold 700 = 1.68x the regular stem,
  // light 300 = 0.755x, condensed 75 = 0.818x the width, expanded 125 = 1.247x); "very" and "slightly" scale the step.
  if (d.weight !== undefined) s.stem = Math.round(clamp(d.weight === 0 ? 90 : s.stem * (d.weight > 0 ? 1.68 : 0.755) ** k('weight'), 36, 210));
  else if (c.strength.weight < 1 && s.stem > 130) s.stem = 130; // "not too heavy"
  if (d.width !== undefined) s.width = +clamp(d.width === 0 ? (base.width ?? 1) : s.width * (d.width > 0 ? 1.247 : 0.818) ** k('width'), 0.62, 1.6).toFixed(3);
  if (d.contrast === undefined && c.extra && c.extra.soft) s.contrast = +(s.contrast * 0.5).toFixed(3); // a friendly mood lowers contrast a little (words about contrast win)
  if (d.contrast !== undefined) {
    if (refine) s.contrast = +clamp(d.contrast > 0 ? s.contrast + 0.15 * k('contrast') : s.contrast * 0.5 ** k('contrast'), 0, 0.8).toFixed(3); // relative to the current font
    else s.contrast = d.contrast > 0 ? Math.max(s.contrast, 0.35 + 0.15 * (k('contrast') - 1)) : 0; }
  if (d.xh !== undefined) s.xHeight = Math.round(clamp(s.xHeight + 45 * d.xh * k('xh'), 450, 600));
  if (d.spacing !== undefined) s.spacing = +clamp(s.spacing * (1 + 0.12 * d.spacing * k('spacing')), 0.8, 1.3).toFixed(3);
  if (d.serif !== undefined) { s.slab = d.serif; s.serifModels = d.serif; }
  // two serif styles (owner's card 2026.11.06): the word "slab" picks blocky slab feet, any other serif request gets curved serifs
  if (d.rounded !== undefined) {
    // in a follow-up, "a little less round" keeps round ends and squares the bowls a little; "rounder" on a round font softens squareness
    if (refine && MILD.test(String(brief).toLowerCase()) && s.caps === 'round' && !d.rounded) s.square = +clamp((s.square ?? 2) + 0.8, 2, 6).toFixed(2);
    else if (refine && d.rounded && s.caps === 'round') s.square = +clamp((s.square ?? 2) - 0.8, 2, 6).toFixed(2);
    else s.caps = d.rounded ? 'round' : 'butt'; }
  if (d.mono !== undefined) s.mono = d.mono;
  // measured factors: "twice as bold" doubles the stem, "half as wide" halves the width (against the starting point)
  const mm = String(brief).toLowerCase().match(MULT);
  if (mm) { const f = MULT_F[mm[1]], ax = (AX.find(([re, a]) => a && re.test(mm[3])) || [])[1], sg = (AX.find(([re, a]) => a && re.test(mm[3])) || [])[2], g = sg < 0 ? 1 / f : f;
    if (ax === 'weight') s.stem = Math.round(clamp(s0.stem * g, 36, 210)); else if (ax === 'width') s.width = +clamp(s0.width * g, 0.62, 1.6).toFixed(3);
    else if (ax === 'spacing') s.spacing = +clamp(s0.spacing * g, 0.5, 2).toFixed(3);
    if (ax) c.why.push({ axis: ax, value: +g.toFixed(3), because: `"${mm[0]}" (x${+g.toFixed(3)})` }); }
  // round 9: themes (pirate map, sports brand, typewriter...) add a style, a slant or italic letter shapes, unless words said otherwise
  const ex = c.extra || {};
  if (d.italic === true) { s.slant = Math.round(clamp(12 * k('italic'), 6, 18)); s.italic = true; } else if (d.italic === false) { s.slant = 0; s.italic = false; }
  else if (ex.slant) { s.slant = ex.slant; s.italic = !!ex.italic; }
  // a theme that names a serif style (typewriter, western, varsity -> slab; pirate map, medieval, book -> serif) also turns serifs on,
  // unless the words said no serifs
  if (ex.style && d.serif === undefined) { s.slab = true; s.serifModels = true; }
  if (ex.style && s.slab && d.serif === undefined) { s.serif2 = ex.style !== 'slab'; s.slab2 = ex.style === 'slab'; if (s.serif2) s.serifLen = 0.8; }
  if (s.slab) { const slabWords = /\bslab/.test(String(brief).toLowerCase()) || ex.style === 'slab'; s.serif2 = !slabWords; s.slab2 = slabWords; if (s.serif2) s.serifLen = 0.8; s.style = slabWords ? 'slab' : 'serif'; } else s.style = 'sans';
  // round 8: openness, squareness and stress (pen keys aperture, square, nib in radians; nibDegrees for the app's slider)
  if (d.aperture !== undefined) s.aperture = +clamp(d.aperture > 0 ? 0.3 + 0.12 * k('aperture') : 0.3 - 0.35 * k('aperture'), -0.25, 0.45).toFixed(3);
  if (d.square !== undefined) s.square = +clamp(d.square > 0 ? 2 + 1.6 * k('square') : 2, 2, 6).toFixed(2);
  if (d.stress !== undefined) { const deg = d.stress > 0 ? clamp(25 * k('stress'), 0, 35) : 0; s.nib = +(deg * Math.PI / 180).toFixed(4); s.nibDegrees = deg; }
  // explicit: axes the description decided (by words or by a theme); the app should never let mood guesses move these.
  // fromTheme: the subset that came from a theme rather than a direct word.
  const fromTheme = Object.keys(d).filter(a => c.why.some(w => w.axis === a && /^theme/.test(w.because)));
  const explicit = [...Object.keys(d), ...Object.keys(c.extra || {}).map(a => a === 'soft' ? 'contrast' : a)].filter((a, i, A) => A.indexOf(a) === i);
  const why = c.why.map(w => w.axis === 'soft' ? { ...w, axis: 'contrast', value: 'a little lower' } : w);
  const both = /\bboth\b[^.]*\bserif\b[^.]*\bsans?[- ]?(serif)?\b|\bsans?[- ]?(serif)?\b[^.]*\band\b[^.]*\bserif\b|\bserif and sans\b/.test(String(brief).toLowerCase()) ? ['serif', 'sans'] : null; // round 23: a request for both styles; the app shows one result per style
  return { settings: s, why, rest: c.rest, ref: c.ref && c.ref.family, explicit, fromTheme, refine, both };
}
