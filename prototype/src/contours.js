const EPS = 1e-7;
const point = (x, y, id, on = true) => ({ id, x: Math.round(x), y: Math.round(y), on });

export class PathBuilder {
  constructor(id, role, x, y) {
    this.id = id; this.role = role; this.start = { x: Math.round(x), y: Math.round(y) };
    this.segments = []; this.current = this.start;
  }
  line(id, x, y) {
    const to = { x: Math.round(x), y: Math.round(y) };
    this.segments.push({ id, type: 'line', from: { ...this.current }, to }); this.current = to; return this;
  }
  quad(id, cx, cy, x, y) {
    const control = { x: Math.round(cx), y: Math.round(cy) };
    const to = { x: Math.round(x), y: Math.round(y) };
    this.segments.push({ id, type: 'quadratic', from: { ...this.current }, control, to }); this.current = to; return this;
  }
  close() { return this.build(); }
  build() {
    return buildContour(this.id, this.role, this.start, this.segments);
  }
}

function buildContour(id, role, start, segments) {
  const pts = [point(start.x, start.y, `${id}.start`, true)];
  for (const seg of segments) {
    if (seg.type === 'quadratic') pts.push(point(seg.control.x, seg.control.y, `${id}.${seg.id}.control`, false));
    if (Math.hypot(seg.to.x - start.x, seg.to.y - start.y) > EPS) pts.push(point(seg.to.x, seg.to.y, `${id}.${seg.id}.end`, true));
  }
  return { id, role, closed: true, start: { ...start }, segments: structuredClone(segments), points: pts };
}

export function orientContour(contour, role = contour.role) {
  const poly = sampleContour(contour);
  const a = signedArea(poly);
  const wrong = role === 'outer' ? a > 0 : a < 0;
  if (!wrong) return { ...contour, role };
  const segments = [...contour.segments].reverse().map(seg => seg.type === 'quadratic'
    ? { ...seg, from: { ...seg.to }, to: { ...seg.from }, control: { ...seg.control } }
    : { ...seg, from: { ...seg.to }, to: { ...seg.from } });
  let current = { ...contour.start };
  for (const seg of segments) { seg.from = current; current = seg.to; }
  return buildContour(contour.id, role, contour.start, segments);
}

export function polygonContour(id, vertices, role = 'outer') {
  let v = vertices.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }));
  if (v.length > 2 && Math.hypot(v[0].x - v.at(-1).x, v[0].y - v.at(-1).y) < EPS) v = v.slice(0, -1);
  const area = signedArea(v);
  if ((role === 'outer' && area > 0) || (role === 'counter' && area < 0)) v.reverse();
  const b = new PathBuilder(id, role, v[0].x, v[0].y);
  for (let i = 1; i < v.length; i++) b.line(`edge-${i}`, v[i].x, v[i].y);
  return b.close();
}

function signedArea(v) {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i].x * v[(i + 1) % v.length].y - v[(i + 1) % v.length].x * v[i].y;
  return sum / 2;
}

export function rectContour(id, x0, y0, x1, y1, role = 'outer') {
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (y1 < y0) [y0, y1] = [y1, y0];
  return polygonContour(id, [{ x: x0, y: y0 }, { x: x0, y: y1 }, { x: x1, y: y1 }, { x: x1, y: y0 }], role);
}

export function roundedRectContour(id, x0, y0, x1, y1, r, role = 'outer') {
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (y1 < y0) [y0, y1] = [y1, y0];
  r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
  if (r < 1) return rectContour(id, x0, y0, x1, y1, role);
  const b = new PathBuilder(id, role, x0, y0 + r);
  b.line('left', x0, y1 - r).quad('top-left', x0, y1, x0 + r, y1)
    .line('top', x1 - r, y1).quad('top-right', x1, y1, x1, y1 - r)
    .line('right', x1, y0 + r).quad('bottom-right', x1, y0, x1 - r, y0)
    .line('bottom', x0 + r, y0).quad('bottom-left', x0, y0, x0, y0 + r);
  return b.close();
}

export function arcSegments(builder, prefix, cx, cy, rx, ry, start, end) {
  const count = Math.max(1, Math.ceil(Math.abs(end - start) / (Math.PI / 2)));
  const step = (end - start) / count;
  for (let i = 0; i < count; i++) {
    const a = start + i * step, z = a + step, m = (a + z) / 2;
    const factor = 1 / Math.cos((z - a) / 2);
    const controlX = cx + rx * Math.cos(m) * factor;
    const controlY = cy + ry * Math.sin(m) * factor;
    builder.quad(`${prefix}-${i + 1}`, controlX, controlY, cx + rx * Math.cos(z), cy + ry * Math.sin(z));
  }
  return builder;
}

export function ellipseContour(id, cx, cy, rx, ry, role = 'outer', shiftX = 0) {
  const direction = role === 'outer' ? -1 : 1;
  const b = new PathBuilder(id, role, cx + shiftX + rx, cy);
  arcSegments(b, 'arc', cx + shiftX, cy, rx, ry, 0, direction * Math.PI / 2);
  arcSegments(b, 'arc2', cx + shiftX, cy, rx, ry, direction * Math.PI / 2, direction * Math.PI);
  arcSegments(b, 'arc3', cx + shiftX, cy, rx, ry, direction * Math.PI, direction * Math.PI * 1.5);
  arcSegments(b, 'arc4', cx + shiftX, cy, rx, ry, direction * Math.PI * 1.5, direction * Math.PI * 2);
  return b.close();
}

export function ellipseRing(id, cx, cy, rx, ry, strokeX, strokeY, shiftInner = 0, innerScale = 1) {
  const innerRx = Math.max(18, (rx - strokeX) * innerScale), innerRy = Math.max(18, (ry - strokeY) * innerScale);
  return [ellipseContour(`${id}.outer`, cx, cy, rx, ry, 'outer'), ellipseContour(`${id}.counter`, cx, cy, innerRx, innerRy, 'counter', shiftInner)];
}

export function quadraticArcContour(id, role, cx, cy, rx, ry, start, end) {
  const b = new PathBuilder(id, role, cx + rx * Math.cos(start), cy + ry * Math.sin(start));
  arcSegments(b, 'arc', cx, cy, rx, ry, start, end);
  return b;
}

export function sampleContour(contour, resolution = 12) {
  const result = [{ ...contour.start }];
  for (const seg of contour.segments || []) {
    if (seg.type === 'line') result.push({ ...seg.to });
    else for (let i = 1; i <= resolution; i++) result.push(quadratic(seg.from, seg.control, seg.to, i / resolution));
  }
  if (result.length > 1 && Math.hypot(result.at(-1).x - result[0].x, result.at(-1).y - result[0].y) < EPS) result.pop();
  return result;
}

function quadratic(p0, p1, p2, t) {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
}

function extrema(a, b, c) {
  const d = a - 2 * b + c;
  if (Math.abs(d) < EPS) return [];
  const t = (a - b) / d;
  return t > 0 && t < 1 ? [t] : [];
}

export function contourBounds(contours) {
  const xs = [], ys = [];
  for (const c of contours) {
    xs.push(c.start.x); ys.push(c.start.y);
    for (const seg of c.segments) {
      xs.push(seg.from.x, seg.to.x); ys.push(seg.from.y, seg.to.y);
      if (seg.type === 'quadratic') {
        for (const t of extrema(seg.from.x, seg.control.x, seg.to.x)) xs.push(quadratic(seg.from, seg.control, seg.to, t).x);
        for (const t of extrema(seg.from.y, seg.control.y, seg.to.y)) ys.push(quadratic(seg.from, seg.control, seg.to, t).y);
      }
    }
  }
  return xs.length ? { xMin: Math.floor(Math.min(...xs)), yMin: Math.floor(Math.min(...ys)), xMax: Math.ceil(Math.max(...xs)), yMax: Math.ceil(Math.max(...ys)) } : { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
}

function area(points) { return signedArea(points); }
function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / ((b.y - a.y) || EPS) + a.x) inside = !inside;
  }
  return inside;
}
function orient(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
function intersects(a, b, c, d) { return orient(a,b,c) * orient(a,b,d) < 0 && orient(c,d,a) * orient(c,d,b) < 0; }
function selfIntersects(poly) {
  for (let i = 0; i < poly.length; i++) for (let j = i + 2; j < poly.length; j++) {
    if (i === 0 && j === poly.length - 1) continue;
    if (intersects(poly[i], poly[(i + 1) % poly.length], poly[j], poly[(j + 1) % poly.length])) return true;
  }
  return false;
}

export function validateGlyph(glyph) {
  const errors = [];
  if (!Number.isInteger(glyph.advanceWidth) || glyph.advanceWidth < 0) errors.push('Advance width must be a non-negative integer.');
  if (!Array.isArray(glyph.contours)) return [...errors, 'Contours are missing.'];
  const ids = new Set(), sampled = [];
  for (const c of glyph.contours) {
    if (!c.closed || !Array.isArray(c.points) || c.points.length < 4) { errors.push(`${c.id}: contour must be closed and contain usable on/off-curve points.`); continue; }
    if (ids.has(c.id)) errors.push(`Duplicate contour id ${c.id}.`); ids.add(c.id);
    for (const p of c.points) {
      if (ids.has(p.id)) errors.push(`Duplicate point id ${p.id}.`); ids.add(p.id);
      if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || Math.abs(p.x) > 32767 || Math.abs(p.y) > 32767) errors.push(`${p.id}: point must be within TrueType integer bounds.`);
    }
    const poly = sampleContour(c);
    if (poly.length < 3 || Math.abs(area(poly)) < 1) errors.push(`${c.id}: contour has no measurable area.`);
    if (selfIntersects(poly)) errors.push(`${c.id}: contour self-intersects.`);
    if (c.role === 'outer' && area(poly) >= 0) errors.push(`${c.id}: outer contour must wind clockwise in font coordinates.`);
    if (c.role === 'counter' && area(poly) <= 0) errors.push(`${c.id}: counter contour must wind opposite its outer contour.`);
    sampled.push({ contour: c, poly });
  }
  for (const item of sampled.filter(x => x.contour.role === 'counter')) {
    const poly = item.poly;
    const center = poly.reduce((p, x) => ({ x: p.x + x.x / poly.length, y: p.y + x.y / poly.length }), { x: 0, y: 0 });
    if (!sampled.some(x => x.contour.role === 'outer' && pointInPolygon(center, x.poly))) errors.push(`${item.contour.id}: counter is not contained by an outer contour.`);
  }
  if (glyph.rightSideBearing !== undefined && !Number.isFinite(glyph.rightSideBearing)) errors.push('Right side bearing must be finite.');
  return errors;
}

export function fontPoints(contour) {
  return contour.points.map(({ x, y, on }) => ({ x, y, on }));
}
