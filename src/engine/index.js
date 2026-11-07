// Typeface Studio letter engine, one entry point. Plain ES modules, no Node or npm imports; runs in a worker.
import { buildGlyphs, BASE } from './pen.js'; import { autoSpace } from './autospace.js'; import { autoKern } from './autokern.js'; import { FIT, FIT_SERIF } from './tables.js';
export { BASE };
// Recommended defaults from rounds 4 and 5. The owner approved the learned letter fit and the wider default (card, 2026.11.06 10:08 AM ET).
export const RECOMMENDED = { overshoot: true, optical: true, flatCut: true, autoSpace: true, anchor: true, autoKern: true, fit: true, width: 1.139 };
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
 * removeOverlaps: pass fontsketch's removeOverlaps for download fonts; omit for the fast preview (overlaps kept).
 * glyphs: { char: { name, unicodes, advanceWidth, contours:[{ closed, points:[{x,y,on}] }] } } ready for fontsketch addGlyph.
 * kerning: { 'nameL|nameR': value } ready for font.kerning.pairs.
 */
export function design(settings = {}, { removeOverlaps = null } = {}) {
  const p = { ...BASE, ...settings }; if (p.fit === true) p.fit = p.serif2 ? FIT_SERIF : FIT; const fallbacks = [];
  const glyphs = buildGlyphs(p, { removeOverlaps, fallbacks }); const serif = !!(p.slab && p.serifModels);
  if (p.autoSpace && !p.mono) autoSpace(glyphs, { xHeight: p.xHeight, capHeight: p.capHeight, stem: p.stem, spacing: p.spacing, anchor: !!p.anchor, serif, slant: p.slant || 0 });
  const kerning = p.autoKern && !p.mono ? autoKern(glyphs, { xHeight: p.xHeight, capHeight: p.capHeight, stem: p.stem, serif }) : {};
  return { glyphs, kerning, fallbacks, settings: p };
}
