// Smooth glyph style: the pen engine (src/engine) draws each letter from a few center lines.
// This file maps the app's design settings to the engine and its output to the app's glyph model.
import { buildSmooth, BASE } from '../engine/pen.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function engineParams(design, style = 'Regular') {
  const d = design, bold = style === 'Bold';
  const stem = Math.round(40 + (clamp(d.stem, 0.18, 0.86) - 0.18) / 0.68 * 120) * (bold ? 1.55 : 1);
  return {
    ...BASE, overshoot: true, optical: true, flatCut: true, autoSpace: true, anchor: true, autoKern: true,
    stem: Math.round(stem), width: clamp(d.width, 0.65, 1.4), contrast: clamp(d.contrast, 0, 0.8),
    xHeight: Math.round(700 * d.xHeight), capHeight: Math.round(700 * d.capHeight), spacing: d.spacing,
    caps: d.terminals === 'Rounded' ? 'round' : 'butt', slab: !!d.serifs, mono: !!d.monospaced,
  };
}

// Returns { glyphs: { char: {contours:[[{x,y,on}]], advanceWidth, leftSideBearing, rightSideBearing} }, kern }
export function generateSmooth(design, style = 'Regular') {
  const { glyphs, kern } = buildSmooth(engineParams(design, style));
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
  return { glyphs: out, kern, monoWidth: Math.round(560 * clamp(design.width, 0.65, 1.4) * design.spacing) };
}
