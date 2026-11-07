// Mood layer: plain words -> tags -> nearest measured real fonts -> shape shifts -> design settings.
// Explicit word rules always win; this layer only fills settings the rules left alone, and every
// change it makes is returned as an "inferred" guess the user can see and undo.
import PACKED from './mood-data.js';

// The tables ship as base64 raw deflate and are unpacked once with the browser's own DecompressionStream.
const tick = () => new Promise(r => setTimeout(r, 0)); // give the page a turn between big steps
let DATA = null, TAGS = null, METRICS = null, STOP = new Set(), loading = null;
export function moodReady() { return !!DATA; }
export function initMood() {
  if (DATA) return Promise.resolve();
  return loading || (loading = (async () => {
    const bytes = Uint8Array.from(atob(PACKED), c => c.charCodeAt(0));
    const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    await tick(); const data = JSON.parse(text);
    TAGS = data.tags; METRICS = data.metrics; STOP = new Set(data.stop);
    DATA = data; await tick(); fonts(); await tick(); glove();
  })());
}
let pool = null;
function fonts() {
  if (pool) return pool;
  return pool = DATA.fonts.split(';').map(row => {
    const [t, z] = row.split('|'); const tg = []; let norm = 0;
    for (const p of t.split(',')) { if (!p) continue; const [i, v] = p.split(':').map(Number); tg.push([i, v * 10]); norm += v * v * 100; }
    return { tg, norm, z: z.split(',').map(v => v === '' ? null : Number(v) / 10) };
  });
}
// Word -> [[tag, strength 0..255]...], decoded on first use from the packed front-coded list.
let gl = null;
function glove() {
  if (gl) return gl;
  gl = new Map();
  const bin = atob(DATA.glove.data); let pos = 0, prev = '';
  for (const tok of DATA.glove.words.split(' ')) {
    if (!tok) continue;
    const w = prev.slice(0, tok.charCodeAt(0) - 48) + tok.slice(1); prev = w;
    const n = bin.charCodeAt(pos++), e = [];
    for (let k = 0; k < n; k++, pos += 2) e.push([bin.charCodeAt(pos), bin.charCodeAt(pos + 1)]);
    gl.set(w, e);
  }
  return gl;
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
    const g = glove().get(w0) || glove().get(w);
    if (g) { for (const [k, s] of g) q[k] += s / 255 * 0.6; any = true; }
  }
  return any ? q : null;
}

// Nearest 25 real fonts by tag profile, averaged shape shift (z-scores), scaled by the strength of the words.
let VARIANT = 0;
export function setVariant(n) { VARIANT = Math.max(0, n | 0); }
export function getVariant() { return VARIANT; }
export function shiftFromTags(q, k = 25) {
  let tot = 0, qn = 0; for (const v of q) { tot += v; qn += v * v; } qn = Math.sqrt(qn);
  if (!tot) return null;
  const scored = fonts().map(f => { let d = 0; for (const [i, v] of f.tg) if (q[i]) d += q[i] * v; return [d / (qn * Math.sqrt(f.norm) || 1), f]; })
    .sort((a, b) => b[0] - a[0]);
  const lo = Math.min(VARIANT * 8, Math.max(0, scored.length - k)); // "Try another" slides the window down the ranked fonts
  scored.splice(0, lo); scored.length = Math.min(scored.length, k);
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
  if (z.foot > 0.45 && !(z.mono > 1.2)) set('serifs', true, 'feet and serifs');
  if (z.topw < -0.3 && z.foot < 0.2) set('terminals', 'Rounded', 'rounded stroke ends');
  if (z.mono > 1.2) set('monospaced', true, 'even letter widths');
  return { out, why };
}

// prompt: the user's words; used: Set of words the explicit rules already consumed; free: Set of setting keys not set by rules.
export function applyMood(prompt, base, used, free) {
  if (!DATA) return { settings: {}, inferred: [] }; // tables still unpacking; the app re-reads the brief when ready
  const q = tagsFor(prompt, used); if (!q) return { settings: {}, inferred: [] };
  const sh = shiftFromTags(q); if (!sh) return { settings: {}, inferred: [] };
  const { out, why } = settingsFromShift(sh.z, base, free);
  return { settings: out, inferred: Object.keys(out).map(k => ({ key: k, value: out[k], because: `Guessed from the feel of your words: ${why[k]}.` })) };
}

// Unpack and index the tables once, after first paint, so the first typed brief does not pay for it.
export function warmMood() { return initMood(); }
