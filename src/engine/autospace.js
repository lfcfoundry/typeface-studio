// Automatic letter fit: sidebearings from each side's shape, using a model fitted on 632 Google Fonts sans families.
import { flatten } from './geometry.js';
const WS = [0.063, 0.766, -0.066, 0.04, 0.519, 0.057]; // sans: 1, flatness, depth, depth^2, flatness*depth, capital
const WR = [0.415, -0.108, -0.361, 0.058, 0.955, 0.073]; // serif model, fitted on 235 Google Fonts serif families
let W = WS;
function runsY(polys, y) { const xs = []; for (const q of polys) for (let i = 0; i < q.length - 1; i++) { const a = q[i], b = q[i + 1]; if ((a.y <= y) !== (b.y <= y)) xs.push([a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x), b.y > a.y ? 1 : -1]); }
  xs.sort((m, n) => m[0] - n[0]); const out = []; let w = 0, st = 0; for (const [x, d] of xs) { const nw = w + d; if (w === 0 && nw !== 0) st = x; if (w !== 0 && nw === 0) out.push([st, x]); w = nw; } return out; }
export function sideFeatures(polys, zone, stem) { const xs = polys.flat().map(p => p.x); const x0 = Math.min(...xs), x1 = Math.max(...xs); const dL = [], dR = [];
  for (let i = 0; i < 40; i++) { const y = zone[0] + (zone[1] - zone[0]) * (i + 0.5) / 40, r = runsY(polys, y); if (!r.length) { dL.push(3); dR.push(3); continue; } dL.push(Math.min(3, (r[0][0] - x0) / stem)); dR.push(Math.min(3, (x1 - r[r.length - 1][1]) / stem)); }
  const f = d => [d.filter(v => v < 0.25).length / 40, d.reduce((a, b) => a + b, 0) / 40]; return { x0, x1, L: f(dL), R: f(dR) }; }
const sb = ([fl, dep], upper) => W[0] + W[1] * fl + W[2] * dep + W[3] * dep * dep + W[4] * fl * dep + W[5] * upper;
// Tracy-style anchors: after the shape model, scale capitals so H gets 1.01 stems per side and lowercase so n
// averages 0.885 (Google Fonts sans medians). The model alone pulls both toward the middle.
const ANCHORS = { sans: { H: 1.01, n: 0.885 }, serif: { H: 0.38, n: 0.255 } }; let ANCHOR = ANCHORS.sans;
// Round 10 weight-aware spacing: in real fonts the sidebearing shrinks as the stem grows (Google Fonts variable fonts,
// wght 300 to 900, 305 sans and 77 serif families): absolute sidebearing ~ stem^b with b = -0.36 (H) / -0.40 (n) for sans and
// -0.61 / -0.53 for serif. Spacing is in stem units, so it is multiplied by (stem / stemRef)^(b - 1). stemRef is the
// default stem (90 at cap height 700), so default-weight fonts keep today's spacing.
const WEIGHT_EXP = { sans: { U: -1.360, L: -1.398 }, serif: { U: -1.609, L: -1.530 } }, STEM_REF = 90 / 700;
export function autoSpace(glyphs, { xHeight, capHeight, stem, spacing = 1, anchor = false, serif = false, slant = 0, weightSpace = false, weightExp = null }) {
  // slanted letters are measured upright (shear undone), the way italic spacing is judged along the slant
  const k = Math.tan(slant * Math.PI / 180), cy = xHeight / 2, flat = c => { const P = flatten(c); return k ? P.map(q => ({ x: q.x - (q.y - cy) * k, y: q.y })) : P; };
  W = serif ? WR : WS; ANCHOR = serif ? ANCHORS.serif : ANCHORS.sans; let kU = 1, kL = 1;
  const wq = stem / (STEM_REF * capHeight), WE = weightExp || (serif ? WEIGHT_EXP.serif : WEIGHT_EXP.sans), wU = weightSpace ? Math.pow(wq, WE.U) : 1, wL = weightSpace ? Math.pow(wq, WE.L) : 1;
  if (anchor) { const one = (ch, up) => { const g = glyphs[ch]; if (!g) return null; const F = sideFeatures(g.contours.map(flat), [0, up ? capHeight : xHeight], stem); return (Math.max(0.05, sb(F.L, up)) + Math.max(0.05, sb(F.R, up))) / 2; };
    const h = one('H', 1), n = one('n', 0); if (h) kU = ANCHOR.H / h; if (n) kL = ANCHOR.n / n; }
  for (const [ch, g] of Object.entries(glyphs)) { if (!/[A-Za-z0-9]/.test(ch) || !g.contours.length) continue;
    const polys = g.contours.map(flat); const up = /[A-Z0-9]/.test(ch); const F = sideFeatures(polys, [0, up ? capHeight : xHeight], stem);
    const k = up ? kU * wU : kL * wL, l = Math.max(0.05, sb(F.L, up)) * k * stem * spacing, r = Math.max(0.05, sb(F.R, up)) * k * stem * spacing, dx = Math.round(l - F.x0);
    g.contours = g.contours.map(c => ({ ...c, points: c.points.map(p => ({ ...p, x: p.x + dx })) })); g.advanceWidth = Math.round(F.x1 - F.x0 + l + r); }
  return glyphs; }
