import { createHash } from 'node:crypto';
import { PathBuilder, contourBounds, ellipseContour, orientContour, polygonContour, validateGlyph } from '../../../prototype/src/contours.js';

// Isolated adapter revision: formulas preserved; geometry reads must be declared.
const values = model => new Proxy({}, { get: (_, id) => model.readDecision(id) });
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const nodeByKind = (glyph, kind, role = null) => glyph.construction.nodes.find(item => item.kind === kind && (!role || item.role === role));
const parameterSnapshot = (shared, ids) => Object.fromEntries(ids.map(id => [id, shared[id]]));

function geometryGlyph(source, contours, sharedParameters) {
  const bounds = contourBounds(contours);
  const glyph = {
    id: source.id, name: source.name, character: source.character, unicode: source.unicodes[0], classes: [...source.classes],
    contours, bounds, metrics: structuredClone(source.metrics), components: source.construction.nodes.map(item => ({ id: item.id, kind: item.kind })),
    constructionId: `construction:${source.id}`, derivedFromNodeIds: source.construction.nodes.map(item => item.id),
    constructionHash: hash({ construction: source.construction, sharedParameters })
  };
  glyph.metrics.leftSideBearing = bounds.xMin;
  glyph.metrics.rightSideBearing = glyph.metrics.advanceWidth - bounds.xMax;
  return glyph;
}

function constructRing(source, shared) {
  const bowl = nodeByKind(source, 'anatomy.bowl');
  const counter = nodeByKind(source, 'anatomy.counter');
  const stem = shared[bowl.relations.find(item => item.type === 'uses-parameter').targetId];
  const xHeight = shared[bowl.parameters.xHeightDecisionId];
  const overshoot = bowl.parameters.overshoot;
  const advance = source.metrics.advanceWidth;
  const cx = advance / 2;
  const rx = (advance - source.metrics.leftSideBearing * 2) / 2;
  const ry = xHeight / 2 + overshoot;
  const cy = xHeight / 2;
  const scale = counter.parameters.scale;
  if (!(scale > 0 && scale <= 1.15) || rx <= stem || ry <= stem) throw new Error(`${source.id}: counter scale or bowl dimensions are outside the supported construction range.`);
  const outer = orientContour(ellipseContour(`${bowl.id}.outer`, cx, cy, rx, ry, 'outer'), 'outer');
  const inner = orientContour(ellipseContour(`${counter.id}.contour`, cx, cy, (rx - stem) * scale, (ry - stem) * scale, 'counter'), 'counter');
  return geometryGlyph(source, [outer, inner], parameterSnapshot(shared, [bowl.relations.find(item => item.type === 'uses-parameter').targetId, bowl.parameters.xHeightDecisionId]));
}

function constructShoulderedN(source, shared) {
  const left = nodeByKind(source, 'anatomy.stem', 'left-vertical');
  const right = nodeByKind(source, 'anatomy.stem', 'right-vertical');
  const shoulder = nodeByKind(source, 'anatomy.shoulder');
  const leftJoin = source.construction.nodes.find(item => item.kind === 'anatomy.join' && item.role === 'left-shoulder-join');
  const rightJoin = source.construction.nodes.find(item => item.kind === 'anatomy.join' && item.role === 'right-shoulder-join');
  const stem = shared[left.parameters.widthDecisionId];
  const xHeight = shared[shoulder.parameters.xHeightDecisionId];
  const x0 = source.metrics.leftSideBearing;
  const x1 = source.metrics.advanceWidth - source.metrics.rightSideBearing;
  const innerLeft = x0 + stem;
  const innerRight = x1 - stem;
  const mid = (innerLeft + innerRight) / 2;
  const rise = Math.round(stem * shoulder.parameters.riseRatio);
  const innerEndpointY = Math.round(xHeight * shoulder.parameters.innerApertureRatio);
  if ((innerRight - innerLeft) % 4 !== 0 || rise % 2 !== 0) throw new Error(`${source.id}: C1 shoulder construction requires a span divisible by four and an even rise in font units.`);
  const dx = (innerRight - innerLeft) / 4;
  const tangentVectors = [[dx, 0], [dx, rise], [dx, 0], [dx, -rise], [dx, 0]];
  const outerPoints = [{ x: innerLeft, y: xHeight }];
  const outerControls = [];
  for (let segment = 0; segment < 4; segment++) {
    const control = {
      x: outerPoints[segment].x + tangentVectors[segment][0] / 2,
      y: outerPoints[segment].y + tangentVectors[segment][1] / 2
    };
    outerControls.push(control);
    outerPoints.push({
      x: control.x + tangentVectors[segment + 1][0] / 2,
      y: control.y + tangentVectors[segment + 1][1] / 2
    });
  }
  if (outerPoints.at(-1).x !== innerRight || outerPoints.at(-1).y !== xHeight) throw new Error(`${source.id}: shoulder tangent constraints do not close on the right stem.`);
  const innerPeakY = xHeight - stem / 2;
  const b = new PathBuilder(`${source.id}.connected-structure`, 'outer', x0, 0);
  b.line('left-stem-outer', x0, xHeight)
    .line('left-shoulder-join', innerLeft, xHeight)
    .quad(`${leftJoin.id}.outer-entry`, outerControls[0].x, outerControls[0].y, outerPoints[1].x, outerPoints[1].y)
    .quad(`${shoulder.id}.outer-left-center`, outerControls[1].x, outerControls[1].y, outerPoints[2].x, outerPoints[2].y)
    .quad(`${shoulder.id}.outer-center-right`, outerControls[2].x, outerControls[2].y, outerPoints[3].x, outerPoints[3].y)
    .quad(`${rightJoin.id}.outer-exit`, outerControls[3].x, outerControls[3].y, outerPoints[4].x, outerPoints[4].y)
    .line('right-stem-outer', x1, xHeight)
    .line('right-stem-bottom-outer', x1, 0)
    .line('right-stem-bottom-inner', innerRight, 0)
    .line('right-shoulder-inner', innerRight, innerEndpointY)
    .quad(`${rightJoin.id}.inner-approach`, innerRight, innerPeakY, mid, innerPeakY)
    .quad(`${shoulder.id}.inner-return`, innerLeft, innerPeakY, innerLeft, innerEndpointY)
    .line('left-stem-bottom-inner', innerLeft, 0);
  return geometryGlyph(source, [orientContour(b.close(), 'outer')], parameterSnapshot(shared, [left.parameters.widthDecisionId, shoulder.parameters.xHeightDecisionId]));
}

function constructH(source, shared) {
  const left = nodeByKind(source, 'anatomy.stem', 'left-vertical');
  const right = nodeByKind(source, 'anatomy.stem', 'right-vertical');
  const crossbar = nodeByKind(source, 'anatomy.crossbar');
  const stem = shared[left.parameters.widthDecisionId];
  const capHeight = shared[left.parameters.capHeightDecisionId];
  const centerRatio = crossbar.parameters.centerRatio;
  const x0 = source.metrics.leftSideBearing;
  const x1 = source.metrics.advanceWidth - source.metrics.rightSideBearing;
  const y0 = Math.round(capHeight * centerRatio - shared[crossbar.parameters.thicknessDecisionId] / 2);
  const y1 = y0 + shared[crossbar.parameters.thicknessDecisionId];
  const contour = polygonContour(`${left.id}+${crossbar.id}+${right.id}.silhouette`, [
    { x: x0, y: 0 }, { x: x0 + stem, y: 0 }, { x: x0 + stem, y: y0 },
    { x: x1 - stem, y: y0 }, { x: x1 - stem, y: 0 }, { x: x1, y: 0 },
    { x: x1, y: capHeight }, { x: x1 - stem, y: capHeight }, { x: x1 - stem, y: y1 },
    { x: x0 + stem, y: y1 }, { x: x0 + stem, y: capHeight }, { x: x0, y: capHeight }
  ], 'outer');
  return geometryGlyph(source, [contour], { ...parameterSnapshot(shared, [left.parameters.widthDecisionId, left.parameters.capHeightDecisionId, crossbar.parameters.thicknessDecisionId]), centerRatio });
}

/** Construct a single-storey bowl-and-stem form from anatomy nodes and shared dimensions. */
function constructBowlWithAttachedStem(source, shared) {
  const construction = source.construction;
  const bowl = nodeByKind(source, 'anatomy.bowl', 'attached-bowl');
  const counter = nodeByKind(source, 'anatomy.counter', 'bowl-counter');
  const stem = nodeByKind(source, 'anatomy.stem', 'attached-vertical');
  const upperJoin = nodeByKind(source, 'anatomy.join', 'upper-bowl-stem');
  const lowerJoin = nodeByKind(source, 'anatomy.join', 'lower-bowl-stem');
  const upperTerminal = nodeByKind(source, 'anatomy.terminal', 'upper-stem-terminal');
  const lowerTerminal = nodeByKind(source, 'anatomy.terminal', 'lower-stem-terminal');
  if (construction.parameters?.topology !== 'single-storey' || construction.parameters?.stemSide !== 'right') {
    throw new Error(`${source.id}: bowl-with-attached-stem supports only an explicitly selected single-storey, right-stem topology.`);
  }
  if (![bowl, counter, stem, upperJoin, lowerJoin, upperTerminal, lowerTerminal].every(Boolean)) {
    throw new Error(`${source.id}: incomplete bowl-with-attached-stem semantic anatomy.`);
  }
  const stemWidth = shared[stem.parameters.widthDecisionId];
  const xHeight = shared[bowl.parameters.xHeightDecisionId];
  const advance = source.metrics.advanceWidth;
  const inkRight = advance - source.metrics.rightSideBearing;
  const stemLeft = inkRight - stemWidth;
  const bowlWidth = Math.round(xHeight * bowl.parameters.widthRatio);
  const bowlLeft = stemLeft - bowlWidth;
  const midY = xHeight / 2;
  const counterInsetX = Math.round(stemWidth * counter.parameters.horizontalInsetRatio);
  const counterLeft = bowlLeft + counterInsetX;
  const counterBottom = Math.round(stemWidth * counter.parameters.verticalInsetRatio);
  const counterTop = xHeight - counterBottom;
  if (!Number.isInteger(xHeight) || xHeight <= 0 || !Number.isInteger(stemWidth) || stemWidth <= 0 ||
      bowlLeft < 0 || bowlWidth <= stemWidth || counterLeft <= bowlLeft || counterLeft >= stemLeft ||
      counterBottom <= 0 || counterBottom >= midY || counterTop <= midY || counterTop >= xHeight) {
    throw new Error(`${source.id}: semantic bowl, stem, or counter proportions collapse or exceed the supported glyph box.`);
  }
  const upperCut = terminalCut(upperTerminal, stemWidth);
  terminalCut(lowerTerminal, stemWidth);

  const outerBuilder = new PathBuilder(`${source.id}.bowl-stem-outer`, 'outer', stemLeft, xHeight);
  outerBuilder.line(`${upperTerminal.id}.flat-edge`, inkRight - upperCut, xHeight);
  if (upperCut) outerBuilder.line(`${upperTerminal.id}.bevel-edge`, inkRight, xHeight - upperCut);
  outerBuilder
    .line(`${stem.id}.outer-edge`, inkRight, 0)
    .line(`${lowerTerminal.id}.flat-edge`, stemLeft, 0)
    .quad(`${lowerJoin.id}.bowl-arc`, bowlLeft, 0, bowlLeft, midY)
    .quad(`${upperJoin.id}.bowl-arc`, bowlLeft, xHeight, stemLeft, xHeight);
  const outer = orientContour(outerBuilder.close(), 'outer');

  const counterBuilder = new PathBuilder(`${source.id}.bowl-counter`, 'counter', stemLeft, counterBottom);
  counterBuilder
    .quad(`${counter.id}.lower-arc`, counterLeft, counterBottom, counterLeft, midY)
    .quad(`${counter.id}.upper-arc`, counterLeft, counterTop, stemLeft, counterTop)
    .line(`${stem.id}.counter-wall`, stemLeft, counterBottom);
  const negativeSpace = orientContour(counterBuilder.close(), 'counter');
  return geometryGlyph(source, [outer, negativeSpace], {
    ...parameterSnapshot(shared, [stem.parameters.widthDecisionId, bowl.parameters.xHeightDecisionId]),
    topology: construction.parameters.topology,
    stemSide: construction.parameters.stemSide,
    bowlWidthRatio: bowl.parameters.widthRatio,
    horizontalInsetRatio: counter.parameters.horizontalInsetRatio,
    verticalInsetRatio: counter.parameters.verticalInsetRatio
  });
}

function terminalCut(terminal, stemWidth) {
  const parameters = terminal.parameters || {};
  if (parameters.profile === 'flat') {
    if (Object.keys(parameters).some(key => !['profile', 'alignmentDecisionId'].includes(key))) {
      throw new Error(`${terminal.id}: flat terminals do not accept additional shape parameters.`);
    }
    return 0;
  }
  if (parameters.profile !== 'chamfered' || terminal.role !== 'upper-stem-terminal' ||
      parameters.orientation !== 'outer-right' || !Number.isFinite(parameters.cutRatio) ||
      parameters.cutRatio <= 0 || parameters.cutRatio > 0.25 ||
      Object.keys(parameters).some(key => !['profile', 'alignmentDecisionId', 'orientation', 'cutRatio'].includes(key))) {
    throw new Error(`${terminal.id}: unsupported terminal profile or parameters.`);
  }
  const cut = Math.floor(stemWidth * parameters.cutRatio);
  if (!Number.isInteger(stemWidth) || stemWidth <= 0 || cut < 1) {
    throw new Error(`${terminal.id}: chamfer size must produce at least one font unit within the supported stem width.`);
  }
  return cut;
}

const METHODS = {
  'construction.ring-from-bowl-counter': constructRing,
  'construction.connected-stems-and-shoulder': constructShoulderedN,
  'construction.parallel-stems-and-crossbar': constructH,
  'construction.bowl-with-attached-stem': constructBowlWithAttachedStem
};

export function deriveGlyph(source, model) {
  const method = METHODS[source.construction.method];
  if (!method) throw new Error(`Unsupported semantic construction method ${source.construction.method}.`);
  const derived = method(source, values(model));
  const errors = validateGlyph({ ...derived, advanceWidth: derived.metrics.advanceWidth, rightSideBearing: derived.metrics.rightSideBearing });
  if (errors.length) throw new Error(`${source.name}: invalid derived geometry: ${errors.join(' ')}`);
  if (derived.metrics.leftSideBearing !== derived.bounds.xMin || derived.metrics.rightSideBearing !== derived.metrics.advanceWidth - derived.bounds.xMax) {
    throw new Error(`${source.name}: side bearings do not agree with derived bounds.`);
  }
  return derived;
}

export function deriveDesignGeometry(model, { onlyGlyphIds = null } = {}) {
  const wanted = onlyGlyphIds ? new Set(onlyGlyphIds) : null;
  const prior = model.derived.geometry?.glyphs || {};
  const glyphs = {};
  for (const source of model.glyphRegistry.glyphs) {
    glyphs[source.id] = wanted && !wanted.has(source.id) && prior[source.id]
      ? structuredClone(prior[source.id])
      : deriveGlyph(source, model);
  }
  if (wanted) for (const id of wanted) if (!model.glyphRegistry.glyphs.some(item => item.id === id)) throw new Error(`Cannot derive unknown glyph ${id}.`);
  return { representation: 'quadratic-contours', sourceRevisionId: model.revisions.headRevisionId, generatorVersion: 'semantic-construction-v1', glyphs };
}

export function glyphGeometryHash(glyph) {
  return hash({ contours: glyph.contours, bounds: glyph.bounds, metrics: glyph.metrics, constructionHash: glyph.constructionHash });
}
