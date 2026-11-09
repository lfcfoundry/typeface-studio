// Pen engine (app-ready copy of research skeleton3.js): plain ES module, no Node or npm imports.
// Skeleton + nib prototype: one centerline set per glyph, expanded by a pen model.
// Parameters: stem (weight), width, contrast, nib angle (stress), caps (butt|round),
// squareness (superellipse bowls), aperture, xHeight, capHeight, slab (serif feet).
import { mismatch } from './geometry.js';

let N = 24; // fixed samples per curve => point-compatible masters for variable fonts
export const setSamples = n => { N = n; };
const line = (x0, y0, x1, y1) => Array.from({ length: 2 }, (_, i) => ({ x: x0 + (x1 - x0) * i, y: y0 + (y1 - y0) * i }));
// superellipse arc: n=2 ellipse, larger n = squarer. angles in degrees, counter-clockwise from +x
function arc(cx, cy, rx, ry, a0, a1, n = 2, steps = N) {
  const out = []; for (let i = 0; i <= steps; i++) { const t = (a0 + (a1 - a0) * i / steps) * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
    out.push({ x: cx + rx * Math.sign(c) * Math.abs(c) ** (2 / n), y: cy + ry * Math.sign(s) * Math.abs(s) ** (2 / n) }); } return out;
}
// thickness of a broad nib moving in direction theta
export const relief = p => p.relief ? 1 - p.relief * Math.min(1.8, Math.max(0, (p.stem - 105) / 60)) /* grows past stem 165 so counters stay open up to the stem cap */ : 1; // round 26: heavy weights thin their horizontal strokes so counters stay open (real bold fonts do the same)
const thick = (p, th) => { const W = p.stem * (p._round ? (p.optical ? 1.035 : 1) : 1), h = Math.max(W * (1 - p.contrast) * (p.optical ? 0.88 : 1) * relief(p), (p.minHair || 0) * p.stem); /* minHair: thin parts never vanish */ return h + (W - h) * Math.abs(Math.sin(th - p.nib)); };
// Expand one open centerline into a closed contour. Offsets along the normal; sharp butt caps or round caps.
function expand(pts, p, closed = false) {
  if (closed && p.optical) p = { ...p, _round: true };
  if (p.caps === 'round' && !closed && pts.length > 1) { // pull ends in by the cap radius so round ends sit on baseline and x-height
    pts = pts.map(q => ({ ...q })); const n0 = pts.length;
    for (const [i, j] of [[0, 1], [n0 - 1, n0 - 2]]) { const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y, d = Math.hypot(dx, dy) || 1, r = thick(p, Math.atan2(dy, dx)) / 2; if (Math.abs(dy) > Math.abs(dx) * 3) { pts[i].x += dx / d * Math.min(r, d * 0.4); pts[i].y += dy / d * Math.min(r, d * 0.4); } }
  }
  const L = [], R = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const th = Math.atan2(b.y - a.y, b.x - a.x), t = thick(p, th) / 2, nx = -Math.sin(th), ny = Math.cos(th);
    L.push({ x: pts[i].x + nx * t, y: pts[i].y + ny * t }); R.push({ x: pts[i].x - nx * t, y: pts[i].y - ny * t });
  }
  // only straight diagonals (6-point lines) ending on a guide line get a flat cut; curved ends keep their square cut
  const guides = [0, p.xHeight, p.capHeight, -190];
  if (p.flatCut && !closed && n === 6) for (const [e, f] of [[0, 1], [n - 1, n - 2]]) { if (!guides.some(gy => Math.abs(pts[e].y - gy) < 2)) continue;
    const dx = pts[e].x - pts[f].x, dy = pts[e].y - pts[f].y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    if (Math.abs(uy) > 0.2 && Math.abs(ux) > 0.2) for (const S of [L, R]) { const t = (pts[e].y - S[e].y) / uy; S[e] = { x: S[e].x + ux * t, y: pts[e].y }; }
  }
  const smooth = q => q.map((pt, i) => ({ x: Math.round(pt.x), y: Math.round(pt.y), on: i === 0 || i === q.length - 1 || pts.length === 2 }));
  if (closed) return [{ closed: true, points: L.map(q => ({ x: Math.round(q.x), y: Math.round(q.y), on: false })) }, { closed: true, points: R.reverse().map(q => ({ x: Math.round(q.x), y: Math.round(q.y), on: false })) }];
  let pts2 = [...smooth(L), ...smooth(R.reverse())];
  if (p.caps === 'round') { // add a half-disc cap as off-curve points at each end (same count every master)
    const cap = (c, dirFrom, r) => [60, 0, -60].map(d => { const a = dirFrom + d * Math.PI / 180, k = d ? 1.07 : 1.07; return { x: Math.round(c.x + Math.cos(a) * r * k), y: Math.round(c.y + Math.sin(a) * r * k), on: false }; });
    const th0 = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x), th1 = Math.atan2(pts[n - 1].y - pts[n - 2].y, pts[n - 1].x - pts[n - 2].x);
    const half = L.length; pts2 = [...pts2.slice(0, half), ...cap(pts[n - 1], th1, thick(p, th1) / 2), ...pts2.slice(half), ...cap(pts[0], th0 + Math.PI, thick(p, th0) / 2)];
  }
  return [{ closed: true, points: pts2 }];
}
const lineDense = (x0, y0, x1, y1) => Array.from({ length: 6 }, (_, i) => ({ x: x0 + (x1 - x0) * i / 5, y: y0 + (y1 - y0) * i / 5 }));
import { alphabet, NAMES } from './alphabet.js';

function skeletons(p) {
  const G = alphabet(p, { line: lineDense, arc: (cx, cy, rx, ry, a0, a1, q) => arc(cx, cy, rx, ry, a0, a1, q, N) });
  if (p.slab && !p.serif2 && !p.slab2) for (const [ch, g] of Object.entries(G)) if (/[A-Za-z0-9]/.test(ch)) for (const st of [...g.strokes]) { if (st.closed) continue; const a = st.pts[0], b = st.pts[st.pts.length - 1];
    if (st.pts.length === 6 && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) > p.xHeight * 0.6) { const w = p.stem * 1.5, hh = p.stem * (1 - Math.max(p.contrast, 0.3)) / 2;
      for (const y of [Math.min(a.y, b.y)]) if (y >= -1) g.strokes.push({ pts: lineDense(a.x - w, y + hh, a.x + w, y + hh), foot: true }); } }
  if (p.proportions) proportion(G, p);
  if (p.fit) applyFit(G, p.fit, p);
  // round 10c (weightWidth): real letters widen as they get bolder so counters stay open (Google Fonts 700 vs 400:
  // sans n ink 1.115x, o 1.067x, O 1.044x). Center lines widen by (stem / 90 at cap 700)^e, lowercase and capitals separately.
  if (p.weightWidth) { const q = p.stem / (p.capHeight * 90 / 700), E = p.weightWidthExp || [q < 1 ? (p.weightWidthLight ?? 0.12) : 0.3, 0.1];
    for (const [ch, g] of Object.entries(G)) { if (!/[A-Za-z0-9]/.test(ch)) continue; const k = Math.pow(q, /[a-z]/.test(ch) ? E[0] : E[1]); if (k === 1) continue;
      const xs = g.strokes.flatMap(st => st.pts.map(v => v.x)); const x0 = Math.min(...xs), x1 = Math.max(...xs), c = (x0 + x1) / 2;
      for (const st of g.strokes) st.pts = st.pts.map(v => ({ ...v, x: c + (v.x - c) * k })); g.w += (k - 1) * (x1 - x0); } }
  // slant (round 9): shear the center lines, not the outlines, so the pen keeps its weight and stress like a real oblique.
  // Round letters lean about 10% less than straight ones, a habit of real obliques that keeps bowls from looking tipped over.
  if (p.slant) { const k = Math.tan(p.slant * Math.PI / 180), cy = p.xHeight / 2;
    for (const g of Object.values(G)) for (const st of g.strokes) { const kk = st.closed ? k * 0.9 : k; st.pts = st.pts.map(q => ({ ...q, x: q.x + (q.y - cy) * kk })); } }
  return G;
}
// Learned proportions: stretch each letter's center lines so its ink width matches the median of 596 real sans fonts
// (relative to cap height). 'letters' keeps today's overall width (divides out the median 1.18x); 'real' also matches it.
import { PROPORTIONS as PROP } from './tables.js';
function proportion(G, p) { const glob = p.proportions === 'real' ? 1 : 1 / PROP.globalRatio;
  for (const [ch, g] of Object.entries(G)) { const tw = PROP.width[ch]; if (!tw) continue; const xs = g.strokes.flatMap(st => st.pts.map(q => q.x)); const x0 = Math.min(...xs), x1 = Math.max(...xs), span = x1 - x0; if (span < 1) continue;
    const T = tw * p.capHeight * p.width * glob, k = Math.min(1.8, Math.max(0.6, (T - p.stem) / span)), c = (x0 + x1) / 2;
    for (const st of g.strokes) st.pts = st.pts.map(q => ({ ...q, x: c + (q.x - c) * k })); g.w += (k - 1) * span; } }
// Learned letter fit: per stroke [dx, sx, dy] in cap-height units, fitted so each letter's shape matches the average of
// real sans fonts. dy is only used on strokes that touch no guide line (crossbars, arms), so baseline and heights stay put.
function applyFit(G, FIT, p) { const C = p.capHeight;
  for (const [ch, f] of Object.entries(FIT)) { const g = G[ch]; if (!g) continue;
    g.strokes.forEach((st, i) => { const v = f[i]; if (!v) return; const [dx, sx, dy] = v, xs = st.pts.map(q => q.x), c = (Math.min(...xs) + Math.max(...xs)) / 2;
      st.pts = st.pts.map(q => ({ ...q, x: c + (q.x - c) * sx + dx * C, y: q.y + dy * C })); }); } }
export const touchesGuide = (st, p) => !st.closed && st.pts.some(q => [0, p.xHeight, p.capHeight, -190, Math.round(p.xHeight + (p.capHeight - p.xHeight) * 1.25)].some(gy => Math.abs(q.y - gy) < 2 + p.stem * 0.6)) || !!st.closed;
export function rawSkeletons(p) { return skeletons(p); }
// Bracketed serifs (round 7): small feet at the ends of straight vertical stems, with a curved bracket into the stem.
// Bottom serifs on both sides; top serifs on both sides for capitals, left only (a head serif) for lowercase.
function serifs(ch, g, p) { const out = [], up = /[A-Z\u014a]/.test(ch), sw = thick(p, Math.PI / 2) / 2, slab = !!p.slab2, ASC = Math.round(p.xHeight + (p.capHeight - p.xHeight) * 1.25);
  // slab: rectangular feet whose reach grows slower than the stem (0.45 stem + 18 units past each stem edge) and whose
  // thickness is 0.55 stem, so heavy weights don't crowd. serif: curved bracket, thin foot.
  // round 10: with weightSpace, curved serifs keep a nearly fixed reach as weight grows, as in real serif fonts
  // (foot reach ~ stem^-0.15 on 76 Google Fonts serif families, so reach in stems ~ (stem / 90 at cap 700)^-1.15)
  const wR = p.weightSpace && !slab ? Math.pow(p.stem / (p.capHeight * 90 / 700), -1.15) : 1;
  const Lb = slab ? (p.slabLen ?? 0.45) * Math.min(p.stem, 100) + 0.1 * Math.max(0, p.stem - 100) + 24 /* round 27c: heavy slab feet grow slower so bold slab letters stop touching */ : (p.serifLen ?? 0.55) * p.stem * wR;
  // round 10b: with weightSpace, curved serif feet thin out at heavy weights as in real fonts (foot thickness ~ stem^0.53 on 76 serif families)
  const wT = p.weightSpace && !slab ? Math.pow(p.stem / (p.capHeight * 90 / 700), -0.47) : 1;
  const T = slab ? Math.max(0.55 * p.stem, thick(p, 0)) : Math.max(thick(p, 0) * 0.9 * wT, (p.minHair || 0.25) * p.stem), B = Lb * 0.75, Bh = slab ? 0 : (p.bracket ?? 0.9) * T;
  const foot = (cx, y0, dir, left, right) => { // dir +1 = bottom serif (grows up), -1 = top serif (grows down)
    const Y = v => Math.round(y0 + dir * v), cL = cx - sw, cR = cx + sw, P = [];
    const xl = left ? cL - Lb : cL, xr = right ? cR + Lb : cR;
    P.push({ x: Math.round(xl), y: Y(0), on: true }, { x: Math.round(xr), y: Y(0), on: true });
    if (right && Bh) P.push({ x: Math.round(xr), y: Y(T), on: true }, { x: Math.round(cR + B), y: Y(T), on: true }, { x: Math.round(cR), y: Y(T), on: false }, { x: Math.round(cR), y: Y(T + Bh), on: true });
    else if (right) P.push({ x: Math.round(xr), y: Y(T), on: true }, { x: Math.round(cR), y: Y(T), on: true });
    else P.push({ x: Math.round(cR), y: Y(T + Bh), on: true });
    if (left && Bh) P.push({ x: Math.round(cL), y: Y(T + Bh), on: true }, { x: Math.round(cL), y: Y(T), on: false }, { x: Math.round(cL - B), y: Y(T), on: true }, { x: Math.round(xl), y: Y(T), on: true });
    else if (left) P.push({ x: Math.round(cL), y: Y(T), on: true }, { x: Math.round(xl), y: Y(T), on: true });
    else P.push({ x: Math.round(cL), y: Y(T + Bh), on: true });
    return { closed: true, points: dir > 0 ? P : P.reverse() }; };
  // stem ends: any open stroke whose end runs straight up or down for at least 0.3 x-height (catches n, h, m, u right legs too)
  const run = (pts, e, step) => { let k = e, len = 0; while (k + step >= 0 && k + step < pts.length && Math.abs(pts[k + step].x - pts[e].x) < 1) { len += Math.abs(pts[k + step].y - pts[k].y); k += step; } return len; };
  for (const st of g.strokes) { if (st.closed || st.foot) continue; const n = st.pts.length;
    for (const [e, step] of [[0, 1], [n - 1, -1]]) { const q = st.pts[e]; if (run(st.pts, e, step) < p.xHeight * 0.3) continue; const other = st.pts[e + step]; const isTop = other.y < q.y;
      if (!isTop && (Math.abs(q.y) < 3 || Math.abs(q.y + 190) < 3)) { const bowlSide = p.serifBowl !== false && Math.abs(q.y) < 3; /* round 26: where a bowl joins the stem bottom (b, d, a) the foot goes on the free side only; both sides made a blob with the bowl */ out.push(foot(q.x, q.y, 1, !(bowlSide && ch === 'd') && !(bowlSide && ch === 'a'), !(bowlSide && ch === 'b'))); }
      if (isTop && !/[agq]/.test(ch) && [p.xHeight, p.capHeight, ASC].some(v => Math.abs(q.y - v) < 3)) out.push(foot(q.x, q.y, -1, true, up)); } } // a, g, q: no head serif on the right stem
  return out; }
const area = c => { let s = 0; const P = c.points; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a.x * b.y - b.x * a.y; } return s; };
export function buildGlyphs(p, { removeOverlaps = null, only = null, fallbacks = [] } = {}) {
  const out = {}; const union = !!removeOverlaps, unionCheck = mismatch;
  for (const [ch, g] of Object.entries(skeletons(p))) { if (only && !only.includes(ch)) continue;
    // round 27: symbols with tight loops (@ & ? $ % # 8 etc.) use a lighter pen at heavy weights so counters stay open (real bold fonts draw symbols lighter)
    const pc = p.symbolRelief && /[@&?$%#]/.test(ch) && p.stem > 105 ? { ...p, stem: p.stem * (1 - p.symbolRelief * Math.min(1, (p.stem - 105) / 60)) } : p;
    let contours = g.strokes.flatMap(st => expand(st.pts, st.foot ? { ...pc, nib: 0, contrast: Math.max(pc.contrast, 0.3) } : pc, !!st.closed));
    if ((p.serif2 || p.slab2) && /[A-Za-z0-9\u0138\u014a\u014b\u017f]/.test(ch) && contours.length) { const sg = Math.sign(area(contours[0])) || 1; for (const c of serifs(ch, g, p)) { if (Math.sign(area(c)) !== sg) c.points.reverse(); contours.push(c); } }
    if (union) { const raw = contours;
      // optional 1-unit nudge (tested: makes the union worse, so it is off)
      const nudged = p.nudge !== true ? raw : g.strokes.flatMap((st, k) => expand(st.pts.map(pt => k % 2 ? { x: pt.x + 1, y: pt.y - 1 } : pt), st.foot ? { ...p, nib: 0, contrast: Math.max(p.contrast, 0.3) } : p, !!st.closed));
      contours = removeOverlaps(nudged);
      // safety net: if the union lost or added ink, keep the overlapping strokes for this letter (still a valid font)
      if (p.verify !== false && unionCheck && unionCheck(raw, contours) > 0.01) { contours = raw; fallbacks.push(ch); } }
    let adv = Math.round(g.w * p.spacing + 40); if (p.mono) { const w = Math.round(560 * p.width * p.spacing); contours = contours.map(c => ({ ...c, points: c.points.map(pt => ({ ...pt, x: Math.round(pt.x + (w - adv) / 2) })) })); adv = w; }
    out[ch] = { name: NAMES[ch] || ch, unicodes: [ch.codePointAt(0)], advanceWidth: adv, contours };
  }
  return out;
}
export const BASE = { stem: 90, width: 1, contrast: 0.05, nib: 0, caps: 'butt', square: 2, aperture: 0.3, xHeight: 520, capHeight: 700, spacing: 1, slab: false };
