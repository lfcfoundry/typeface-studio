// Description composer (round 6): reads negations, degrees, "but" clauses, comparatives and "like X but Y" references,
// turns them into explicit axis decisions with reasons, and hands the leftover words to the word rules and mood layer.
// Plain ES module, no Node imports. read() below turns a brief into pen settings with reasons.
const AX = [ // [pattern, axis, sign, consume?] ; sign for boolean axes: true/false. consume = remove the phrase so later rules don't reread it
  [/\bround (letters|shapes|bowls|forms|parts|letterforms)\b/, null, 0, true], // a noun phrase ("make the round letters square"), not a style word
  [/\b(hairline|delicate|fine|thin(ner)?) (\w+ )?(serifs?|hairlines?)\b|\bthin(ner)? (horizontal|vertical|cross) ?(strokes?|bars?|lines?)?\b|\bthin horizontals\b/, 'contrast', +1, true],
  [/\b(high|higher|strong|more|lots of|big) (stroke )?contrast\b|\bthick and thin\b|\bthicks? and thins?\b/, 'contrast', +1, true],
  [/\b(low|lower|less|little|no|minimal) (stroke )?contrast\b|\bmonoline\b|\beven strokes?\b|\buniform strokes?\b/, 'contrast', -1, true],
  [/\b(big|large|tall|high|bigger|larger|taller) x-?heights?\b/, 'xh', +1, true],
  [/\b(small|short|low|smaller|shorter) x-?heights?\b/, 'xh', -1, true],
  [/\b(open spacing|wide spacing|loose spacing|spaced out|generous spacing)\b/, 'spacing', +1, true],
  [/\btight spacing\b/, 'spacing', -1, true],
  [/\bgeometric\b/, 'serif', false],
  [/\b(bold|bolder|boldest|heavy|heavier|thick|thicker|fat|fatter|chunky|chunkier|black|strong|stronger|beefy)\b/, 'weight', +1],
  [/\b(light|lighter|thin|thinner|delicate|hairline|fine|finer|skinny|slim|slimmer)\b/, 'weight', -1],
  [/\b(wide|wider|widest|extended|expanded|broad|broader)\b/, 'width', +1],
  [/\b(narrow|narrower|condensed|compressed|squeezed|skinny)\b/, 'width', -1],
  [/\b(loose|looser|airy|spacious|roomy|open spacing|wide spacing|spaced out|generous spacing)\b/, 'spacing', +1],
  [/\b(tight|tighter|packed|compact|dense|crammed|tight spacing)\b/, 'spacing', -1],
  [/\bsans[- ]?serifs?\b|\bsans\b|\bno serifs?\b|\bwithout (the )?serifs?\b|\bserifless\b/, 'serif', false, true],
  [/\bslab(s|[- ]serifs?)?\b|\bserifs?\b|\bserifed\b/, 'serif', true],
  [/\b(round|rounded|rounder|roundish|soft|softer|curvy|bubbly)\b/, 'rounded', true],
  [/\b(sharp|sharper|angular|pointy|pointed|square|squared|crisp|edgy|geometric)\b/, 'rounded', false],
  [/\b(mono|monospace|monospaced|fixed[- ]width|typewriter|code|coding|programming|terminal)\b/, 'mono', true],
  [/\b(proportional)\b/, 'mono', false],
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
  const m = s.match(/\b(?:like|similar to|in the style of|based on|inspired by)\s+(?:an?\s+|the\s+)?([a-z0-9 ]+?)(?=\s*(?:,|\bbut\b|\bwith\b|\bwithout\b|\bonly\b|\bjust\b|\band\b|\.|$))/);
  if (m) { const name = m[1].trim().replace(/\s+(font|typeface)$/, ''); const key = ALIAS[name] || name.replace(/\s+/g, ''); if (families[key]) { ref = { name, family: key, z: families[key] }; s = s.replace(m[0], ' '); why.push({ axis: 'reference', value: key, because: `"like ${name}"` }); } }
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
  for (const k of Object.keys(set)) if (k.startsWith('_c') || k.startsWith('_x')) delete set[k];
  // leftover text for the word rules and mood layer: drop everything the composer read, including negated phrases
  let rest = ' ' + String(brief).toLowerCase() + ' '; if (ref) rest = rest.replace(m[0].trim(), ' ');
  for (const c of consumed.sort((a, b) => b.length - a.length)) if (c.trim()) rest = rest.split(c.trim()).join(' ');
  rest = rest.replace(/\b(but|though|yet|not|no|without|less|more|very|slightly|a bit|a little|neither|nor|too)\b/g, ' ').replace(/\s+/g, ' ').trim();
  return { set, strength, ref, why, rest };
}

// ---- settings for the pen engine (app-ready/index.mjs design()) ----
import { METRICS, FAMILIES } from './families.js';
const FAM = Object.fromEntries(Object.entries(FAMILIES).map(([k, z]) => [k, Object.fromEntries(METRICS.map((m, j) => [m, z[j]]))]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/**
 * read(brief, { base, rest }) -> { settings, why, rest, ref }
 * base: starting pen settings (e.g. RECOMMENDED). rest: optional callback that maps the leftover text to extra settings
 * (plug the app's word rules + mood layer in here); the composer's explicit choices always win over it.
 */
export function read(brief, { base = {}, rest = null } = {}) {
  const c = compose(brief, { families: FAM }); const s = { stem: 90, width: 1, contrast: 0.05, xHeight: 520, spacing: 1, caps: 'butt', slab: false, mono: false, ...base };
  if (c.ref) { const z = c.ref.z; // start from the referenced family's measured shape
    s.stem = Math.round(clamp(90 * (1 + 0.45 * z.stem), 40, 170)); s.width = +clamp(1 + 0.16 * z.nadv, 0.76, 1.3).toFixed(3); s.contrast = +clamp(0.05 + 0.25 * z.contrast, 0, 0.7).toFixed(3);
    s.xHeight = Math.round(clamp(520 + 40 * z.xr, 450, 590)); s.spacing = +clamp(1 + 0.12 * z.sb, 0.82, 1.22).toFixed(3); s.slab = z.foot > 0.45; s.serifModels = s.slab; s.mono = z.mono > 1.2; if (z.topw < -0.3 && z.foot < 0.2) s.caps = 'round'; }
  if (rest && c.rest) Object.assign(s, rest(c.rest) || {});
  const k = a => c.strength[a] ?? 1, d = c.set;
  if (d.weight !== undefined) s.stem = Math.round(clamp(d.weight === 0 ? 90 : s.stem * (1 + 0.35 * d.weight * k('weight')), 40, 170));
  else if (c.strength.weight < 1 && s.stem > 120) s.stem = 120; // "not too heavy"
  if (d.width !== undefined) s.width = +clamp(d.width === 0 ? 1 : s.width * (1 + 0.14 * d.width * k('width')), 0.72, 1.35).toFixed(3);
  if (d.contrast !== undefined) s.contrast = d.contrast > 0 ? Math.max(s.contrast, 0.35 + 0.15 * (k('contrast') - 1)) : 0;
  if (d.xh !== undefined) s.xHeight = Math.round(clamp(s.xHeight + 45 * d.xh * k('xh'), 450, 600));
  if (d.spacing !== undefined) s.spacing = +clamp(s.spacing * (1 + 0.12 * d.spacing * k('spacing')), 0.8, 1.3).toFixed(3);
  if (d.serif !== undefined) { s.slab = d.serif; s.serifModels = d.serif; }
  if (d.rounded !== undefined) s.caps = d.rounded ? 'round' : 'butt';
  if (d.mono !== undefined) s.mono = d.mono;
  return { settings: s, why: c.why, rest: c.rest, ref: c.ref && c.ref.family };
}
