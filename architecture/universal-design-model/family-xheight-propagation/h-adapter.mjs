import { createHash } from 'node:crypto';
import { PathBuilder, contourBounds, orientContour, validateGlyph } from '../../../prototype/src/contours.js';
import { assertValidHConstruction } from './h-grammar.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const decisionMap = model => ({ get: id => model.readDecision(id) });
const semanticNode = (glyph, kind, role) => glyph.construction.nodes.find(item => item.kind === kind && item.role === role);
const relationHas = (item, type, target) => item.relations?.some(relation => relation.type === type && relation.targetId === target);

function makeGlyphRecord(source, contours, model, openSpace) {
  const bounds = contourBounds(contours);
  const metrics = structuredClone(source.metrics);
  metrics.leftSideBearing = bounds.xMin;
  metrics.rightSideBearing = metrics.advanceWidth - bounds.xMax;
  const nodeIds = source.construction.nodes.map(item => item.id);
  const geometry = {
    id: source.id, name: source.name, character: source.character, unicode: source.unicodes[0], classes: [...source.classes],
    contours, bounds, metrics,
    components: source.construction.nodes.map(item => ({ id: item.id, kind: item.kind, role: item.role })),
    constructionId: `construction:${source.id}`, derivedFromNodeIds: nodeIds,
    constructionHash: digest({ construction: source.construction, decisions: model.dependencySnapshot }),
    openSpaces: [{ id: openSpace.id, boundaryIds: [...openSpace.parameters.boundaryIds],
      openingBoundaryId: openSpace.parameters.openingBoundaryId }]
  };
  return geometry;
}

/** Adapter for one stem plus a shoulder whose right-hand return is an owned terminal. */
export function deriveStemShoulderGeometry(source, model) {
  assertValidHConstruction(source, model);
  const nodes = source.construction.nodes;
  const stem = semanticNode(source, 'anatomy.stem', 'left-ascender-stem');
  const shoulder = semanticNode(source, 'anatomy.shoulder', 'arched-return');
  const space = semanticNode(source, 'anatomy.open-space', 'shoulder-open-counter');
  const boundary = role => nodes.find(item => item.kind === 'anatomy.boundary' && item.role === role);
  const boundaries = {
    stemOuter: boundary('left-stem-outer-wall'), stemTop: boundary('upper-stem-terminal-edge'),
    shoulderEntry: boundary('stem-shoulder-junction'), shoulderOuter: boundary('shoulder-outer-arch'),
    returnOuter: boundary('shoulder-return-outer-wall'), returnBottom: boundary('shoulder-return-terminal-edge'),
    returnInner: boundary('open-space-return-wall'), shoulderInner: boundary('open-space-shoulder-wall'),
    stemInner: boundary('open-space-stem-wall'), stemBottom: boundary('lower-stem-terminal-edge')
  };
  if (Object.values(boundaries).some(item => !item) || !boundary('baseline-opening')) throw new Error('The shoulder adapter cannot resolve all semantic boundary identities.');

  const decisions = decisionMap(model);
  const stemWidth = decisions.get(stem.parameters.widthDecisionId);
  const xHeight = decisions.get(shoulder.parameters.xHeightDecisionId);
  const ascender = decisions.get(stem.parameters.ascenderDecisionId);
  const baseline = decisions.get(semanticNode(source, 'anatomy.terminal', 'lower-stem-terminal').parameters.alignmentDecisionId);
  const x0 = source.metrics.leftSideBearing;
  const x1 = source.metrics.advanceWidth - source.metrics.rightSideBearing;
  const innerLeft = x0 + stemWidth;
  const innerRight = x1 - stemWidth;
  const outerControlX = (innerLeft + x1) / 2;
  const innerControlX = (innerLeft + innerRight) / 2;
  const outerControlY = xHeight + xHeight * shoulder.parameters.outerControlRiseRatio;
  const innerEndpointY = Math.round(xHeight * shoulder.parameters.innerEndpointRatio);
  const innerControlY = xHeight + xHeight * shoulder.parameters.innerControlRiseRatio;
  const outerPeakY = (xHeight + outerControlY) / 2;

  if (![x0, x1, stemWidth, xHeight, ascender, baseline, innerEndpointY, outerControlX, innerControlX, outerControlY, innerControlY]
      .every(Number.isInteger) || innerLeft >= innerRight || innerEndpointY <= baseline || innerEndpointY >= xHeight ||
      outerPeakY >= ascender || innerControlY <= innerEndpointY || innerControlY >= ascender) {
    throw new Error('The semantic stem, shoulder, opening, or ascender dimensions cannot form a valid h outline.');
  }
  if (source.metrics.advanceWidth <= x1 || x0 < 0 || x1 > source.metrics.advanceWidth ||
      xHeight >= ascender || stemWidth * 2 >= x1 - x0 || innerRight - innerLeft < stemWidth) {
    throw new Error('The semantic h dimensions collapse the stem, shoulder, or open counter.');
  }
  if (!relationHas(space, 'opens-to', space.parameters.openingBoundaryId)) throw new Error('The counter must remain semantically open to its baseline boundary.');

  const path = new PathBuilder(`${source.id}.stem-shoulder-return`, 'outer', x0, baseline);
  path.line(boundaries.stemOuter.id, x0, ascender)
    .line(boundaries.stemTop.id, innerLeft, ascender)
    .line(boundaries.shoulderEntry.id, innerLeft, xHeight)
    .quad(boundaries.shoulderOuter.id, outerControlX, outerControlY, x1, xHeight)
    .line(boundaries.returnOuter.id, x1, baseline)
    .line(boundaries.returnBottom.id, innerRight, baseline)
    .line(boundaries.returnInner.id, innerRight, innerEndpointY)
    .quad(boundaries.shoulderInner.id, innerControlX, innerControlY, innerLeft, innerEndpointY)
    .line(boundaries.stemInner.id, innerLeft, baseline)
    .line(boundaries.stemBottom.id, x0, baseline);
  const contours = [orientContour(path.close(), 'outer')];
  const glyph = makeGlyphRecord(source, contours, model, space);
  const errors = validateGlyph({ ...glyph, advanceWidth: glyph.metrics.advanceWidth, rightSideBearing: glyph.metrics.rightSideBearing });
  if (errors.length) throw new Error(`Derived lowercase h geometry is invalid: ${errors.join(' ')}`);
  if (glyph.metrics.leftSideBearing !== glyph.bounds.xMin ||
      glyph.metrics.rightSideBearing !== glyph.metrics.advanceWidth - glyph.bounds.xMax) {
    throw new Error('Derived lowercase h side bearings do not agree with its outline bounds.');
  }
  if (glyph.contours.length !== 1 || glyph.contours[0].segments.some(segment => segment.id === space.parameters.openingBoundaryId)) {
    throw new Error('The h opening must remain real negative space connected to the exterior, not a closed counter contour.');
  }
  return glyph;
}

export function sampleDerivedOutline(contour, steps = 64) {
  const points = [];
  for (const segment of contour.segments) {
    for (let index = 0; index <= steps; index++) {
      if (points.length && index === 0) continue;
      const t = index / steps, u = 1 - t;
      if (segment.type === 'line') points.push({
        x: segment.from.x + (segment.to.x - segment.from.x) * t,
        y: segment.from.y + (segment.to.y - segment.from.y) * t
      });
      else points.push({
        x: u * u * segment.from.x + 2 * u * t * segment.control.x + t * t * segment.to.x,
        y: u * u * segment.from.y + 2 * u * t * segment.control.y + t * t * segment.to.y
      });
    }
  }
  return points;
}
