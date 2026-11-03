import { PathBuilder, contourBounds, ellipseRing, orientContour, polygonContour, rectContour, roundedRectContour } from './contours.js';

const BASE_WIDTH = { A: 520, B: 510, E: 450, H: 560, O: 560, a: 500, e: 470, n: 500, o: 500, g: 520 };

export const RECIPE_LIBRARY = Object.freeze({
  geometric: { A: 'geo.cap-apex', B: 'geo.double-bowl', E: 'geo.stacked-arms', H: 'geo.twin-stem', O: 'geo.circular-ring', a: 'geo.double-storey-a', e: 'geo.open-crossbar-e', n: 'geo.symmetric-shoulder', o: 'geo.circular-ring', g: 'geo.single-bowl-descender' },
  humanist: { A: 'hum.angled-apex', B: 'hum.asymmetric-bowls', E: 'hum.open-arms', H: 'hum.variable-stems', O: 'hum.stressed-ring', a: 'hum.single-storey-a', e: 'hum.open-e', n: 'hum.asymmetric-shoulder', o: 'hum.stressed-ring', g: 'hum.open-loop-g' },
  serif: { A: 'serif.bracketed-apex', B: 'serif.bracketed-bowls', E: 'serif.bracketed-arms', H: 'serif.bracketed-stems', O: 'serif.oval-with-terminals', a: 'serif.double-storey-a', e: 'serif.bracketed-e', n: 'serif.bracketed-shoulder', o: 'serif.oval', g: 'serif.double-storey-g' }
});

function localDefaults(system) {
  if (system === 'humanist') return { stem: 91, contrast: 0.22, xHeight: 545, aperture: 0.22, terminal: 'rounded', spacing: 1.04, serifBracket: 0.2 };
  if (system === 'serif') return { stem: 100, contrast: 0.46, xHeight: 510, aperture: 0.17, terminal: 'square', spacing: 1.03, serifBracket: 0.24 };
  return { stem: 94, contrast: 0.08, xHeight: 520, aperture: 0.15, terminal: 'square', spacing: 1, serifBracket: 0.2 };
}

function effectiveParameters(spec, system, overrides = {}) {
  const p = { ...localDefaults(system), width: 1, weight: 400, capHeight: 700, monospaced: false, ...spec.explicitParameters, ...overrides };
  p.system = system; p.family = system === 'serif' ? 'serif' : 'sans';
  p.stem = Math.max(54, Math.round((p.stem || localDefaults(system).stem) * (p.weight >= 600 ? 1.28 : Math.max(0.72, p.weight / 400))));
  p.verticalStem = p.stem;
  p.horizontalStem = Math.max(34, Math.round(p.stem * (1 - Math.min(0.78, p.contrast) * 0.56)));
  p.terminalRadius = p.terminal === 'rounded' ? Math.round(p.stem * 0.35) : 0;
  p.roundness = p.terminalRadius;
  return p;
}

function addContour(g, contour, kind, componentId = kind) {
  g.contours.push(contour);
  g.components.push({ id: `${g.id}.${kind}-${g.components.length + 1}`, componentId, kind, contourId: contour.id });
  return contour;
}

function rect(g, name, x0, y0, x1, y1, p, radius = null) {
  const r = radius ?? Math.min(p.terminalRadius, Math.abs(x1 - x0) * 0.25, Math.abs(y1 - y0) * 0.25);
  return addContour(g, r > 0 ? roundedRectContour(`${g.id}.${name}`, x0, y0, x1, y1, r) : rectContour(`${g.id}.${name}`, x0, y0, x1, y1), name.split('-')[0]);
}

function ring(g, name, cx, cy, rx, ry, p, options = {}) {
  const contrast = options.ignoreContrast ? 0 : p.contrast;
  const vStroke = options.strokeX ?? p.verticalStem;
  const hStroke = options.strokeY ?? Math.max(34, Math.round(p.verticalStem * (1 - contrast * 0.56)));
  const pair = ellipseRing(`${g.id}.${name}`, cx, cy, rx, ry, vStroke, hStroke, options.innerShift || 0, p.counterScale || 1);
  addContour(g, pair[0], `${name}-bowl`, 'bowl.outer');
  addContour(g, pair[1], `${name}-counter`, 'bowl.counter');
}

function qPath(g, name, role, start, commands, kind = name) {
  const b = new PathBuilder(`${g.id}.${name}`, role, start[0], start[1]);
  for (const c of commands) {
    if (c.type === 'line') b.line(c.id, c.to[0], c.to[1]);
    else b.quad(c.id, c.control[0], c.control[1], c.to[0], c.to[1]);
  }
  return addContour(g, orientContour(b.close(), role), kind, `path.${name}`);
}

function shapedE(g, w, h, p, name = 'e') {
  const cy = h * 0.49, rx = w * 0.46, ry = h * 0.45;
  const gap = 0.34 + p.aperture * 0.95;
  const a = Math.min(0.92, gap / 2);
  const innerRx = Math.max(56, (rx - p.verticalStem) * (p.counterScale || 1)), innerRy = Math.max(54, (ry - p.horizontalStem) * (p.counterScale || 1));
  const upper = [cy + ry * Math.sin(a), w / 2 + rx * Math.cos(a)];
  const lower = [cy - ry * Math.sin(a), w / 2 + rx * Math.cos(a)];
  const innerUpper = [cy + innerRy * Math.sin(a), w / 2 + innerRx * Math.cos(a)];
  const innerLower = [cy - innerRy * Math.sin(a), w / 2 + innerRx * Math.cos(a)];
  const b = new PathBuilder(`${g.id}.${name}.aperture`, 'outer', lower[1], lower[0]);
  // The long outer arc goes around the back of the bowl; the inner arc returns
  // through the counter. The two mouth edges are the editable aperture.
  appendArc(b, 'outer-arc', w / 2, cy, rx, ry, -a, -Math.PI * 2 + a);
  if (p.terminalRadius) b.quad('upper-terminal-round', (upper[1] + innerUpper[1]) / 2 + p.terminalRadius, (upper[0] + innerUpper[0]) / 2, innerUpper[1], innerUpper[0]);
  else b.line('upper-terminal', innerUpper[1], innerUpper[0]);
  appendArc(b, 'inner-arc', w / 2, cy, innerRx, innerRy, a, Math.PI * 2 - a);
  if (p.terminalRadius) b.quad('lower-terminal-round', (lower[1] + innerLower[1]) / 2 + p.terminalRadius, (lower[0] + innerLower[0]) / 2, lower[1], lower[0]);
  else b.line('lower-terminal', lower[1], lower[0]);
  addContour(g, orientContour(b.close(), 'outer'), 'aperture-form', 'aperture.open');
  const crossY = cy - p.horizontalStem / 2;
  rect(g, `${name}-crossbar`, Math.round(w * 0.22), crossY, Math.round(w * 0.91), crossY + p.horizontalStem, p, 0);
  return { mouthWidth: Math.round(2 * (upper[1] - innerUpper[1])) };
}

function appendArc(builder, prefix, cx, cy, rx, ry, start, end) {
  const count = Math.max(1, Math.ceil(Math.abs(end - start) / (Math.PI / 2)));
  const step = (end - start) / count;
  for (let i = 0; i < count; i++) {
    const a = start + i * step, z = a + step, m = (a + z) / 2, f = 1 / Math.cos((z - a) / 2);
    builder.quad(`${prefix}-${i}`, cx + rx * Math.cos(m) * f, cy + ry * Math.sin(m) * f, cx + rx * Math.cos(z), cy + ry * Math.sin(z));
  }
}

function capA(g, w, h, p, humanist = false) {
  const s = p.verticalStem, crossY = h * (humanist ? 0.43 : 0.40), arm = s * (humanist ? 0.58 : 0.5);
  const apexX = humanist ? w * 0.47 : w * 0.5;
  const contour = polygonContour(`${g.id}.apex-and-counter`, [
    { x: 0, y: 0 }, { x: apexX, y: h }, { x: w, y: 0 },
    { x: w - s, y: 0 }, { x: apexX + arm, y: crossY }, { x: apexX - arm, y: crossY }, { x: s, y: 0 }
  ]);
  addContour(g, contour, 'diagonal-and-crossbar', 'apex.diagonal-crossbar');
}

function bowlB(g, w, h, p, system) {
  const stem = p.verticalStem, rx = w * (system === 'humanist' ? 0.33 : 0.34);
  rect(g, 'spine', 0, 0, stem, h, p);
  const upperCy = h * (system === 'humanist' ? 0.73 : 0.72), lowerCy = h * 0.28;
  ring(g, 'upper', stem + rx * 0.78, upperCy, rx, h * 0.255, p, { innerShift: system === 'humanist' ? 12 : 0 });
  ring(g, 'lower', stem + rx * 0.8, lowerCy, rx * (system === 'humanist' ? 1.04 : 1), h * 0.26, p, { innerShift: system === 'humanist' ? 18 : 0 });
}

function letterE(g, w, h, p) {
  const s = p.verticalStem, t = p.horizontalStem, mid = h * 0.47, upper = h - t, lower = t;
  const shape = polygonContour(`${g.id}.stacked-arms`, [
    { x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: lower }, { x: s, y: lower },
    { x: s, y: mid - t / 2 }, { x: w * 0.78, y: mid - t / 2 }, { x: w * 0.78, y: mid + t / 2 },
    { x: s, y: mid + t / 2 }, { x: s, y: upper }, { x: w, y: upper }, { x: w, y: h }, { x: 0, y: h }
  ]);
  addContour(g, shape, 'stem-and-arms', 'stem.crossbar');
}

function letterH(g, w, h, p) {
  const s = p.verticalStem, t = p.horizontalStem, y = h * 0.48;
  rect(g, 'left-stem', 0, 0, s, h, p);
  rect(g, 'right-stem', w - s, 0, w, h, p);
  rect(g, 'crossbar', s, y - t / 2, w - s, y + t / 2, p);
}

function shoulder(g, w, h, p, humanist = false) {
  const s = p.verticalStem, top = h * (humanist ? 0.94 : 0.98);
  const left = s, right = w - s;
  qPath(g, 'shoulder-band', 'outer', [0, 0], [
    { type: 'line', id: 'left-bottom', to: [left, 0] },
    { type: 'line', id: 'left-inner', to: [left, top - s * 0.48] },
    { type: 'quadratic', id: 'inner-arch', control: [w * 0.5, top - s * (humanist ? 0.92 : 0.8)], to: [right, h * 0.54] },
    { type: 'line', id: 'right-inner-bottom', to: [right, 0] },
    { type: 'line', id: 'right-outer-bottom', to: [w, 0] },
    { type: 'line', id: 'right-outer-top', to: [w, h * 0.55] },
    { type: 'quadratic', id: 'outer-arch', control: [w * (humanist ? 0.52 : 0.5), top + s * (humanist ? 0.16 : 0.12)], to: [0, h] },
    { type: 'line', id: 'left-outer-top', to: [0, 0] }
  ], 'shoulder');
}

function serifPart(g, id, x, y, s, ext, depth, bracket, top = false) {
  const base = y, b = new PathBuilder(`${g.id}.${id}`, 'outer', x - ext, top ? base + depth : base - depth);
  if (!top) {
    b.line('outer-right', x + s + ext, base - depth).line('right-edge', x + s + ext, base)
      .line('bracket-start-r', x + s + bracket, base)
      .quad('bracket-r', x + s, base, x + s, base + bracket)
      .line('stem-top-r', x + s, base + bracket).line('stem-top-l', x, base + bracket)
      .quad('bracket-l', x, base, x - bracket, base)
      .line('bracket-start-l', x - ext, base);
  } else {
    b.line('outer-right', x + s + ext, base + depth).line('right-edge', x + s + ext, base)
      .line('bracket-start-r', x + s + bracket, base)
      .quad('bracket-r', x + s, base, x + s, base - bracket)
      .line('stem-top-r', x + s, base - bracket).line('stem-top-l', x, base - bracket)
      .quad('bracket-l', x, base, x - bracket, base)
      .line('bracket-start-l', x - ext, base);
  }
  addContour(g, orientContour(b.close(), 'outer'), 'bracketed-serif', 'serif.bracket-transition');
}

function addSerifs(g, stems, p) {
  if (p.system !== 'serif') return;
  for (const [i, st] of stems.entries()) {
    const [x, y0, y1, thickness] = st;
    const ext = Math.round(thickness * 0.72), depth = Math.round(thickness * 0.32), bracket = Math.round(depth * p.serifBracket);
    serifPart(g, `serif-${i}-bottom`, x, y0, thickness, ext, depth, bracket, false);
    serifPart(g, `serif-${i}-top`, x, y1, thickness, ext, depth, bracket, true);
  }
}

function recipe(g, w, p, system) {
  const upper = p.capHeight, lower = p.xHeight;
  const stemLocations = [];
  switch (g.character) {
    case 'A':
      capA(g, w, upper, p, system === 'humanist');
      if (system === 'serif') stemLocations.push([0, 0, upper, p.verticalStem], [w - p.verticalStem, 0, upper, p.verticalStem]);
      break;
    case 'B':
      bowlB(g, w, upper, p, system);
      stemLocations.push([0, 0, upper, p.verticalStem]); break;
    case 'E': letterE(g, w, upper, p); stemLocations.push([0, 0, upper, p.verticalStem]); break;
    case 'H': letterH(g, w, upper, p); stemLocations.push([0, 0, upper, p.verticalStem], [w - p.verticalStem, 0, upper, p.verticalStem]); break;
    case 'O': ring(g, 'bowl', w / 2, upper / 2, w * 0.49, upper * 0.51, p, { innerShift: system === 'humanist' ? w * 0.025 : 0 });
      if (system === 'serif') addBowlSerifs(g, w, upper, p); break;
    case 'a':
      if (system === 'humanist') {
        openBowl(g, w, lower, p, 'a-single-storey', true);
        stemLocations.push([w - p.verticalStem, 0, lower, p.verticalStem]);
      } else {
        ring(g, 'lower-bowl', w * 0.39, lower * 0.31, w * 0.36, lower * 0.31, p, { innerShift: system === 'serif' ? 4 : 0 });
  rect(g, 'right-stem', w * 0.68, 0, w * 0.68 + p.verticalStem, lower * 1.36, p);
        stemLocations.push([Math.round(w * 0.68), 0, Math.round(lower * 1.36), p.verticalStem]);
      }
      break;
    case 'e': shapedE(g, w, lower, p); break;
    case 'n': shoulder(g, w, lower, p, system === 'humanist');
      if (system === 'serif') stemLocations.push([0, 0, lower, p.verticalStem], [w - p.verticalStem, 0, lower * 0.56, p.verticalStem]); break;
    case 'o': ring(g, 'bowl', w / 2, lower / 2, w * 0.49, lower * 0.51, p, { innerShift: system === 'humanist' ? w * 0.026 : 0 }); break;
    case 'g':
      if (system === 'humanist') {
        ring(g, 'upper-bowl', w * 0.43, lower * 0.68, w * 0.36, lower * 0.30, p, { innerShift: 12 });
        openBowl(g, w, lower, p, 'descender-loop', false, -lower * 0.10, 0.36);
        const tail = polygonContour(`${g.id}.humanist-tail`, [
          { x: w * 0.68, y: lower * 0.56 }, { x: w * 0.80, y: lower * 0.54 },
          { x: w * 0.75, y: -lower * 0.18 }, { x: w * 0.61, y: -lower * 0.24 },
          { x: w * 0.47, y: -lower * 0.18 }, { x: w * 0.52, y: -lower * 0.06 },
          { x: w * 0.65, y: -lower * 0.03 }
        ]);
        addContour(g, tail, 'curved-descender', 'descender.humanist');
      } else {
        ring(g, 'bowl', w * 0.48, lower * 0.5, w * 0.45, lower * 0.49, p);
        const tail = polygonContour(`${g.id}.descender`, [
          { x: w * 0.66, y: lower * 0.52 }, { x: w * 0.80, y: lower * 0.49 },
          { x: w * 0.75, y: -lower * 0.20 }, { x: w * 0.60, y: -lower * 0.25 },
          { x: w * 0.45, y: -lower * 0.18 }, { x: w * 0.50, y: -lower * 0.07 },
          { x: w * 0.65, y: -lower * 0.04 }
        ]);
        addContour(g, tail, 'descender', 'descender.curved');
      }
      if (system === 'serif') stemLocations.push([Math.round(w * 0.14), 0, lower, p.verticalStem]);
      break;
  }
  addSerifs(g, stemLocations, p);
}

function openBowl(g, w, h, p, name, terminal = true, cyOverride = null, ryFactor = 0.43) {
  const cy = cyOverride ?? h * 0.49, rx = w * 0.40, ry = h * ryFactor;
  const gap = 0.42 + p.aperture * 0.95, a = Math.min(0.94, gap / 2);
  const irx = Math.max(42, (rx - p.verticalStem) * (p.counterScale || 1)), iry = Math.max(44, (ry - p.horizontalStem) * (p.counterScale || 1));
  const b = new PathBuilder(`${g.id}.${name}`, 'outer', w * 0.50 + rx * Math.cos(-a), cy + ry * Math.sin(-a));
  appendArc(b, 'outer', w * 0.50, cy, rx, ry, -a, -Math.PI * 2 + a);
  const outerUpper = [w * 0.50 + rx * Math.cos(a), cy + ry * Math.sin(a)];
  const innerUpper = [w * 0.50 + irx * Math.cos(a), cy + iry * Math.sin(a)];
  const innerLower = [w * 0.50 + irx * Math.cos(-a), cy + iry * Math.sin(-a)];
  const outerLower = [w * 0.50 + rx * Math.cos(-a), cy + ry * Math.sin(-a)];
  if (p.terminalRadius) b.quad('terminal-top-round', (outerUpper[0] + innerUpper[0]) / 2 + p.terminalRadius, (outerUpper[1] + innerUpper[1]) / 2, innerUpper[0], innerUpper[1]);
  else b.line('terminal-in', innerUpper[0], innerUpper[1]);
  appendArc(b, 'inner', w * 0.50, cy, irx, iry, a, Math.PI * 2 - a);
  if (p.terminalRadius) b.quad('terminal-bottom-round', (innerLower[0] + outerLower[0]) / 2 + p.terminalRadius, (innerLower[1] + outerLower[1]) / 2, outerLower[0], outerLower[1]);
  else b.line('terminal-out', outerLower[0], outerLower[1]);
  let contour = orientContour(b.close(), 'outer');
  if (terminal && p.terminal === 'rounded') contour.terminalStyle = 'rounded';
  addContour(g, contour, name, 'bowl.open');
}

function addBowlSerifs(g, w, h, p) {
  const depth = Math.max(24, p.verticalStem * 0.32), extent = w * 0.28;
  for (const [id, y, sign] of [['top', h - depth * 0.35, 1], ['bottom', depth * 0.35, -1]]) {
    const b = new PathBuilder(`${g.id}.oval-serif-${id}`, 'outer', w / 2 - extent, y);
    b.line('arm-r', w / 2 + extent, y).line('edge-r', w / 2 + extent * 0.92, y + sign * depth * 0.4)
      .quad('bracket-r', w / 2 + p.verticalStem * 0.35, y + sign * depth * 0.7, w / 2 + p.verticalStem * 0.18, y + sign * depth)
      .line('stem-r', w / 2 - p.verticalStem * 0.18, y + sign * depth)
      .quad('bracket-l', w / 2 - p.verticalStem * 0.35, y + sign * depth * 0.7, w / 2 - extent * 0.92, y + sign * depth * 0.4)
      .line('edge-l', w / 2 - extent, y).line('close', w / 2 - extent, y);
    addContour(g, orientContour(b.close(), 'outer'), `oval-serif-${id}`, 'serif.bracket-transition');
  }
}

function recipeGlyph(character, system, p) {
  const id = `u${character.codePointAt(0).toString(16).padStart(4, '0')}`;
  const w = Math.round(BASE_WIDTH[character] * p.width);
  const h = 'A' <= character && character <= 'Z' ? p.capHeight : p.xHeight;
  const g = { id, character, name: character, unicode: character.codePointAt(0), recipeId: RECIPE_LIBRARY[system][character], contours: [], components: [], anchors: { baseline: 0, top: h, center: Math.round(h / 2) }, metrics: {} };
  recipe(g, w, p, system);
  return g;
}

export function generateContourFamily(spec, { system = spec.resolvedParameters.system, style = 'Regular', overrides = {} } = {}) {
  if (!RECIPE_LIBRARY[system]) throw new Error(`Unknown construction system: ${system}`);
  const p = effectiveParameters(spec, system, { ...overrides, ...(style === 'Bold' ? { weight: 700 } : {}) });
  const glyphs = {}, order = [];
  for (const ch of ['A', 'B', 'E', 'H', 'O', 'a', 'e', 'n', 'o', 'g']) {
    const glyph = recipeGlyph(ch, system, p);
    const side = Math.round(50 * p.spacing);
    translateGlyph(glyph, side, 0);
    const bounds = glyphBounds(glyph);
    const advance = Math.max(bounds.xMax + side, Math.round(BASE_WIDTH[ch] * p.width + side * 2));
    glyph.metrics = { advanceWidth: advance, leftSideBearing: bounds.xMin, rightSideBearing: advance - bounds.xMax };
    glyph.bounds = bounds;
    glyph.components = glyph.components.map((part, i) => ({ ...part, index: i }));
    glyphs[glyph.id] = glyph; order.push(glyph.id);
  }
  if (p.monospaced) {
    const advance = Math.ceil(Math.max(...Object.values(glyphs).map(g => g.metrics.advanceWidth)) / 10) * 10;
    for (const glyph of Object.values(glyphs)) {
      const dx = Math.round((advance - glyph.metrics.advanceWidth) / 2);
      translateGlyph(glyph, dx, 0);
      glyph.metrics.advanceWidth = advance;
      glyph.metrics.leftSideBearing = glyph.bounds.xMin;
      glyph.metrics.rightSideBearing = advance - glyph.bounds.xMax;
    }
  }
  const family = spec.source.family || 'Typeface Studio Prototype';
  return {
    schemaVersion: 1,
    metadata: { family: `${family} ${system[0].toUpperCase()}${system.slice(1)}`, style, designer: 'LFCFoundry Typeface Studio prototype', copyright: 'Prototype font generated from first-party procedural recipes.', version: '0.100' },
    system, designSpec: spec, design: p,
    metrics: { unitsPerEm: 1000, ascender: 800, descender: system === 'humanist' ? -280 : -220, lineGap: 0 },
    glyphOrder: order, glyphs,
    spacing: { classes: { cap: ['A','B','E','H','O'], lowercase: ['a','e','n','o','g'] }, pairs: {} }
  };
}

function translateGlyph(g, dx, dy) {
  for (const c of g.contours) {
    c.start.x += dx; c.start.y += dy;
    for (const s of c.segments) { s.from.x += dx; s.from.y += dy; s.to.x += dx; s.to.y += dy; if (s.control) { s.control.x += dx; s.control.y += dy; } }
    for (const pt of c.points) { pt.x += dx; pt.y += dy; }
  }
  for (const [key, value] of Object.entries(g.anchors)) if (typeof value === 'number') g.anchors[key] = value + dy;
  g.bounds = glyphBounds(g);
}

export function glyphBounds(glyph) {
  return contourBounds(glyph.contours);
}

export function constructionDefaults(system) { return localDefaults(system); }
