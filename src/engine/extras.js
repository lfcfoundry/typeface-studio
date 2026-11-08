// Extra characters for the drawn font (round 27): accented letters composed from the drawn base letter plus a mark,
// ligature-like letters (ae, oe, ss, thorn, eth, o-slash, l-stroke), typographic punctuation (curly quotes, dashes, bullet, ellipsis, euro, section sign),
// and Latin-1 symbols. Plain ES module, no imports. addExtras(glyphs, kerning, p) adds glyphs in place and copies base-letter kerning to the new letters.
// Marks are simple polygons sized from the stem and sheared with the slant. Glyph names are uniXXXX.
export function addExtras(gl, kerning, p) {
  const box = ch => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const k of gl[ch].contours) for (const q of k.points) { a = Math.min(a, q.x); b = Math.max(b, q.x); c = Math.min(c, q.y); d = Math.max(d, q.y); } return { x0: a, x1: b, y0: c, y1: d }; };
  const area = pts => pts.reduce((s, q, i) => { const r = pts[(i + 1) % pts.length]; return s + (q.x * r.y - r.x * q.y); }, 0) / 2;
  const ref = gl['H'].contours[0].points; const outerCCW = area(ref) > 0;
  const orient = (pts, outer = true) => (area(pts) > 0) === (outerCCW === outer) ? pts : [...pts].reverse();
  const poly = pts => ({ closed: true, points: pts.map(([x, y]) => ({ x, y, on: true })) });
  const stem = Math.round(p.stem * (p.optical ? 1.035 : 1));
  const xh = box('x').y1, cap = box('H').y1, W = ch => gl[ch].advanceWidth;
  const gap = Math.round(stem * 0.55);
  const bbox0 = ch => box(ch);
function marks(kind, cx, top, bot, b) { // returns contours centred at cx above 'top'
  const mst = stem > 110 ? 110 + (stem - 110) * 0.35 : stem; /* bold marks grow slower than the stem */ const t = mst*0.95, s = mst*1.6, y0 = top + gap;
  const sq = (x,y,w,h) => poly(orient([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]).map(p=>Array.isArray(p)?p:[p.x,p.y]));
  const P = pts => poly(orient(pts.map(p=>({x:p[0],y:p[1]})),true).map(p=>[p.x,p.y]));
  switch(kind){
   case 'acute': return [P([[cx-t*.2,y0],[cx+t*.8,y0],[cx+s*.9+t*.8,y0+s*1.1],[cx+s*.9-t*.3,y0+s*1.1]])];
   case 'grave': return [P([[cx-t*.8,y0],[cx+t*.2,y0],[cx-s*.9+t*.3,y0+s*1.1],[cx-s*.9-t*.8,y0+s*1.1]])];
   case 'circ': return [P([[cx-s*.9,y0],[cx-s*.9+t,y0],[cx,y0+s*.8],[cx+s*.9-t,y0],[cx+s*.9,y0],[cx,y0+s*1.1+t*.2]])];
   case 'diaer': return [P([[cx-s*.9,y0],[cx-s*.9+t,y0],[cx-s*.9+t,y0+t],[cx-s*.9,y0+t]]),P([[cx+s*.9-t,y0],[cx+s*.9,y0],[cx+s*.9,y0+t],[cx+s*.9-t,y0+t]])];
   case 'tilde': { const a=[[cx-s*1.1,y0+t*.2],[cx-s*.6,y0+t*1.4],[cx,y0+t*.9],[cx+s*.6,y0+t*.1],[cx+s*1.1,y0+t*1.3],[cx+s*1.1,y0+t*2.3],[cx+s*.6,y0+t*1.1],[cx,y0+t*1.9],[cx-s*.6,y0+t*2.6],[cx-s*1.1,y0+t*1.4]]; return [P(a)]; }
   case 'ring': { const R=s*.85,r=R-t*.9,n=12,o=[],i=[];for(let k=0;k<n;k++){const a=2*Math.PI*k/n;o.push([cx+R*Math.cos(a),y0+R+R*Math.sin(a)]);i.push([cx+r*Math.cos(a),y0+R+r*Math.sin(a)])}return [poly(orient(o.map(p=>({x:p[0],y:p[1]})),true).map(p=>[p.x,p.y])),poly(orient(i.map(p=>({x:p[0],y:p[1]})),false).map(p=>[p.x,p.y]))]; }
   case 'caron': return [P([[cx-s*.9,y0+s*1.1],[cx-s*.9+t,y0+s*1.1],[cx,y0+s*.3],[cx+s*.9-t,y0+s*1.1],[cx+s*.9,y0+s*1.1],[cx,y0-t*.2]])];
   case 'breve': { const R=s*.9,o=[],i=[];for(let k=0;k<=8;k++){const a=Math.PI*(1+k/8);o.push([cx+R*Math.cos(a),y0+s*1.0+R*.9*Math.sin(a)+R*.9]);}for(let k=8;k>=0;k--){const a=Math.PI*(1+k/8);i.push([cx+(R-t)*Math.cos(a),y0+s*1.0+(R-t)*.9*Math.sin(a)+R*.9]);}return [P([...o,...i])]; }
   case 'macron': return [P([[cx-s*.8,y0+t*.3],[cx+s*.8,y0+t*.3],[cx+s*.8,y0+t*1.3],[cx-s*.8,y0+t*1.3]])];
   case 'dacute': return [...marks('acute', cx - s*.55, top, bot, b), ...marks('acute', cx + s*.55, top, bot, b)];
   case 'dot': return [P([[cx-t*.55,y0],[cx+t*.55,y0],[cx+t*.55,y0+t*1.1],[cx-t*.55,y0+t*1.1]])];
   case 'ogonek': case 'cedilla': { const c0 = bbox0(','), k = kind === 'ogonek' ? 0.82 : 0.8; const cx0 = kind === 'ogonek' ? b.x1 - stem * 0.9 : cx; return gl[','].contours.map(c => ({ ...c, points: c.points.map(q => ({ ...q, x: Math.round(cx0 + (q.x - (c0.x0 + c0.x1) / 2) * k), y: Math.round(bot + stem * 0.5 - (c0.y1 - q.y) * k) })) })); }

  }}


  const out = {};
  const cp = c => ({ ...c, points: c.points.map(q => ({ ...q })) });
  const T = (c, dx = 0, dy = 0) => ({ ...c, points: c.points.map(q => ({ ...q, x: q.x + dx, y: q.y + dy })) });
  const XF = (c, f) => ({ ...c, points: c.points.map(q => { const [x, y] = f(q.x, q.y); return { ...q, x: Math.round(x), y: Math.round(y) }; }) });
  const bbox = cs => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const k of cs) for (const q of k.points) { a = Math.min(a, q.x); b = Math.max(b, q.x); c = Math.min(c, q.y); d = Math.max(d, q.y); } return { x0: a, x1: b, y0: c, y1: d }; };
  const scaleAbout = (cs, cx, cy, k, nx, ny) => cs.map(c => XF(c, (x, y) => [nx + (x - cx) * k, ny + (y - cy) * k]));
  const rot = (cs, ang) => { const b = bbox(cs), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, co = Math.cos(ang), si = Math.sin(ang); return cs.map(c => XF(c, (x, y) => [cx + (x - cx) * co - (y - cy) * si, cy + (x - cx) * si + (y - cy) * co])); };
  const shear = k => (x, y) => [x + (y - xh / 2) * k, y];
  const sk = p.slant ? Math.tan(p.slant * Math.PI / 180) : 0;
const dotlessI = () => { const cs = gl['i'].contours; let best = cs[0], by = 1e9; for (const c of cs) { const m = Math.min(...c.points.map(p => p.y)); if (m < by - 1) { by = m; best = c } } return best; };
let BASEOF = { 'à':['a','grave'],'á':['a','acute'],'â':['a','circ'],'ã':['a','tilde'],'ä':['a','diaer'],'å':['a','ring'],'ç':['c','cedilla'],'è':['e','grave'],'é':['e','acute'],'ê':['e','circ'],'ë':['e','diaer'],'ì':['ı','grave'],'í':['ı','acute'],'î':['ı','circ'],'ï':['ı','diaer'],'ñ':['n','tilde'],'ò':['o','grave'],'ó':['o','acute'],'ô':['o','circ'],'õ':['o','tilde'],'ö':['o','diaer'],'ù':['u','grave'],'ú':['u','acute'],'û':['u','circ'],'ü':['u','diaer'],'ý':['y','acute'],'ÿ':['y','diaer'],
 'À':['A','grave','cap'],'Á':['A','acute','cap'],'Â':['A','circ','cap'],'Ã':['A','tilde','cap'],'Ä':['A','diaer','cap'],'Å':['A','ring','cap'],'Ç':['C','cedilla','cap'],'È':['E','grave','cap'],'É':['E','acute','cap'],'Ê':['E','circ','cap'],'Ë':['E','diaer','cap'],'Ì':['I','grave','cap'],'Í':['I','acute','cap'],'Î':['I','circ','cap'],'Ï':['I','diaer','cap'],'Ñ':['N','tilde','cap'],'Ò':['O','grave','cap'],'Ó':['O','acute','cap'],'Ô':['O','circ','cap'],'Õ':['O','tilde','cap'],'Ö':['O','diaer','cap'],'Ù':['U','grave','cap'],'Ú':['U','acute','cap'],'Û':['U','circ','cap'],'Ü':['U','diaer','cap'],'Ý':['Y','acute','cap'],
 'ą':['a','ogonek'],'ć':['c','acute'],'ę':['e','ogonek'],'ń':['n','acute'],'ś':['s','acute'],'ź':['z','acute'],'ż':['z','dot'],'ğ':['g','breve'],'š':['s','caron'],'ž':['z','caron'],'č':['c','caron'],'ř':['r','caron'],'ě':['e','caron'],'ů':['u','ring'],'ş':['s','cedilla'],'Ş':['S','cedilla','cap'],'Š':['S','caron','cap'],'Ž':['Z','caron','cap'] };
  gl['\u0131'] = { ...gl['i'], contours: [cp(dotlessI())] };
  const add = (ch, adv, contours) => { if (contours.length) { const bb = bbox(contours), left = Math.min(0, bb.x0), right = Math.max(adv, bb.x1); if (left < 0 || right > adv) { contours = contours.map(c => T(c, -left)); adv = right - left; } } out[ch] = { name: 'uni' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'), unicodes: [ch.codePointAt(0)], advanceWidth: Math.round(adv), contours }; };
  for (const [ch, [base, kind, c]] of Object.entries(BASEOF)) { const b = box(base); const cx = (b.x0 + b.x1) / 2; const top = c ? b.y1 + stem * 0.45 : Math.max(b.y1, xh); const ms = marks(kind, cx, top, b.y0, b).map(m => sk ? XF(m, shear(sk)) : m); add(ch, W(base), [...gl[base].contours.map(cp), ...ms]); }

  const PS = pts => { const c = poly(orient(pts.map(([x, y]) => ({ x, y })), true).map(q => [q.x, q.y])); return sk ? XF(c, shear(sk)) : c; };
  const bar = (x0, x1, y, h) => PS([[x0, y], [x1, y], [x1, y + h], [x0, y + h]]);
  const slash = b => PS([[b.x0 - stem * .3, b.y0 + (b.y1 - b.y0) * .12], [b.x0 - stem * .3 + stem * .9, b.y0 + (b.y1 - b.y0) * .12], [b.x1 + stem * .3, b.y1 - (b.y1 - b.y0) * .12], [b.x1 + stem * .3 - stem * .9, b.y1 - (b.y1 - b.y0) * .12]]);
  const C = (ch) => gl[ch].contours.map(cp);

  // round 27b: rest of Latin Extended-A (all are base letter + mark, or base + stroke/tick)
  { const A2 = {}; const m = (list, kind, cap) => { for (const [ch, base] of list) A2[ch] = cap ? [base, kind, 'cap'] : [base, kind]; };
    m([['\u0101','a'],['\u0113','e'],['\u012b','\u0131'],['\u014d','o'],['\u016b','u']], 'macron'); m([['\u0100','A'],['\u0112','E'],['\u012a','I'],['\u014c','O'],['\u016a','U']], 'macron', 1);
    m([['\u0103','a'],['\u0115','e'],['\u012d','\u0131'],['\u014f','o'],['\u016d','u']], 'breve'); m([['\u0102','A'],['\u0114','E'],['\u012c','I'],['\u014e','O'],['\u016c','U'],['\u011e','G']], 'breve', 1);
    m([['\u0109','c'],['\u011d','g'],['\u0125','h'],['\u0135','j'],['\u015d','s'],['\u0175','w'],['\u0177','y']], 'circ'); m([['\u0108','C'],['\u011c','G'],['\u0124','H'],['\u0134','J'],['\u015c','S'],['\u0174','W'],['\u0176','Y']], 'circ', 1);
    m([['\u010b','c'],['\u0117','e'],['\u0121','g']], 'dot'); m([['\u010a','C'],['\u0116','E'],['\u0120','G'],['\u0130','I'],['\u017b','Z']], 'dot', 1);
    m([['\u0129','\u0131']], 'tilde'); m([['\u0128','I']], 'tilde', 1); m([['\u0165','t'],['\u010f','d']], 'caron');
    m([['\u013a','l'],['\u0155','r'],['\u0143','N']], 'acute'); A2['\u0139'] = ['L','acute','cap']; A2['\u0154'] = ['R','acute','cap']; A2['\u0143'] = ['N','acute','cap'];
    m([['\u0148','n']], 'caron'); A2['\u0147'] = ['N','caron','cap']; A2['\u0158'] = ['R','caron','cap']; A2['\u010e'] = ['D','caron','cap']; A2['\u0164'] = ['T','caron','cap']; A2['\u011a'] = ['E','caron','cap']; A2['\u010c'] = ['C','caron','cap'];
    m([['\u0151','o'],['\u0171','u']], 'dacute'); m([['\u0150','O'],['\u0170','U']], 'dacute', 1);
    m([['\u012f','i'],['\u0173','u']], 'ogonek'); m([['\u0104','A'],['\u0118','E'],['\u012e','I'],['\u0172','U']], 'ogonek'); A2['\u0104'] = ['A','ogonek']; A2['\u0118'] = ['E','ogonek']; A2['\u012e'] = ['I','ogonek']; A2['\u0172'] = ['U','ogonek'];
    m([['\u0123','g'],['\u0137','k'],['\u013c','l'],['\u0146','n'],['\u0157','r'],['\u0163','t']], 'cedilla'); m([['\u0122','G'],['\u0136','K'],['\u013b','L'],['\u0145','N'],['\u0156','R'],['\u0162','T']], 'cedilla');
    m([['\u0107','c'],['\u0144','n'],['\u015b','s'],['\u017a','z']], 'acute');
    A2['\u0106'] = ['C','acute','cap']; A2['\u015a'] = ['S','acute','cap']; A2['\u0179'] = ['Z','acute','cap']; A2['\u016e'] = ['U','ring','cap']; A2['\u0178'] = ['Y','diaer','cap']; A2['\u0168'] = ['U','tilde','cap']; A2['\u0169'] = ['u','tilde'];
    for (const [ch, [base, kind, c]] of Object.entries(A2)) { if (out[ch]) continue; if (!gl[base]) continue; const b = box(base); const cx = (b.x0 + b.x1) / 2; const top = c ? b.y1 + stem * 0.45 : Math.max(b.y1, xh); const ms = marks(kind, cx, top, b.y0, b).map(mm => sk ? XF(mm, shear(sk)) : mm); add(ch, W(base), [...gl[base].contours.map(cp), ...ms]); }
    BASEOF = { ...BASEOF, ...A2 }; }
  // letters with a stroke or joined letters
  add('ø', W('o'), [...C('o'), slash(box('o'))]); add('Ø', W('O'), [...C('O'), slash(box('O'))]);
  { const b = box('l'), y0 = b.y0 + (b.y1 - b.y0) * .42, y1 = b.y0 + (b.y1 - b.y0) * .62; add('ł', W('l') + stem * .6, [...C('l'), PS([[b.x0 - stem * .9, y0], [b.x0 - stem * .9 + stem * .8, y0], [b.x1 + stem * .9, y1], [b.x1 + stem * .9 - stem * .8, y1]])]);
    const L = box('L'); add('Ł', W('L'), [...C('L'), PS([[L.x0 - stem * .2, L.y0 + (L.y1 - L.y0) * .45], [L.x0 - stem * .2 + stem * .8, L.y0 + (L.y1 - L.y0) * .45], [L.x0 + stem * 3.2, L.y0 + (L.y1 - L.y0) * .65], [L.x0 + stem * 3.2 - stem * .8, L.y0 + (L.y1 - L.y0) * .65]])]); }
  { const pb = box('p'), asc = box('l').y1; add('þ', W('p'), [...C('p'), bar(pb.x0, pb.x0 + stem, pb.y1 - 2, asc - pb.y1 + 2)]); }
  { const D = box('D'), d = D.y0 + (D.y1 - D.y0) / 2 - stem * .25; add('Ð', W('D') + stem * .6, [...C('D').map(c => T(c, stem * .6)), bar(D.x0 - stem * .3, D.x0 + stem * 2.1, d, stem * .55)]); }
  { const o = box('o'), asc = box('l').y1; add('ð', W('o'), [...C('o'), bar(o.x1 - stem, o.x1, o.y1 - 2, asc - o.y1 - stem * .8), bar(o.x1 - stem * 2.6, o.x1 + stem * .3, asc - stem * 1.25, stem * .55)]); }
  { const PB = box('P'), dd = (PB.y1 - PB.y0) * .14; add('Þ', W('P'), [...C('P').map(c => T(c, 0, -dd)), bar(PB.x0, PB.x0 + stem, PB.y0, PB.y1 - PB.y0)]); }
  { const ov = stem * .9, a = gl['a'], e = gl['e'], A = gl['O'], E = gl['E'], AA = gl['A'];
    add('æ', a.advanceWidth - ov + e.advanceWidth, [...C('a'), ...C('e').map(c => T(c, a.advanceWidth - ov))]);
    add('œ', gl['o'].advanceWidth - ov + e.advanceWidth, [...C('o'), ...C('e').map(c => T(c, gl['o'].advanceWidth - ov))]);
    add('Œ', A.advanceWidth - ov * 1.5 + E.advanceWidth, [...C('O'), ...C('E').map(c => T(c, A.advanceWidth - ov * 1.5))]);
    add('Æ', AA.advanceWidth - ov * 2 + E.advanceWidth, [...C('A'), ...C('E').map(c => T(c, AA.advanceWidth - ov * 2))]); }

  // stroke letters, ticks, ligature-like letters of Latin Extended-A
  { const hb = box('-'), ty = hb.y1 - hb.y0;
    const tick = (ch, base, topY) => { const b = box(base), cmx = box(','); const cs = C(',').map(c => T(c, b.x1 - stem * .1 - cmx.x0, topY - cmx.y1)); add(ch, W(base), [...C(base), ...cs]); };
    tick('ď', 'd', box('d').y1); tick('ľ', 'l', box('l').y1); tick('ť', 't', Math.max(box('t').y1 - stem * .2, xh)); tick('Ľ', 'L', cap);
    { const b = box('d'); add('đ', W('d'), [...C('d'), bar(b.x1 - stem * 2.3, b.x1 + stem * .5, b.y1 - stem * 1.2, stem * .5)]); }
    { const b = box('H'); add('Ħ', W('H'), [...C('H'), bar(b.x0 - stem * .5, b.x1 + stem * .5, b.y1 - stem * 1.6, stem * .5)]); }
    { const b = box('h'); add('ħ', W('h'), [...C('h'), bar(b.x0 - stem * .5, b.x1 - stem * .4, b.y1 - stem * 1.5, stem * .5)]); }
    { const b = box('T'); add('Ŧ', W('T'), [...C('T'), bar(b.x0 + (b.x1 - b.x0) * .3, b.x1 - (b.x1 - b.x0) * .3, b.y0 + (b.y1 - b.y0) * .42, stem * .5)]); }
    { const b = box('t'); add('ŧ', W('t'), [...C('t'), bar(b.x0 - stem * .1, b.x1 + stem * .1, b.y0 + (b.y1 - b.y0) * .35, stem * .5)]); }
    { const b = box('L'), pd = box('.'); add('Ŀ', W('L') + stem * 1.2, [...C('L'), ...C('.').map(c => T(c, b.x1 - pd.x0 + stem * .2, xh * .5 - (pd.y0 + pd.y1) / 2 + 0))]); const l = box('l'); add('ŀ', W('l') + stem * 1.6, [...C('l'), ...C('.').map(c => T(c, l.x1 + stem * .5 - pd.x0, xh * .5 - (pd.y0 + pd.y1) / 2))]); }
    add('ĳ', W('i') + W('j'), [...C('i'), ...C('j').map(c => T(c, W('i')))]); add('Ĳ', W('I') + W('J'), [...C('I'), ...C('J').map(c => T(c, W('I')))]);
    { const cmx = box(','); const nb = box('n'); add('ŉ', W('n') + stem * 1.6, [...C(',').map(c => T(c, -cmx.x0 + stem * .1, xh - cmx.y1)), ...C('n').map(c => T(c, stem * 1.4))]); }
  }
  // typographic punctuation
  const cm = box(','), cmTop = cm.y1, cmW = W(','); const rise = cap - cmTop;
  const quote = (n, flip) => { let cs = []; const step = (cm.x1 - cm.x0) + stem * .55; for (let i = 0; i < n; i++) cs.push(...C(',').map(c => T(c, i * step, rise))); if (flip) { const bb = bbox(cs), mx = bb.x0 + bb.x1; cs = cs.map(c => ({ ...c, points: c.points.map(q => ({ ...q, x: Math.round(mx - q.x) })).reverse() })); } return cs; };
  const qW = n => cmW + (n - 1) * ((cm.x1 - cm.x0) + stem * .55);
  add('’', qW(1), quote(1)); add('‘', qW(1), quote(1, true)); add('”', qW(2), quote(2)); add('“', qW(2), quote(2, true));
  add('‚', cmW, C(',')); add('„', qW(2), [...C(','), ...C(',').map(c => T(c, (cm.x1 - cm.x0) + stem * .55))]);
  { const h = box('-'), hh = h.y1 - h.y0, y = h.y0, side = Math.round(stem * .5); add('–', 520 * p.width * .85, [bar(side, 520 * p.width * .85 - side, y, hh)]); add('—', 900 * p.width * .85, [bar(side, 900 * p.width * .85 - side, y, hh)]); add('­', W('-'), C('-')); add('‑', W('-'), C('-')); }
  { const pd = box('.'), r = (pd.x1 - pd.x0), k = 2.3, big = scaleAbout(C('.'), (pd.x0 + pd.x1) / 2, (pd.y0 + pd.y1) / 2, k, 0, 0); const bb = bbox(big); const adv = r * k + stem * 1.6; add('•', adv, big.map(c => T(c, adv / 2 - (bb.x0 + bb.x1) / 2, xh * .5 - (bb.y0 + bb.y1) / 2)));
    const step = W('.') ; add('…', step * 3, [...C('.'), ...C('.').map(c => T(c, step)), ...C('.').map(c => T(c, step * 2))]);
    add('·', W('.'), C('.').map(c => T(c, 0, xh * .5 - (pd.y0 + pd.y1) / 2)));
    const dd2 = scaleAbout(C('.'), (pd.x0 + pd.x1) / 2, (pd.y0 + pd.y1) / 2, .9, 0, 0); const d2 = bbox(dd2), hy = box('-'); const adv2 = Math.round(W('-') + stem * .3), ty = (hy.y0 + hy.y1) / 2;
    const dotAt = (yc) => dd2.map(c => T(c, adv2 / 2 - (d2.x0 + d2.x1) / 2, yc - (d2.y0 + d2.y1) / 2));
    add('÷', adv2, [bar(stem * .4, adv2 - stem * .4, hy.y0, hy.y1 - hy.y0), ...dotAt(ty + stem * 1.9), ...dotAt(ty - stem * 1.9)]); }
  { const pl = gl['+'], b = bbox(pl.contours); add('×', pl.advanceWidth, rot(C('+'), Math.PI / 4)); const hy = box('-'); add('±', pl.advanceWidth, [...C('+').map(c => T(c, 0, stem * .7)), bar(b.x0, b.x1, b.y0 - stem * 1.6 + stem * .7, hy.y1 - hy.y0)]); }
  { const q = gl['?'], b = bbox(q.contours); const mx = b.x0 + b.x1, my = cap; add('¿', q.advanceWidth, C('?').map(c => XF(c, (x, y) => [mx - x, my - y]))); const e = gl['!'], eb = bbox(e.contours); add('¡', e.advanceWidth, C('!').map(c => XF(c, (x, y) => [eb.x0 + eb.x1 - x, my - y]))); }
  { const ls = gl['<'], b = bbox(ls.contours), k = .62, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; const one = scaleAbout(C('<'), cx, cy, k, 0, 0), ob = bbox(one); const off = (ob.x1 - ob.x0) * .62; const base = x => c => T(c, x - ob.x0 + stem * .5, xh * .5 - (ob.y0 + ob.y1) / 2);
    const w2 = (ob.x1 - ob.x0) + off + stem; add('«', w2, [...one.map(base(0)), ...one.map(base(off))]);
    const rs = scaleAbout(C('>'), cx, cy, k, 0, 0), rb = bbox(rs); add('»', w2, [...rs.map(c => T(c, stem * .5 - rb.x0, xh * .5 - (rb.y0 + rb.y1) / 2)), ...rs.map(c => T(c, stem * .5 - rb.x0 + off, xh * .5 - (rb.y0 + rb.y1) / 2))]); }
  { const o = gl['o'], b = bbox(o.contours), k = .36; const rg = scaleAbout(C('o'), (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, k, 0, 0), rb = bbox(rg); const adv = (rb.x1 - rb.x0) + stem * 1.4; add('°', adv, rg.map(c => T(c, adv / 2 - (rb.x0 + rb.x1) / 2, cap - rb.y1))); }
  { const c0 = box('C'), cc = C('C'); const x0 = c0.x0 - stem * .5, x1 = c0.x0 + (c0.x1 - c0.x0) * .66, hh = stem * .5; const mid = (c0.y0 + c0.y1) / 2; add('€', W('C'), [...cc, bar(x0, x1, mid + stem * .5, hh), bar(x0, x1, mid - stem * .5 - hh, hh)]); }
  { const s0 = gl['S'], b = bbox(s0.contours), k = .6, a = scaleAbout(C('S'), (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, k, 0, 0), ab = bbox(a); const hgt = ab.y1 - ab.y0, adv = (ab.x1 - ab.x0) + stem * 1.6; add('§', adv, [...a.map(c => T(c, adv / 2 - (ab.x0 + ab.x1) / 2, cap - ab.y1)), ...a.map(c => T(c, adv / 2 - (ab.x0 + ab.x1) / 2, cap - ab.y1 - hgt * .72))]); }
  { const cb = box('c'), cc = C('c'); const mx = (cb.x0 + cb.x1) / 2, st = (cb.y1 - cb.y0) * .22; add('¢', W('c'), [...cc, bar(mx - stem / 2, mx + stem / 2, cb.y0 - st, (cb.y1 - cb.y0) + 2 * st)]); }
  { const y = box('Y'), hh = stem * .5; add('¥', W('Y'), [...C('Y'), bar(y.x0 + (y.x1 - y.x0) * .18, y.x1 - (y.x1 - y.x0) * .18, y.y0 + (y.y1 - y.y0) * .36, hh), bar(y.x0 + (y.x1 - y.x0) * .18, y.x1 - (y.x1 - y.x0) * .18, y.y0 + (y.y1 - y.y0) * .2, hh)]); }
  { const sup = (ch, nx) => { const b = box(ch), k = .56; const s = scaleAbout(C(ch), (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, k, 0, 0), sb = bbox(s); return { cs: s.map(c => T(c, -sb.x0, cap - sb.y1)), w: sb.x1 - sb.x0 }; };
    for (const [ch, d] of [['¹', '1'], ['²', '2'], ['³', '3'], ['ª', 'a'], ['º', 'o']]) { const { cs, w } = sup(d); add(ch, w + stem * 1.2, cs.map(c => T(c, stem * .6))); } }
  { const mk = (kind, ch) => { const b = box('o'), cx = (b.x0 + b.x1) / 2; const ms = marks(kind, cx, cap - stem * 1.9, b.y0, b).map(m => sk ? XF(m, shear(sk)) : m); add(ch, W('o'), ms); }; mk('diaer', '¨'); mk('acute', '´'); mk('cedilla', '¸'); }
  { const hy = box('-'), adv = W('-') + stem * .6; add('¯', adv, [bar(stem * .3, adv - stem * .3, cap + stem * .1, hy.y1 - hy.y0)]); const ty = hy.y1 - hy.y0; add('¬', adv, [bar(stem * .3, adv - stem * .3, xh * .45, ty), bar(adv - stem * .3 - stem * .9, adv - stem * .3, xh * .45 - stem * 1.5, stem * 1.5 + ty)]); const pb = box('l'); add('¦', stem * 2.4, [bar(stem * 1.1, stem * 1.1 + stem, cap * .55, cap * .5), bar(stem * 1.1, stem * 1.1 + stem, -cap * .1, cap * .5)]); }

  // round 27c: remaining Latin-1 symbols
  { const o = gl['O'], ob = box('O'), cx = (ob.x0 + ob.x1) / 2, cy = (ob.y0 + ob.y1) / 2, k = .92, ring = scaleAbout(C('O'), cx, cy, k, cx, cy), rb = bbox(ring), mid = (rb.y0 + rb.y1) / 2;
    const inner = (ch, kk) => { const b = box(ch), sc = scaleAbout(C(ch), (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, kk, 0, 0), ib = bbox(sc); return sc.map(c => T(c, (rb.x0 + rb.x1) / 2 - (ib.x0 + ib.x1) / 2, mid - (ib.y0 + ib.y1) / 2)); };
    add('©', o.advanceWidth, [...ring, ...inner('c', .5)]); add('®', o.advanceWidth, [...ring, ...inner('R', .42)]);
    const rg = scaleAbout(C('o'), (box('o').x0 + box('o').x1) / 2, (box('o').y0 + box('o').y1) / 2, .6, 0, 0), gb = bbox(rg), gr = (gb.x1 - gb.x0) / 2; const cxx = gr + stem * 1.2, cyy = xh * .55; const ringC = rg.map(c => T(c, cxx - (gb.x0 + gb.x1) / 2, cyy - (gb.y0 + gb.y1) / 2));
    const tk = []; for (const a of [45, 135, 225, 315]) { const th = a * Math.PI / 180, r0 = gr * .95, r1 = gr + stem * .9, hw = stem * .22; const px = Math.cos(th), py = Math.sin(th), nx = -py, ny = px; tk.push(PS([[cxx + px * r0 + nx * hw, cyy + py * r0 + ny * hw], [cxx + px * r1 + nx * hw, cyy + py * r1 + ny * hw], [cxx + px * r1 - nx * hw, cyy + py * r1 - ny * hw], [cxx + px * r0 - nx * hw, cyy + py * r0 - ny * hw]])); }
    add('¤', gr * 2 + stem * 2.4, [...ringC, ...tk]); }
  { const u = box('u'); add('µ', W('u'), [...C('u'), bar(u.x0, u.x0 + stem, -190, xh * .55 + 190)]); }
  { const b = box('P'); add('¶', W('P') + stem * 1.2, [...C('P'), bar(b.x0 + stem * 2.2, b.x0 + stem * 3.2, b.y0, b.y1 - b.y0)]); }
  { const dg = (ch, k) => { const b = box(ch), sc = scaleAbout(C(ch), b.x0, b.y0, k, b.x0, b.y0), sb = bbox(sc); return { cs: sc.map(c => T(c, -sb.x0, 0)), w: sb.x1 - sb.x0 }; };
    const sl = (() => { const b = box('/'), sc = scaleAbout(C('/'), b.x0, b.y0, .8, b.x0, b.y0), sb = bbox(sc); return { cs: sc.map(c => T(c, -sb.x0, -sb.y0)), w: sb.x1 - sb.x0 }; })();
    const frac = (ch, n, d) => { const a = dg(n, .5), z = dg(d, .5), gap = stem * .15; const aY = cap - bbox(a.cs).y1, zY = -bbox(z.cs).y0; const slX = a.w + gap, zX = slX + sl.w * .62 + gap;
      add(ch, zX + z.w + stem * .4, [...a.cs.map(c => T(c, stem * .2, aY)), ...sl.cs.map(c => T(c, slX + stem * .2, 0)), ...z.cs.map(c => T(c, zX + stem * .2, zY))]); };
    frac('¼', '1', '4'); frac('½', '1', '2'); frac('¾', '3', '4'); }
  { add(' ', W(' '), []); }
  if (out['\u00d0']) add('\u0110', out['\u00d0'].advanceWidth, out['\u00d0'].contours.map(cp));
  for (const ch of Object.keys(out)) if (!gl[ch]) gl[ch] = out[ch];
  // accented letters inherit the kerning of their base letter
  if (kerning) { const nm = ch => gl[ch] && gl[ch].name; const add2 = {};
    for (const [ch, [base]] of Object.entries(BASEOF)) { const a = nm(base), b = nm(ch); if (!a || !b) continue; for (const [k, v] of Object.entries(kerning)) { const [l, r] = k.split('|'); if (l === a) add2[b + '|' + r] = v; if (r === a) add2[l + '|' + b] = v; } }
    Object.assign(kerning, add2); }
  return Object.keys(out).length;
}
