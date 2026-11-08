// Typeface Studio letter engine, one entry point. Plain ES modules, no Node or npm imports; runs in a worker.
import { buildGlyphs, BASE } from './pen.js'; import { addExtras } from './extras.js'; import { autoSpace } from './autospace.js'; import { autoKern } from './autokern.js'; import { FIT, FIT_SERIF } from './tables.js';
export { BASE };
// Recommended defaults from rounds 4 and 5. The owner approved the learned letter fit and the wider default (card, 2026.11.06 10:08 AM ET).
export const RECOMMENDED = { overshoot: true, optical: true, flatCut: true, autoSpace: true, anchor: true, autoKern: true, fit: true, width: 1.139, weightSpace: true, weightWidth: true, relief: 0.3, bowlOpen: 0.6, symbolRelief: 0.3 }; // weightSpace: owner's card 2026.11.06 9:27 PM Eastern; weightWidth: 9:38 PM Eastern
export const LEARNED_LOOK = { fit: true, width: 1.139 };
// Round 7 (owner's card 2026.11.06 10:13 AM ET: offer both as styles). SERIF = curved bracketed serifs + serif-learned fit; SLAB = the blocky slab feet.
export const SERIF_LOOK = { slab: true, serifModels: true, serif2: true, serifLen: 0.8 };
// Round 8: slab feet rebuilt as contour slabs (slab2): reach and thickness scale with the stem, both legs of n h m u get feet,
// and the overlap merge is 9x to 16x faster than the classic stroke feet. slabClassic keeps the round 6 feet.
export const STYLES = { sans: {}, serif: SERIF_LOOK, slab: { slab: true, serifModels: true, serif2: false, slab2: true }, slabClassic: { slab: true, serifModels: true, serif2: false } };
/**
 * design(settings, { removeOverlaps }) -> { glyphs, kerning, fallbacks, settings }
 * settings: any of BASE's keys (stem, width, contrast, nib, caps, square, aperture, xHeight, capHeight, spacing, slab, mono)
 *   plus overshoot, optical, flatCut, autoSpace, anchor, autoKern, fit (true = learned table), serifModels.
 *   round 10: weightSpace (spacing, serif reach and a kerning guard that follow the weight, as measured on real fonts; off by default).
 * removeOverlaps: pass fontsketch's removeOverlaps for download fonts; omit for the fast preview (overlaps kept).
 * glyphs: { char: { name, unicodes, advanceWidth, contours:[{ closed, points:[{x,y,on}] }] } } ready for fontsketch addGlyph.
 * kerning: { 'nameL|nameR': value } ready for font.kerning.pairs.
 */
export function design(settings = {}, { removeOverlaps = null } = {}) {
  const p = { ...BASE, ...settings }; if (p.stem > (p.maxStem ?? 200)) p.stem = p.maxStem ?? 200; /* round 27e: beyond about stem 200 (weight 1000 in real fonts) the letters close up; the app's Bold of 234 was past that */ if (p.italic && p.italicWidth !== false) p.width = +(p.width * (p.slab ? 0.989 : 0.972)).toFixed(4); /* round 13b, owner approved 2026.11.07: real italics are narrower (sans 0.978x, serif 0.936x of upright; ours was 1.006x and 0.946x) */ if (p.fit === true) p.fit = p.serif2 ? FIT_SERIF : FIT; const fallbacks = [];
  const glyphs = buildGlyphs(p, { removeOverlaps, fallbacks }); const serif = !!(p.slab && p.serifModels);
  if (p.autoSpace && !p.mono) autoSpace(glyphs, { xHeight: p.xHeight, capHeight: p.capHeight, stem: p.stem, spacing: p.spacing, anchor: !!p.anchor, serif, slant: p.slant || 0, weightSpace: !!p.weightSpace, weightExp: p.weightExp || null });
  if (p.slab && p.stem > 105 && !p.mono && p.heavySlabPad !== 0) { /* round 27c: bold slab and serif feet need more room: add side bearing in proportion to the extra weight (measured: pairs under 8 units apart fall from 43% to about 15%) */
    const e = Math.round((p.heavySlabPad ?? 0.6) * Math.min(p.stem - 105, p.heavySlabCap ?? 70)); for (const g of Object.values(glyphs)) { g.contours = g.contours.map(c => ({ ...c, points: c.points.map(q => ({ ...q, x: q.x + Math.round(e / 2) })) })); g.advanceWidth += e; } }
  const kerning = p.autoKern && !p.mono ? autoKern(glyphs, { xHeight: p.xHeight, capHeight: p.capHeight, stem: p.stem, serif, guard: !!p.weightSpace }) : {};
  if (p.extras !== false && glyphs['H'] && glyphs['o']) { const before = new Set(Object.keys(glyphs)); addExtras(glyphs, kerning, p);
    if (p.mono) { const mw = glyphs['H'].advanceWidth; for (const ch of Object.keys(glyphs)) { if (before.has(ch)) continue; const g = glyphs[ch]; let a = 1e9, b = -1e9; for (const c of g.contours) for (const q of c.points) { a = Math.min(a, q.x); b = Math.max(b, q.x); } if (!(b > a)) { g.advanceWidth = mw; continue; } const k = (b - a) > mw * 0.92 ? mw * 0.92 / (b - a) : 1; const sh = (mw - (b - a) * k) / 2 - a * k; g.contours = g.contours.map(c => ({ ...c, points: c.points.map(q => ({ ...q, x: Math.round(q.x * k + sh) })) })); g.advanceWidth = mw; } } }
  return { glyphs, kerning, fallbacks, settings: p };
}

// Round 12: "Try another" for words that pin every setting. Step k (1 to 3) makes a small move on settings the words did not pin
// (never weight, width, style, slant, serif or mono). `explicit` is read()'s explicit list; pinned keys are skipped.
// Owner approved 2026.11.06 (card, Yes, build it). Steps 4+ repeat step 3's shape with a wrap.
export const TRY_ANOTHER = [
  { xHeight: +20, contrast: +0.10 },
  { xHeight: -20, square: -0.2 },
  { contrast: -0.03, square: +0.3 },
];
export function tryAnother(settings, k, explicit = []) {
  const s = TRY_ANOTHER[(Math.max(1, k | 0) - 1) % TRY_ANOTHER.length], pinned = new Set(explicit), out = { ...settings };
  if (s.xHeight && !pinned.has('xHeight') && !pinned.has('xheight')) out.xHeight = (settings.xHeight ?? 520) + s.xHeight;
  if (s.contrast && !pinned.has('contrast')) out.contrast = Math.min(0.6, Math.max(0, (settings.contrast ?? 0.05) + s.contrast));
  if (s.square && !pinned.has('square')) out.square = (settings.square ?? 2) + s.square;
  return out;
}

// Round 15: farthest-point Try another picks. From a small grid of safe moves (x-height -20/0/+20, contrast -.03/0/+.10, squareness
// -.2/0/+.3) on settings the words did not pin, pick three that are each a visible but modest step (distance .04 to .25) and as far
// from the base and from each other as possible. Distance is a cheap fit to measured pixel differences, no drawing needed.
// Returns an array of up to three settings objects (best first). Owner approved switching Try another to these picks 2026.11.07.
export function tryAnotherPicks(settings, explicit = []) {
  const pinned = new Set(explicit), P = (a, b) => pinned.has(a) || pinned.has(b);
  const pxh = P('xHeight', 'xheight'), pc = pinned.has('contrast'), psq = pinned.has('square'), seen = new Set(['0|0|0']), pool = [];
  for (const xh of [-20, 0, 20]) for (const c of [-0.03, 0, 0.1]) for (const sq of [-0.2, 0, 0.3]) {
    const q = { xh: pxh ? 0 : xh, c: pc ? 0 : c, sq: psq ? 0 : sq }, k = q.xh + '|' + q.c + '|' + q.sq; if (!seen.has(k)) { seen.add(k); pool.push(q); } }
  const d = (p, q) => Math.hypot((p.xh - q.xh) / 20 * 0.12, (p.c - q.c) / 0.1 * 0.04, (p.sq - q.sq) / 0.2 * 0.1), O = { xh: 0, c: 0, sq: 0 };
  const ok = pool.filter(p => d(p, O) >= 0.04 && d(p, O) <= 0.25), sel = [O];
  for (let i = 0; i < 3 && ok.length; i++) { let best = null, bv = -1; for (const p of ok) { if (sel.includes(p)) continue; const m = Math.min(...sel.map(q => d(q, p))); if (m > bv) { bv = m; best = p; } } if (best) sel.push(best); }
  return sel.slice(1).map(p => ({ ...settings, xHeight: (settings.xHeight ?? 520) + p.xh, contrast: Math.min(0.6, Math.max(0, (settings.contrast ?? 0.05) + p.c)), square: (settings.square ?? 2) + p.sq }));
}
