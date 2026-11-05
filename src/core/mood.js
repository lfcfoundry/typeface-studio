// Mood layer: plain words -> tags -> nearest measured real fonts -> shape shifts -> design settings.
// Explicit word rules always win; this layer only fills settings the rules left alone, and every
// change it makes is returned as an "inferred" guess the user can see and undo.
import DATA from './mood-data.js';

const { tags: TAGS, metrics: METRICS, stop } = DATA;
const STOP = new Set(stop);
let pool = null;
function fonts() {
  if (pool) return pool;
  return pool = DATA.fonts.map(row => {
    const [t, z] = row.split('|'); const tg = []; let norm = 0;
    for (const p of t.split(',')) { if (!p) continue; const [i, v] = p.split(':').map(Number); tg.push([i, v]); norm += v * v; }
    return { tg, norm, z: z.split(',').map(v => v === '' ? null : Number(v) / 100) };
  });
}
const words = s => (String(s).toLowerCase().replace(/ice cream/g, 'icecream').replace(/sci-fi/g, 'scifi').match(/[a-z]+/g) || []).filter(w => !STOP.has(w));
const stem = w => w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;

export function tagsFor(brief, skip = new Set()) {
  const q = new Float64Array(TAGS.length); let any = false;
  for (const w0 of words(brief)) {
    if (skip.has(w0)) continue;
    const w = DATA.lex[w0] ? w0 : stem(w0);
    const lx = DATA.lex[w];
    if (lx) { for (const [i, v] of lx) q[i] += v / 100; any = true; continue; }
    const g = DATA.glove[w0] || DATA.glove[w];
    if (g) { for (const [k, s] of g) q[k] += s / 255 * 0.6; any = true; }
  }
  return any ? q : null;
}

// Nearest 25 real fonts by tag profile, averaged shape shift (z-scores), scaled by the strength of the words.
export function shiftFromTags(q, k = 25) {
  let tot = 0, qn = 0; for (const v of q) { tot += v; qn += v * v; } qn = Math.sqrt(qn);
  if (!tot) return null;
  const scored = fonts().map(f => { let d = 0; for (const [i, v] of f.tg) if (q[i]) d += q[i] * v; return [d / (qn * Math.sqrt(f.norm) || 1), f]; })
    .sort((a, b) => b[0] - a[0]).slice(0, k);
  const gain = Math.min(1, tot), z = {};
  METRICS.forEach((m, j) => { let s = 0; for (const [, f] of scored) if (f.z[j] != null) s += f.z[j] / k; z[m] = s * gain; });
  return { z, nearest: scored.slice(0, 3).map(s => s[0]) };
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const TH = 0.15; // ignore tiny shifts
const big = v => Math.abs(v) >= TH;
// Convert shifts into this app's design settings, only for the keys listed in `free`.
export function settingsFromShift(z, base, free) {
  const out = {}, why = {};
  const set = (key, value, reason) => { if (free.has(key) && value !== base[key]) { out[key] = value; why[key] = reason; } };
  if (big(z.stem)) set('stem', +clamp(base.stem + 0.17 * z.stem, 0.18, 0.86).toFixed(2), z.stem > 0 ? 'heavier strokes' : 'lighter strokes');
  if (big(z.nadv)) set('width', +clamp(base.width + 0.16 * z.nadv, 0.76, 1.24).toFixed(2), z.nadv > 0 ? 'wider letters' : 'narrower letters');
  if (big(z.contrast)) set('contrast', +clamp(base.contrast + 0.25 * z.contrast, 0.04, 0.68).toFixed(2), z.contrast > 0 ? 'more thick-thin contrast' : 'less thick-thin contrast');
  if (big(z.xr)) set('xHeight', +clamp(base.xHeight + 0.057 * z.xr, 0.62, 0.82).toFixed(2), z.xr > 0 ? 'taller lowercase' : 'shorter lowercase');
  if (big(z.sb)) set('spacing', +clamp(base.spacing + 0.12 * z.sb, 0.82, 1.22).toFixed(2), z.sb > 0 ? 'looser spacing' : 'tighter spacing');
  if (z.foot > 0.45) set('serifs', true, 'feet and serifs');
  if (z.topw < -0.3 && z.foot < 0.2) set('terminals', 'Rounded', 'rounded stroke ends');
  if (z.mono > 1.2) set('monospaced', true, 'even letter widths');
  return { out, why };
}

// prompt: the user's words; used: Set of words the explicit rules already consumed; free: Set of setting keys not set by rules.
export function applyMood(prompt, base, used, free) {
  const q = tagsFor(prompt, used); if (!q) return { settings: {}, inferred: [] };
  const sh = shiftFromTags(q); if (!sh) return { settings: {}, inferred: [] };
  const { out, why } = settingsFromShift(sh.z, base, free);
  return { settings: out, inferred: Object.keys(out).map(k => ({ key: k, value: out[k], because: `Guessed from the feel of your words: ${why[k]}.` })) };
}

// Build the font pool once, after first paint, so the first typed brief does not pay for it.
export function warmMood() { fonts(); }
