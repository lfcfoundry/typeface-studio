// Center-line skeletons for printable ASCII letters, digits and common punctuation.
// Every glyph is a few strokes; the pen model in skeleton2.mjs turns them into outlines.
// Coordinates: x already scaled by width u; y in font units. s = half vertical stem, h = half horizontal stroke.
export function alphabet(p, { line: L, arc: A }) {
  const X = p.xHeight, C = p.capHeight, u = p.width, s = p.stem / 2, h = p.stem * (1 - p.contrast) / 2, q = p.square, ap = p.aperture * 120;
  // overshoot targets: Google Fonts sans medians (o 1.9% of x-height, O 1.5% of cap height) plus the measured
  // inward pull of our smooth curves (0.4 to 0.9%), so the finished letters land on the targets
  const oX = p.overshoot ? (0.019 + 0.005 + (p.optical ? 0.006 : 0)) * X : 0, oC = p.overshoot ? (0.015 + 0.004 + (p.optical ? 0.005 : 0)) * C : 0;
  if (p.optical) { /* horizontal half-thickness follows the optical rule used by the pen */ }
  const ASC = Math.round(X + (C - X) * 1.25), DSC = -190, D = Math.PI / 180;
  const cat = (...parts) => parts.reduce((a, b) => a.length ? [...a, ...b.slice(1)] : b, []);
  const st = (pts) => ({ pts }), ring = (pts) => ({ closed: true, pts: pts.slice(0, -1) });
  const bowl = (cx, cy, rx, ry) => ring(A(cx, cy, rx, ry, 0, 360, q));
  const dot = (x, y) => st(L(x, y, x, y + p.stem * 0.95));
  const tail = (pts, xEdge, atEnd) => { const e = atEnd ? pts[pts.length - 1] : pts[0], t = { x: Math.max(e.x, xEdge), y: e.y }; return atEnd ? [...pts, t] : [t, ...pts]; };
  const G = {};
  const g = (ch, w, strokes) => { G[ch] = { w: w * u, strokes }; };
  // shared measures
  const lx = 70 * u + s;                       // left stem center for lowercase
  const xb = X / 2, xr = X / 2 - h + oX;            // lowercase bowl center y and vertical radius
  const cb = C / 2, cr = C / 2 - h + oC;
  // ---------- lowercase ----------
  { const w = 520, cx = 260 * u, rx = 190 * u - s; // o-like letters
    g('o', w, [bowl(cx, xb, rx, xr)]);
    g('b', w + 20, [st(L(lx, 0, lx, ASC)), bowl(cx + 10 * u, xb, rx, xr)]);
    g('d', w + 20, [st(L(w * u + 20 * u - lx, 0, w * u + 20 * u - lx, ASC)), bowl(cx + 10 * u, xb, rx, xr)]);
    g('p', w + 20, [st(L(lx, DSC, lx, X)), bowl(cx + 10 * u, xb, rx, xr)]);
    g('q', w + 20, [st(L(w * u + 20 * u - lx, DSC, w * u + 20 * u - lx, X)), bowl(cx + 10 * u, xb, rx, xr)]);
    const rs = w * u - lx; // right stem of g
    g('g', w + 20, [bowl(cx + 10 * u, xb, rx, xr), st(cat(L(rs + 20 * u, X, rs + 20 * u, 0), A(cx + 10 * u, 0, rs + 20 * u - cx - 10 * u, -DSC - h, 0, -150, q)))]);
  }
  { const w = 520, arcY = X * 0.55, rx = 190 * u - s, rS = 450 * u - s;
    const arch = (x0, x1) => cat(A((x0 + x1) / 2, arcY, (x1 - x0) / 2, X - arcY - h + oX, 180, 0, q), L(x1, arcY, x1, 0));
    g('n', w, [st(L(lx, 0, lx, X)), st(arch(lx, rS))]);
    g('h', w, [st(L(lx, 0, lx, ASC)), st(arch(lx, rS))]);
    g('m', 800, [st(L(lx, 0, lx, X)), st(arch(lx, 400 * u)), st(arch(400 * u, 730 * u - s))]);
    g('r', 360, [st(L(lx, 0, lx, X)), st(A(lx + 150 * u, arcY, 150 * u, X - arcY - h, 180, 70, q))]);
    g('u', w, [st(L(rS, 0, rS, X)), st(cat(L(lx, X, lx, X - arcY), A((lx + rS) / 2, X - arcY, (rS - lx) / 2, X - arcY - h + oX, 180, 360, q)))]);
  }
  { const cx = 250 * u, rx = 200 * u - s, edge = cx + rx * Math.cos(40 * D);
    let c = A(cx, xb, rx, xr, 40 + ap, 320 - ap, q); c = tail(tail(c, edge, false), edge, true); g('c', 480, [st(c)]);
    g('e', 500, [st(cat(L(70 * u + s, X * 0.52, 440 * u - s, X * 0.52), tail(A(255 * u, xb, 185 * u - s, xr, 0, 320 - ap, q), 255 * u + (185 * u - s) * Math.cos(40 * D), true)))]);
    // double-storey a: right stem, top hook, lower bowl
    const rs = 430 * u - s;
    g('a', 500, [st(cat(A(250 * u, X * 0.66, rs - 250 * u, X * 0.34 - h, 145 - ap * 0.5, 0, q), L(rs, X * 0.66, rs, 0))), bowl(245 * u, X * 0.27, rs - 245 * u, X * 0.27 - h * 0.6)]);
    // s: upper arc then lower arc
    const scx = 230 * u, srx = 160 * u - s * 0.8, sry = X / 4 - h * 0.5 + oX / 2;
    g('s', 460, [st(cat(A(scx, X - sry - h + oX, srx, sry, 25 + ap * 0.4, 270, q), A(scx, sry + h - oX, srx, sry, 90, -155 - ap * 0.4, q)))]);
  }
  g('i', 220, [st(L(110 * u, 0, 110 * u, X)), dot(110 * u, X + 90)]);
  g('j', 240, [st(cat(L(150 * u, X, 150 * u, DSC * 0.4), A(60 * u, DSC * 0.4, 90 * u, -DSC * 0.6 - h, 0, -120, q))), dot(150 * u, X + 90)]);
  g('l', 220, [st(L(110 * u, 0, 110 * u, ASC))]);
  g('t', 340, [st(cat(L(120 * u, X * 1.3, 120 * u, X * 0.25), A(240 * u, X * 0.25, 120 * u, X * 0.25 - h, 180, 300, q))), st(L(30 * u, X - h, 300 * u, X - h))]);
  g('f', 320, [st(cat(L(120 * u, 0, 120 * u, ASC - 130), A(240 * u, ASC - 130, 120 * u, 130 - h, 180, 40, q))), st(L(30 * u, X - h, 280 * u, X - h))]);
  g('k', 480, [st(L(lx, 0, lx, ASC)), st(L(lx, X * 0.35, 430 * u, X)), st(L(lx + 80 * u, X * 0.48, 450 * u, 0))]);
  g('v', 520, [st(L(40 * u + s, X, 260 * u, 0)), st(L(260 * u, 0, 480 * u - s, X))]);
  g('w', 760, [st(L(40 * u + s, X, 200 * u, 0)), st(L(200 * u, 0, 380 * u, X)), st(L(380 * u, X, 560 * u, 0)), st(L(560 * u, 0, 720 * u - s, X))]);
  g('x', 500, [st(L(50 * u + s, X, 450 * u - s, 0)), st(L(450 * u - s, X, 50 * u + s, 0))]);
  g('y', 520, [st(L(40 * u + s, X, 260 * u, 0)), st(L(480 * u - s, X, 160 * u, DSC))]);
  g('z', 480, [st(L(60 * u, X - h, 420 * u, X - h)), st(L(410 * u - s, X - h, 70 * u + s, h)), st(L(60 * u, h, 430 * u, h))]);
  // ---------- capitals ----------
  const cl = 80 * u + s;
  g('A', 600, [st(L(40 * u + s, 0, 300 * u, C)), st(L(300 * u, C, 560 * u - s, 0)), st(L(150 * u, C * 0.3, 450 * u, C * 0.3))]);
  { const bw = 300 * u; const half = (y0, y1, extra) => st(cat(L(cl, y1 - h, cl + bw - (y1 - y0) / 2 * 0.6 + extra, y1 - h), A(cl + bw - (y1 - y0) / 2 * 0.6 + extra, (y0 + y1) / 2, (y1 - y0) / 2 * 0.6 + 40 * u - s, (y1 - y0) / 2 - h, 90, -90, q), L(cl + bw - (y1 - y0) / 2 * 0.6 + extra, y0 + h, cl, y0 + h)));
    g('B', 560, [st(L(cl, 0, cl, C)), half(C * 0.53, C, -20 * u), half(0, C * 0.53, 20 * u)]);
    g('P', 540, [st(L(cl, 0, cl, C)), half(C * 0.45, C, 0)]);
    g('R', 560, [st(L(cl, 0, cl, C)), half(C * 0.45, C, 0), st(L(cl + 200 * u, C * 0.45, 500 * u - s, 0))]);
    g('D', 620, [st(L(cl, 0, cl, C)), st(cat(L(cl, C - h, 300 * u, C - h), A(300 * u, cb, 270 * u - s, cr, 90, -90, q), L(300 * u, h, cl, h)))]); }
  { const cx = 330 * u, rx = 280 * u - s, edge = cx + rx * Math.cos(40 * D);
    let c = A(cx, cb, rx, cr, 40 + ap * 0.7, 320 - ap * 0.7, q); c = tail(tail(c, edge, false), edge, true); g('C', 640, [st(c)]);
    g('G', 660, [st(tail(A(cx, cb, rx, cr, 40 + ap * 0.7, 360, q), edge, false)), st(L(cx + 60 * u, C * 0.45, cx + rx, C * 0.45))]);
    g('O', 680, [bowl(340 * u, cb, 280 * u - s, cr)]);
    g('Q', 680, [bowl(340 * u, cb, 280 * u - s, cr), st(L(380 * u, C * 0.25, 600 * u - s, -60))]); }
  g('E', 500, [st(L(cl, 0, cl, C)), st(L(cl, C - h, 440 * u, C - h)), st(L(cl, C * 0.52, 400 * u, C * 0.52)), st(L(cl, h, 450 * u, h))]);
  g('F', 480, [st(L(cl, 0, cl, C)), st(L(cl, C - h, 430 * u, C - h)), st(L(cl, C * 0.5, 390 * u, C * 0.5))]);
  g('H', 600, [st(L(cl, 0, cl, C)), st(L(520 * u - s, 0, 520 * u - s, C)), st(L(cl, C * 0.5, 520 * u - s, C * 0.5))]);
  g('I', 240, [st(L(120 * u, 0, 120 * u, C))]);
  g('J', 420, [st(cat(L(330 * u - s, C, 330 * u - s, C * 0.3), A(190 * u, C * 0.3, 140 * u - s, C * 0.3 - h, 0, -170, q)))]);
  g('K', 560, [st(L(cl, 0, cl, C)), st(L(cl, C * 0.38, 500 * u, C)), st(L(cl + 120 * u, C * 0.5, 520 * u - s, 0))]);
  g('L', 460, [st(L(cl, 0, cl, C)), st(L(cl, h, 430 * u, h))]);
  g('M', 740, [st(L(cl, 0, cl, C)), st(L(cl, C, 370 * u, C * 0.15)), st(L(370 * u, C * 0.15, 660 * u - s, C)), st(L(660 * u - s, C, 660 * u - s, 0))]);
  g('N', 620, [st(L(cl, 0, cl, C)), st(L(cl, C, 540 * u - s, 0)), st(L(540 * u - s, 0, 540 * u - s, C))]);
  g('S', 540, [st(cat(A(270 * u, C - C / 4, 200 * u - s, C / 4 - h * 0.5, 25 + ap * 0.4, 270, q), A(270 * u, C / 4, 210 * u - s, C / 4 - h * 0.5, 90, -155 - ap * 0.4, q)))]);
  g('T', 540, [st(L(40 * u, C - h, 500 * u, C - h)), st(L(270 * u, 0, 270 * u, C - h))]);
  g('U', 620, [st(cat(L(cl, C, cl, C * 0.38), A(310 * u, C * 0.38, 310 * u - cl, C * 0.38 - h + oC, 180, 360, q), L(620 * u - cl, C * 0.38, 620 * u - cl, C)))]);
  g('V', 600, [st(L(40 * u + s, C, 300 * u, 0)), st(L(300 * u, 0, 560 * u - s, C))]);
  g('W', 860, [st(L(40 * u + s, C, 230 * u, 0)), st(L(230 * u, 0, 430 * u, C)), st(L(430 * u, C, 630 * u, 0)), st(L(630 * u, 0, 820 * u - s, C))]);
  g('X', 580, [st(L(50 * u + s, C, 530 * u - s, 0)), st(L(530 * u - s, C, 50 * u + s, 0))]);
  g('Y', 580, [st(L(40 * u + s, C, 290 * u, C * 0.45)), st(L(540 * u - s, C, 290 * u, C * 0.45)), st(L(290 * u, C * 0.45, 290 * u, 0))]);
  g('Z', 560, [st(L(60 * u, C - h, 500 * u, C - h)), st(L(490 * u - s, C - h, 70 * u + s, h)), st(L(60 * u, h, 510 * u, h))]);
  // ---------- digits (cap height, fixed width so figures line up) ----------
  const fw = 560, fcx = 280 * u, frx = 210 * u - s;
  g('0', fw, [bowl(fcx, cb, frx, cr)]);
  g('1', fw, [st(L(320 * u, 0, 320 * u, C)), st(L(320 * u, C, 170 * u, C - 140))]);
  g('2', fw, [st(cat(A(fcx, C * 0.7, frx, C * 0.3 - h, 160, -10, q), L(fcx + frx * 0.95, C * 0.6, 90 * u + s, h))), st(L(80 * u, h, 490 * u, h))]);
  g('3', fw, [st(cat(A(fcx, C * 0.74, frx * 0.9, C * 0.26 - h, 150, -90, q), A(fcx, C * 0.27, frx, C * 0.27 - h, 90, -150, q)))]);
  g('4', fw, [st(L(400 * u, 0, 400 * u, C)), st(L(400 * u, C, 70 * u + s, C * 0.3)), st(L(70 * u, C * 0.3, 500 * u, C * 0.3))]);
  g('5', fw, [st(L(460 * u, C - h, 140 * u, C - h)), st(L(140 * u, C - h, 120 * u, C * 0.55)), st(A(fcx, C * 0.32, frx, C * 0.32 - h, 140, -150, q))]);
  g('6', fw, [bowl(fcx, C * 0.32, frx, C * 0.32 - h), st(A(fcx + 20 * u, C * 0.5, frx + 20 * u, C * 0.5 - h, 60, 180, q))]);
  g('7', fw, [st(L(80 * u, C - h, 490 * u, C - h)), st(L(490 * u - s, C - h, 200 * u, 0))]);
  g('8', fw, [bowl(fcx, C * 0.76, frx * 0.85, C * 0.24 - h * 0.6), bowl(fcx, C * 0.28, frx, C * 0.28 - h)]);
  g('9', fw, [bowl(fcx, C * 0.68, frx, C * 0.32 - h), st(A(fcx - 20 * u, C * 0.5, frx + 20 * u, C * 0.5 - h, 0, -120, q))]);
  // ---------- punctuation ----------
  g('.', 240, [dot(120 * u, 0)]);
  g(',', 240, [st(L(130 * u, p.stem * 0.95, 90 * u, -120))]);
  g(':', 240, [dot(120 * u, 0), dot(120 * u, X - p.stem * 0.95)]);
  g(';', 240, [st(L(130 * u, p.stem * 0.95, 90 * u, -120)), dot(120 * u, X - p.stem * 0.95)]);
  g('!', 260, [st(L(130 * u, C, 130 * u, C * 0.28)), dot(130 * u, 0)]);
  g('?', 480, [st(cat(A(240 * u, C * 0.72, 170 * u - s, C * 0.28 - h, 160, -60, q), L(250 * u, C * 0.45, 240 * u, C * 0.28))), dot(240 * u, 0)]);
  g('-', 360, [st(L(60 * u, X * 0.5, 300 * u, X * 0.5))]);
  g("'", 200, [st(L(100 * u, C, 100 * u, C * 0.7))]);
  g('"', 340, [st(L(100 * u, C, 100 * u, C * 0.7)), st(L(240 * u, C, 240 * u, C * 0.7))]);
  g('/', 400, [st(L(60 * u + s, DSC * 0.3, 340 * u - s, C))]);
  g('(', 300, [st(A(260 * u, cb, 160 * u - s, C * 0.62, 120, 240, q))]);
  g(')', 300, [st(A(40 * u, cb, 160 * u - s, C * 0.62, 60, -60, q))]);
  return G;
}
export const NAMES = { '.': 'period', ',': 'comma', ':': 'colon', ';': 'semicolon', '!': 'exclam', '?': 'question', '-': 'hyphen', "'": 'quotesingle', '"': 'quotedbl', '/': 'slash', '(': 'parenleft', ')': 'parenright',
  0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine' };
