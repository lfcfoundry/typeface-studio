// ttf-instance.js: make a static TrueType font from a TrueType variable font (glyf + gvar) at one axis location.
// Pure JS, no dependencies. Round 24c prototype (2026.11.07). Handles avar, gvar (shared and private points, intermediate regions),
// inferred (IUP) deltas, composite glyphs, phantom points for advance and side bearing, name/OS2/head/hhea/hmtx rewrite.
// Not handled: GPOS/GDEF variations (kerning stays at the default location), MVAR, CFF outlines.
const rd = (b) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const f2 = v => v / 16384, fx = v => v / 65536;
export function instanceTTF(src, loc, names = {}) {
  const TM = names.timing, _t = () => performance.now(), _t0 = _t();
  const buf = src instanceof Uint8Array ? src : new Uint8Array(src), dv = rd(buf);
  const T = {}; const nt = dv.getUint16(4);
  for (let i = 0; i < nt; i++) { const o = 12 + i * 16, tag = String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3]); T[tag] = { o: dv.getUint32(o + 8), l: dv.getUint32(o + 12) }; }
  const tb = t => buf.subarray(T[t].o, T[t].o + T[t].l), tv = t => rd(tb(t));
  const head = tv('head'), maxp = tv('maxp'), hhea = tv('hhea');
  const upem = head.getUint16(18), locFmt = head.getInt16(50), nG = maxp.getUint16(4), nHM = hhea.getUint16(34);
  // axes and normalized coordinates
  const fv = tv('fvar'), axOff = fv.getUint16(4), nAx = fv.getUint16(8), axSz = fv.getUint16(10), axes = [];
  const tg = (d, o) => String.fromCharCode(d.getUint8(o), d.getUint8(o + 1), d.getUint8(o + 2), d.getUint8(o + 3));
  for (let i = 0; i < nAx; i++) { const o = axOff + i * axSz; axes.push({ tag: tg(fv, o), min: fx(fv.getInt32(o + 4)), def: fx(fv.getInt32(o + 8)), max: fx(fv.getInt32(o + 12)) }); }
  let norm = axes.map(a => { const v = Math.min(a.max, Math.max(a.min, loc[a.tag] ?? a.def)); return v < a.def ? -(a.def - v) / (a.def - a.min) : v > a.def ? (v - a.def) / (a.max - a.def) : 0; });
  if (T.avar) { const av = tv("avar"); let o = 8; norm = norm.map(n => { const cnt = av.getUint16(o); o += 2; const seg = []; for (let k = 0; k < cnt; k++) { seg.push([f2(av.getInt16(o)), f2(av.getInt16(o + 2))]); o += 4; }
    if (cnt < 3) return n; for (let k = 1; k < seg.length; k++) { const [a, b] = seg[k - 1], [c, d] = seg[k]; if (n === c) return d; if (n < c) return a === c ? b : b + (n - a) * (d - b) / (c - a); } return n; }); }
  // hmtx
  const hm = tv('hmtx'), adv = new Array(nG), lsb = new Array(nG);
  for (let g = 0; g < nG; g++) { if (g < nHM) { adv[g] = hm.getUint16(g * 4); lsb[g] = hm.getInt16(g * 4 + 2); } else { adv[g] = adv[nHM - 1]; lsb[g] = hm.getInt16(nHM * 4 + (g - nHM) * 2); } }
  // loca / glyf
  const lo = tv('loca'), glyf = tb('glyf'), gdv = rd(glyf), gOff = g => locFmt ? lo.getUint32(g * 4) : lo.getUint16(g * 2) * 2;
  // gvar
  const gv = tv('gvar'), gvb = tb('gvar'), gAx = gv.getUint16(4), nShared = gv.getUint16(6), shOff = gv.getUint32(8), gCount = gv.getUint16(12), gFlags = gv.getUint16(14), gdOff = gv.getUint32(16);
  const shared = []; for (let i = 0; i < nShared; i++) { const t = []; for (let a = 0; a < gAx; a++) t.push(f2(gv.getInt16(shOff + (i * gAx + a) * 2))); shared.push(t); }
  const gvOffs = g => (gFlags & 1) ? gv.getUint32(20 + g * 4) : gv.getUint16(20 + g * 2) * 2;
  function packedPoints(b, o) { let n = b[o++]; if (n & 0x80) n = ((n & 0x7f) << 8) | b[o++]; if (n === 0) return [null, o]; const pts = []; let last = 0; while (pts.length < n) { const c = b[o++], run = (c & 0x7f) + 1, w = c & 0x80; for (let k = 0; k < run; k++) { let v; if (w) { v = (b[o] << 8) | b[o + 1]; o += 2 } else v = b[o++]; last += v; pts.push(last); } } return [pts, o]; }
  function packedDeltas(b, o, n) { const out = []; while (out.length < n) { const c = b[o++], run = (c & 0x3f) + 1; if (c & 0x80) { for (let k = 0; k < run; k++) out.push(0); } else if (c & 0x40) { for (let k = 0; k < run; k++) { out.push(((b[o] << 24) >> 16) | b[o + 1]); o += 2; } } else { for (let k = 0; k < run; k++) out.push((b[o++] << 24) >> 24); } } return [out.slice(0, n), o]; }
  function scalar(peak, start, end) { let s = 1; for (let a = 0; a < gAx; a++) { const p = peak[a], v = norm[a]; if (p === 0) continue; const lo = start ? start[a] : Math.min(p, 0), hi = end ? end[a] : Math.max(p, 0); if (lo > p || p > hi) continue; if (v === p) continue; if (v <= lo || hi <= v) return 0; s *= v < p ? (v - lo) / (p - lo) : (v - hi) / (p - hi); } return s; }
  function iup(orig, d, ends) { const n = orig.length, out = new Array(n).fill(0); let st = 0; for (const e of ends) { const idx = []; for (let i = st; i <= e; i++) idx.push(i); const refs = idx.filter(i => d[i] != null); if (refs.length === 1) { for (const i of idx) out[i] = d[refs[0]]; } else if (refs.length > 1) {
      for (const r of refs) out[r] = d[r];
      for (let k = 0; k < refs.length; k++) { const a = refs[k], b = refs[(k + 1) % refs.length]; let i = a + 1; const seq = []; while (true) { if (i > e) i = st; if (i === b) break; seq.push(i); i++; if (seq.length > idx.length) break; }
        let c1 = orig[a], c2 = orig[b], d1 = d[a], d2 = d[b]; let lo = c1, dl = d1, hi = c2, dh = d2; if (lo > hi) { [lo, hi] = [hi, lo]; [dl, dh] = [dh, dl]; }
        for (const p of seq) { const c = orig[p]; if (lo === hi) out[p] = dl === dh ? dl : 0; else if (c <= lo) out[p] = dl; else if (c >= hi) out[p] = dh; else out[p] = dl + (c - lo) * (dh - dl) / (hi - lo); } } }
      st = e + 1; } return out; }
  const cache = new Map();
  function glyph(g) {
    if (cache.has(g)) return cache.get(g);
    const o0 = gOff(g), o1 = gOff(g + 1); let G;
    if (o1 === o0) G = { empty: true, xs: [], ys: [], ends: [] }; else {
      const nC = gdv.getInt16(o0); let p = o0 + 10;
      if (nC >= 0) { const ends = []; for (let i = 0; i < nC; i++) { ends.push(gdv.getUint16(p)); p += 2; } const nP = nC ? ends[nC - 1] + 1 : 0; const il = gdv.getUint16(p); p += 2 + il; const flags = []; while (flags.length < nP) { const f = glyf[p++]; flags.push(f); if (f & 8) { let r = glyf[p++]; while (r--) flags.push(f); } }
        const xs = [], ys = []; let v = 0; for (let i = 0; i < nP; i++) { const f = flags[i]; if (f & 2) { const d = glyf[p++]; v += (f & 16) ? d : -d; } else if (!(f & 16)) { v += gdv.getInt16(p); p += 2; } xs.push(v); } v = 0; for (let i = 0; i < nP; i++) { const f = flags[i]; if (f & 4) { const d = glyf[p++]; v += (f & 32) ? d : -d; } else if (!(f & 32)) { v += gdv.getInt16(p); p += 2; } ys.push(v); }
        G = { xs, ys, on: flags.map(f => f & 1), ends, bbox0: [gdv.getInt16(o0 + 2), gdv.getInt16(o0 + 4), gdv.getInt16(o0 + 6), gdv.getInt16(o0 + 8)] };
      } else { const comps = []; let more = true; while (more) { const fl = gdv.getUint16(p), gi = gdv.getUint16(p + 2); p += 4; let a1, a2; if (fl & 1) { a1 = fl & 2 ? gdv.getInt16(p) : gdv.getUint16(p); a2 = fl & 2 ? gdv.getInt16(p + 2) : gdv.getUint16(p + 2); p += 4; } else { a1 = fl & 2 ? gdv.getInt8(p) : glyf[p]; a2 = fl & 2 ? gdv.getInt8(p + 1) : glyf[p + 1]; p += 2; }
          let tr = null; if (fl & 8) { tr = [gdv.getInt16(p) / 16384, 0, 0, gdv.getInt16(p) / 16384]; p += 2; } else if (fl & 0x40) { tr = [gdv.getInt16(p) / 16384, 0, 0, gdv.getInt16(p + 2) / 16384]; p += 4; } else if (fl & 0x80) { tr = [gdv.getInt16(p) / 16384, gdv.getInt16(p + 2) / 16384, gdv.getInt16(p + 4) / 16384, gdv.getInt16(p + 6) / 16384]; p += 8; }
          comps.push({ fl: fl & ~0x20 & ~0x100, gi, a1, a2, tr, raw: tr ? [gdv.getInt16(p - (fl & 8 ? 2 : fl & 0x40 ? 4 : 8))] : null }); more = !!(fl & 0x20); }
        G = { comp: comps, xs: comps.map(c => c.a1), ys: comps.map(c => c.a2), ends: [], bbox0: [gdv.getInt16(o0 + 2), gdv.getInt16(o0 + 4), gdv.getInt16(o0 + 6), gdv.getInt16(o0 + 8)] }; }
    }
    // phantom points and deltas
    const n = G.xs.length; const xmin0 = G.empty ? 0 : G.bbox0[0], pp1 = xmin0 - lsb[g], pp2 = pp1 + adv[g];
    const ox = [...G.xs, pp1, pp2, 0, 0], oy = [...G.ys, 0, 0, 0, 0]; const dx = new Array(n + 4).fill(0), dy = new Array(n + 4).fill(0);
    const gs = gvOffs(g), ge = gvOffs(g + 1);
    if (ge > gs) { const base = gdOff + gs, cnt = gv.getUint16(base), hasShared = !!(cnt & 0x8000), nT = cnt & 0x0fff; let dOff = base + gv.getUint16(base + 2), hp = base + 4;
      let sharedPts = null; if (hasShared) { const [pts, no] = packedPoints(gvb, dOff); sharedPts = pts; dOff = no; }
      for (let t = 0; t < nT; t++) { const size = gv.getUint16(hp), ti = gv.getUint16(hp + 2); hp += 4; let peak, start = null, end = null;
        if (ti & 0x8000) { peak = []; for (let a = 0; a < gAx; a++) { peak.push(f2(gv.getInt16(hp))); hp += 2; } } else peak = shared[ti & 0x0fff];
        if (ti & 0x4000) { start = []; end = []; for (let a = 0; a < gAx; a++) { start.push(f2(gv.getInt16(hp))); hp += 2; } for (let a = 0; a < gAx; a++) { end.push(f2(gv.getInt16(hp))); hp += 2; } }
        let q = dOff; const s = scalar(peak, start, end); let pts = sharedPts;
        if (ti & 0x2000) { const [pp, no] = packedPoints(gvb, q); pts = pp; q = no; }
        if (s !== 0) { const np = pts ? pts.length : n + 4; const [ddx, q2] = packedDeltas(gvb, q, np); const [ddy] = packedDeltas(gvb, q2, np);
          const tx = new Array(n + 4).fill(null), ty = new Array(n + 4).fill(null); for (let k = 0; k < np; k++) { const pi = pts ? pts[k] : k; if (pi < n + 4) { tx[pi] = ddx[k]; ty[pi] = ddy[k]; } }
          let ix, iy; if (G.ends.length) { const m = G.ends[G.ends.length - 1] + 1; ix = iup(ox.slice(0, m), tx.slice(0, m), G.ends); iy = iup(oy.slice(0, m), ty.slice(0, m), G.ends); for (let i = 0; i < m; i++) { dx[i] += ix[i] * s; dy[i] += iy[i] * s; } } else { for (let i = 0; i < n; i++) { dx[i] += (tx[i] ?? 0) * s; dy[i] += (ty[i] ?? 0) * s; } }
          for (let i = n; i < n + 4; i++) { dx[i] += (tx[i] ?? 0) * s; dy[i] += (ty[i] ?? 0) * s; } }
        dOff += size; } }
    const R = v => Math.floor(v + 0.5);
    const xs = G.xs.map((v, i) => R(v + dx[i])), ys = G.ys.map((v, i) => R(v + dy[i]));
    const np1 = pp1 + dx[n], np2 = pp2 + dx[n + 1]; const out = { ...G, xs, ys, advN: R(np2 - np1), pp1N: np1 };
    if (!G.empty && !G.comp) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < xs.length; i++) { const x = xs[i], y = ys[i]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } out.bbox = [x0, y0, x1, y1]; }
    else if (G.comp) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; G.comp.forEach((cp, i) => { const sg = glyph(cp.gi); if (sg.bbox) { const T = cp.tr || [1, 0, 0, 1]; for (const [x, y] of [[sg.bbox[0], sg.bbox[1]], [sg.bbox[2], sg.bbox[1]], [sg.bbox[0], sg.bbox[3]], [sg.bbox[2], sg.bbox[3]]]) { const X = x * T[0] + y * T[2] + xs[i], Y = x * T[1] + y * T[3] + ys[i]; a = Math.min(a, X); b = Math.min(b, Y); c = Math.max(c, X); d = Math.max(d, Y); } } }); out.bbox = a > 1e8 ? [0, 0, 0, 0] : [R(a), R(b), R(c), R(d)]; }
    out.lsbN = out.bbox ? R(out.bbox[0] - np1) : 0; cache.set(g, out); return out; }
  if (TM) TM.setup = _t() - _t0;
  // serialize glyphs
  const parts = [], offs = [0]; let total = 0; const W = (n) => { const a = new Uint8Array(n); return a; };
  const bb = [1e9, 1e9, -1e9, -1e9], advs = [], lsbs = [];
  for (let g = 0; g < nG; g++) { const G = glyph(g); advs.push(G.advN); lsbs.push(G.lsbN); let bytes = new Uint8Array(0);
    if (!G.empty) { const bx = G.bbox; bb[0] = Math.min(bb[0], bx[0]); bb[1] = Math.min(bb[1], bx[1]); bb[2] = Math.max(bb[2], bx[2]); bb[3] = Math.max(bb[3], bx[3]);
      const a = []; const p16 = v => a.push((v >> 8) & 255, v & 255);
      if (G.comp) { p16(-1); bx.forEach(p16); G.comp.forEach((c, i) => { const last = i === G.comp.length - 1; let fl = c.fl; const x = G.xs[i], y = G.ys[i]; const isWords = !(x >= -128 && x < 128 && y >= -128 && y < 128); fl = (fl & ~1) | (isWords ? 1 : 0) | (last ? 0 : 0x20); p16(fl); p16(c.gi); if (isWords) { p16(x); p16(y); } else a.push(x & 255, y & 255);
          if (c.tr) { if (c.fl & 8) p16(Math.round(c.tr[0] * 16384)); else if (c.fl & 0x40) { p16(Math.round(c.tr[0] * 16384)); p16(Math.round(c.tr[3] * 16384)); } else { c.tr.forEach(v => p16(Math.round(v * 16384))); } } }); }
      else { p16(G.ends.length); bx.forEach(p16); G.ends.forEach(p16); p16(0); const fl = [], xb = [], yb = []; let px = 0, py = 0;
        G.xs.forEach((x, i) => { let f = G.on[i] ? 1 : 0; const dX = x - px, dY = G.ys[i] - py; px = x; py = G.ys[i];
          if (dX === 0) f |= 16; else if (Math.abs(dX) < 256) { f |= 2 | (dX > 0 ? 16 : 0); xb.push(Math.abs(dX)); } else { xb.push((dX >> 8) & 255, dX & 255); }
          if (dY === 0) f |= 32; else if (Math.abs(dY) < 256) { f |= 4 | (dY > 0 ? 32 : 0); yb.push(Math.abs(dY)); } else { yb.push((dY >> 8) & 255, dY & 255); } fl.push(f); });
        for (let i = 0; i < fl.length;) { let r = 0; while (i + r + 1 < fl.length && fl[i + r + 1] === fl[i] && r < 255) r++; if (r > 0) { a.push(fl[i] | 8, r); } else a.push(fl[i]); i += r + 1; }
        for (let i = 0; i < xb.length; i++) a.push(xb[i]); for (let i = 0; i < yb.length; i++) a.push(yb[i]); }
      while (a.length % 4) a.push(0); bytes = Uint8Array.from(a); }
    parts.push(bytes); total += bytes.length; offs.push(total); }
  if (TM) TM.glyphs = _t() - _t0 - TM.setup;
  const glyfN = new Uint8Array(total); let po = 0; for (const p of parts) { glyfN.set(p, po); po += p.length; }
  const locaN = new Uint8Array((nG + 1) * 4), lov = rd(locaN); offs.forEach((v, i) => lov.setUint32(i * 4, v));
  const hmN = new Uint8Array(nG * 4), hmv = rd(hmN); for (let g = 0; g < nG; g++) { hmv.setUint16(g * 4, advs[g]); hmv.setInt16(g * 4 + 2, lsbs[g]); }
  // head, hhea, OS/2, name
  const headN = tb('head').slice(), hdv = rd(headN); hdv.setUint32(8, 0); hdv.setInt16(36, bb[0]); hdv.setInt16(38, bb[1]); hdv.setInt16(40, bb[2]); hdv.setInt16(42, bb[3]); hdv.setInt16(50, 1);
  const wght = Math.round(loc.wght ?? 400), italic = !!names.italic || /Italic|Oblique/.test(names.style || ''), bold = /\bBold\b/.test(names.style || ''); /* round 26: bold bit follows the style name, not the weight number */ let mac = hdv.getUint16(44) & ~3; if (bold) mac |= 1; if (italic) mac |= 2; hdv.setUint16(44, mac);
  const hheaN = tb('hhea').slice(), hhv = rd(hheaN); hhv.setUint16(34, nG); let mxa = 0; for (let g = 0; g < nG; g++) if (advs[g] > mxa) mxa = advs[g]; hhv.setUint16(10, mxa); let minL = 1e9, minR = 1e9, maxE = -1e9; for (let g = 0; g < nG; g++) { const G = glyph(g); if (!G.empty) { minL = Math.min(minL, G.lsbN); const rsb = advs[g] - (G.lsbN + G.bbox[2] - G.bbox[0]); minR = Math.min(minR, rsb); maxE = Math.max(maxE, G.lsbN + G.bbox[2] - G.bbox[0]); } } hhv.setInt16(12, minL); hhv.setInt16(14, minR); hhv.setInt16(16, maxE);
  const os2N = tb('OS/2').slice(), ov = rd(os2N); ov.setUint16(4, Math.max(1, Math.min(1000, wght))); const wd = loc.wdth ?? 100; ov.setUint16(6, wd < 56 ? 1 : wd < 69 ? 2 : wd < 81 ? 3 : wd < 94 ? 4 : wd < 106 ? 5 : wd < 119 ? 6 : wd < 144 ? 7 : wd < 175 ? 8 : 9);
  let fs = ov.getUint16(62) & ~(1 | 32 | 64); fs |= (italic ? 1 : 0) | (bold ? 32 : 0) | (!italic && !bold ? 64 : 0); ov.setUint16(62, fs);
  // name table
  const nm = tb('name'), nv = rd(nm), nrec = nv.getUint16(2), strOff = nv.getUint16(4), recs = [];
  for (let i = 0; i < nrec; i++) { const o = 6 + i * 12; recs.push({ pid: nv.getUint16(o), eid: nv.getUint16(o + 2), lid: nv.getUint16(o + 4), id: nv.getUint16(o + 6), len: nv.getUint16(o + 8), off: nv.getUint16(o + 10) }); }
  const dec = r => { const b = nm.subarray(strOff + r.off, strOff + r.off + r.len); if (r.pid === 1) return String.fromCharCode(...b); let s = ''; for (let i = 0; i + 1 < b.length; i += 2) s += String.fromCharCode((b[i] << 8) | b[i + 1]); return s; };
  const family = names.family || 'Instance', style = names.style || 'Regular', full = family + ' ' + style, ps = (family + '-' + style).replace(/[^A-Za-z0-9-]/g, '');
  const NEW = { 1: family, 2: 'Regular', 3: ps + ';instanced', 4: full, 6: ps }; const drop = new Set([16, 17, 21, 22, 25]);
  const outRecs = []; for (const r of recs) { if (drop.has(r.id)) continue; const s = NEW[r.id] !== undefined ? NEW[r.id] : dec(r); outRecs.push({ ...r, s }); }
  const enc = r => { if (r.pid === 1) return Uint8Array.from([...r.s].map(c => c.charCodeAt(0) & 255)); const o = new Uint8Array(r.s.length * 2); for (let i = 0; i < r.s.length; i++) { o[i * 2] = r.s.charCodeAt(i) >> 8; o[i * 2 + 1] = r.s.charCodeAt(i) & 255; } return o; };
  if (style !== 'Regular') { for (const r of outRecs) if (r.id === 2) r.s = /Bold|Italic/.test(style) ? style.replace(/^(?!Bold|Italic).*/, 'Regular') : 'Regular'; const t16 = [...new Set(outRecs.filter(r => r.id === 1).map(r => r.pid + ',' + r.eid + ',' + r.lid))]; for (const k of t16) { const [pid, eid, lid] = k.split(',').map(Number); outRecs.push({ pid, eid, lid, id: 16, s: family }, { pid, eid, lid, id: 17, s: style }); } }
  outRecs.sort((a, b) => a.pid - b.pid || a.eid - b.eid || a.lid - b.lid || a.id - b.id);
  const sb = outRecs.map(enc), sl = sb.reduce((a, b) => a + b.length, 0), nmN = new Uint8Array(6 + outRecs.length * 12 + sl), nw = rd(nmN); nw.setUint16(2, outRecs.length); nw.setUint16(4, 6 + outRecs.length * 12); let so = 0; outRecs.forEach((r, i) => { const o = 6 + i * 12; nw.setUint16(o, r.pid); nw.setUint16(o + 2, r.eid); nw.setUint16(o + 4, r.lid); nw.setUint16(o + 6, r.id); nw.setUint16(o + 8, sb[i].length); nw.setUint16(o + 10, so); nmN.set(sb[i], 6 + outRecs.length * 12 + so); so += sb[i].length; });
  // assemble
  const keep = Object.keys(T).filter(t => !['fvar', 'avar', 'gvar', 'HVAR', 'MVAR', 'STAT', 'cvar', 'VVAR'].includes(t)); const tabs = {};
  for (const t of keep) tabs[t] = tb(t); tabs.glyf = glyfN; tabs.loca = locaN; tabs.hmtx = hmN; tabs.head = headN; tabs.hhea = hheaN; tabs['OS/2'] = os2N; tabs.name = nmN;
  const tags = Object.keys(tabs).sort(); const hdrLen = 12 + tags.length * 16; let size = hdrLen; for (const t of tags) size += (tabs[t].length + 3) & ~3; const outB = new Uint8Array(size), ow = rd(outB);
  ow.setUint32(0, 0x00010000); ow.setUint16(4, tags.length); let es = 1, lg = 0; while (es * 2 <= tags.length) { es *= 2; lg++; } ow.setUint16(6, es * 16); ow.setUint16(8, lg); ow.setUint16(10, tags.length * 16 - es * 16);
  const sum = (b) => { let s = 0; const v = rd(b), n = b.length & ~3; for (let i = 0; i < n; i += 4) s = (s + v.getUint32(i)) >>> 0; const rem = b.length - n; if (rem) { let w = 0; for (let k = 0; k < 4; k++) w = (w << 8) | (k < rem ? b[n + k] : 0); s = (s + (w >>> 0)) >>> 0; } return s; };
  let cur = hdrLen, headOff = 0; tags.forEach((t, i) => { const b = tabs[t], o = 12 + i * 16; for (let k = 0; k < 4; k++) outB[o + k] = t.charCodeAt(k); ow.setUint32(o + 4, sum(b)); ow.setUint32(o + 8, cur); ow.setUint32(o + 12, b.length); outB.set(b, cur); if (t === 'head') headOff = cur; cur += (b.length + 3) & ~3; });
  ow.setUint32(headOff + 8, (0xB1B0AFBA - sum(outB)) >>> 0); if (TM) TM.total = _t() - _t0; return outB;
}
