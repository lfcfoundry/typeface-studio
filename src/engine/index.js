// Typeface Studio letter engine, one entry point. Plain ES modules, no Node or npm imports; runs in a worker.
import { buildGlyphs, BASE } from './pen.js'; import { autoSpace } from './autospace.js'; import { autoKern } from './autokern.js'; import { FIT } from './tables.js';
export { BASE };
// Recommended defaults from rounds 4 and 5. fit / width 1.139 wait on the owner's look card, so they are off unless asked.
export const RECOMMENDED = { overshoot: true, optical: true, flatCut: true, autoSpace: true, anchor: true, autoKern: true };
export const LEARNED_LOOK = { fit: true, width: 1.139 };
/**
 * design(settings, { removeOverlaps }) -> { glyphs, kerning, fallbacks, settings }
 * settings: any of BASE's keys (stem, width, contrast, nib, caps, square, aperture, xHeight, capHeight, spacing, slab, mono)
 *   plus overshoot, optical, flatCut, autoSpace, anchor, autoKern, fit (true = learned table), serifModels.
 * removeOverlaps: pass fontsketch's removeOverlaps for download fonts; omit for the fast preview (overlaps kept).
 * glyphs: { char: { name, unicodes, advanceWidth, contours:[{ closed, points:[{x,y,on}] }] } } ready for fontsketch addGlyph.
 * kerning: { 'nameL|nameR': value } ready for font.kerning.pairs.
 */
export function design(settings = {}, { removeOverlaps = null } = {}) {
  const p = { ...BASE, ...settings }; if (p.fit === true) p.fit = FIT; const fallbacks = [];
  const glyphs = buildGlyphs(p, { removeOverlaps, fallbacks }); const serif = !!(p.slab && p.serifModels);
  if (p.autoSpace && !p.mono) autoSpace(glyphs, { xHeight: p.xHeight, capHeight: p.capHeight, stem: p.stem, spacing: p.spacing, anchor: !!p.anchor, serif });
  const kerning = p.autoKern && !p.mono ? autoKern(glyphs, { xHeight: p.xHeight, capHeight: p.capHeight, stem: p.stem, serif }) : {};
  return { glyphs, kerning, fallbacks, settings: p };
}
