// Geometry helpers: flatten TrueType quadratic contours, winding test, and a check of each union result against the original overlapping strokes by sampling a grid (nonzero fill).
const D = Math.PI / 180;
export function flatten(c) { const P = c.points, n = P.length, out = []; // TrueType quadratic points -> polyline
  let start = P.findIndex(p => p.on); if (start < 0) { start = 0; }
  const get = i => P[(i + n) % n]; const pts = []; for (let i = 0; i < n; i++) pts.push(get(start + i));
  if (!P.some(p => p.on)) { const m = { x: (P[0].x + P[1].x) / 2, y: (P[0].y + P[1].y) / 2, on: true }; pts.length = 0; pts.push(m); for (let i = 1; i <= n; i++) pts.push(get(i)); }
  let cur = pts[0]; out.push(cur);
  for (let i = 1; i <= pts.length; i++) { const p = pts[i % pts.length];
    if (p.on) { out.push(p); cur = p; continue; }
    const nx = pts[(i + 1) % pts.length]; const end = nx.on ? nx : { x: (p.x + nx.x) / 2, y: (p.y + nx.y) / 2 };
    for (let t = 1; t <= 6; t++) { const s = t / 6, u = 1 - s; out.push({ x: u * u * cur.x + 2 * u * s * p.x + s * s * end.x, y: u * u * cur.y + 2 * u * s * p.y + s * s * end.y }); }
    cur = end; if (nx.on) i++; }
  return out; }
export function winding(polys, x, y) { let w = 0; for (const q of polys) for (let i = 0; i < q.length - 1; i++) { const a = q[i], b = q[i + 1];
  if (a.y <= y) { if (b.y > y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) > 0) w++; } else if (b.y <= y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) < 0) w--; } return w; }
export function mismatch(before, after, G = 16) { const A = before.map(flatten), B = after.map(flatten); const xs = A.flat().map(p => p.x), ys = A.flat().map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); let bad = 0, ink = 0;
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const x = x0 + (x1 - x0) * (i + 0.5) / G, y = y0 + (y1 - y0) * (j + 0.5) / G; const a = winding(A, x, y) !== 0, b = winding(B, x, y) !== 0; if (a || b) ink++; if (a !== b) bad++; }
  return ink ? bad / ink : 0; }
