// "More like this / less like this" (round 17). The app keeps the font's target shape as shape numbers (z, the 13 METRICS) and
// moves it toward or away from a reference font, then turns it into settings with the same map read() uses for "like X".
// Holding z (not just settings) keeps repeated steps from drifting through the settings clamps (round 16).
import { FAMILIES, METRICS } from './families.js';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const familyZ = name => { const v = FAMILIES[String(name).toLowerCase().replace(/[^a-z0-9]/g, '')]; return v ? Object.fromEntries(METRICS.map((m, i) => [m, v[i]])) : null; };
// the same forward map as reader.js's "like X" branch
export function settingsFromZ(z, base = {}) {
  const s = { ...base, stem: Math.round(clamp(90 * (1 + 0.45 * z.stem), 40, 170)), width: +clamp(1 + 0.16 * z.nadv, 0.76, 1.3).toFixed(3), contrast: +clamp(0.05 + 0.25 * z.contrast, 0, 0.7).toFixed(3),
    xHeight: Math.round(clamp(520 + 40 * z.xr, 450, 590)), spacing: +clamp(1 + 0.12 * z.sb, 0.82, 1.22).toFixed(3), mono: z.mono > 1.2, caps: z.topw < -0.3 && z.foot < 0.2 ? 'round' : 'butt' };
  s.style = z.foot > 0.45 ? 'serif' : 'sans'; return s;
}
// lossy start only: the first time, when the app has settings but no shape numbers yet
export function zFromSettings(s) {
  const z = Object.fromEntries(METRICS.map(m => [m, 0]));
  z.stem = ((s.stem ?? 90) / 90 - 1) / 0.45; z.nadv = ((s.width ?? 1) - 1) / 0.16; z.contrast = ((s.contrast ?? 0.05) - 0.05) / 0.25; z.xr = ((s.xHeight ?? 520) - 520) / 40; z.sb = ((s.spacing ?? 1) - 1) / 0.12;
  z.foot = s.style === 'serif' || s.slab ? 0.8 : 0; z.topw = s.caps === 'round' ? -0.6 : 0; z.mono = s.mono ? 2 : 0; return z;
}
// direction: +1 more like the reference, -1 less like it. step 0.4 is the suggested size. Returns the new z; call settingsFromZ on it.
// "Less" moves toward the mirror image of the reference around the average font (z = 0), so it still works when the font already
// equals the reference (a plain move away from it would not move at all).
export function moreLikeThis(z, refZ, direction = 1, step = 0.4) {
  const out = { ...z }; for (const m of METRICS) out[m] = z[m] + step * (direction * refZ[m] - z[m]); return out;
}
