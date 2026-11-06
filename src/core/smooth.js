// Smooth glyph style: the pen engine (src/engine) draws each letter from a few center lines.
// This file maps the app's design settings to the engine and its output to the app's glyph model.
import { removeOverlaps } from 'fontsketch/core';
import { design, BASE, RECOMMENDED } from '../engine/index.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function engineParams(design, style = 'Regular') {
  const d = design, bold = style === 'Bold';
  const stem = Math.round(40 + (clamp(d.stem, 0.18, 0.86) - 0.18) / 0.68 * 120) * (bold ? 1.55 : 1);
  return {
    ...BASE, ...RECOMMENDED, serifModels: true,
    stem: Math.round(stem), width: clamp(d.width, 0.65, 1.4) * (RECOMMENDED.width ?? 1), contrast: clamp(d.contrast, 0, 0.8),
    xHeight: Math.round(700 * d.xHeight), capHeight: Math.round(700 * d.capHeight), spacing: d.spacing,
    caps: d.terminals === 'Rounded' ? 'round' : 'butt', slab: !!d.serifs, mono: !!d.monospaced,
  };
}

const cache = new Map(); // results computed in the worker, keyed by the exact engine settings
const keyOf = (designSettings, style) => style + JSON.stringify(engineParams(designSettings, style));
export function cacheSmooth(designSettings, style, result) { if (cache.size >= 4) cache.clear(); cache.set(keyOf(designSettings, style), result); }
export function cachedSmooth(designSettings, style) { return cache.get(keyOf(designSettings, style)); }

// Returns { glyphs: { char: {contours:[[{x,y,on}]], advanceWidth, leftSideBearing, rightSideBearing} }, kern }
export function generateSmooth(designSettings, style = 'Regular') {
  const hit = cachedSmooth(designSettings, style); if (hit) return hit;
  const { glyphs, kerning: kern } = design(engineParams(designSettings, style), { removeOverlaps });
  const out = {};
  for (const [ch, g] of Object.entries(glyphs)) {
    const contours = g.contours.map(c => c.points.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), on: p.on !== false })));
    for (let i = contours.length - 1; i >= 0; i--) { // drop sliver contours the overlap union can leave behind
      const c = contours[i]; const area = c.reduce((sum, pt, j) => sum + pt.x * c[(j + 1) % c.length].y - c[(j + 1) % c.length].x * pt.y, 0);
      if (c.length < 3 || Math.abs(area) < 40) contours.splice(i, 1);
    }
    const xs = contours.flat().map(p => p.x);
    const left = xs.length ? Math.min(...xs) : 0, right = xs.length ? Math.max(...xs) : 0;
    const advance = Math.round(g.advanceWidth);
    out[ch] = { contours, advanceWidth: advance, leftSideBearing: left, rightSideBearing: Math.max(0, advance - right) };
  }
  return { glyphs: out, kern, monoWidth: Math.round(560 * clamp(designSettings.width, 0.65, 1.4) * (RECOMMENDED.width ?? 1) * designSettings.spacing) };
}
