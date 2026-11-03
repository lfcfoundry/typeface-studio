import { createHash } from 'node:crypto';
import { PathBuilder, contourBounds, orientContour, validateGlyph } from '../../../../prototype/src/contours.js';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const extentValues = (extent, params) => ({
  'baseline-to-xHeight': [params['decision:baseline'].value, params['decision:x-height'].value],
  'baseline-to-ascender': [params['decision:baseline'].value, params['decision:ascender-height'].value],
  'descender-to-xHeight': [params['decision:descender-depth'].value, params['decision:x-height'].value]
})[extent];

function part(arrangement, key) { return arrangement.construction.parts[key]; }
function componentFor(arrangement, model, key) {
  const id = part(arrangement, key).componentId;
  const result = model.components.find(item => item.id === id);
  if (!result) throw new Error(`${arrangement.id}: missing component definition ${id}.`);
  return result;
}

function geometryRecord(source, model, contours, sharedValues) {
  const bounds = contourBounds(contours);
  const glyph = {
    id: source.id, name: source.name, character: source.character, unicode: source.unicodes[0], classes: [...source.classes],
    contours, bounds, metrics: structuredClone(source.metrics),
    components: Object.values(source.construction.parts).map(item => ({ id: item.id, componentId: item.componentId, kind: model.components.find(component => component.id === item.componentId).kind })),
    constructionId: `construction:${source.id}`, derivedFromNodeIds: Object.values(source.construction.parts).map(item => item.id),
    constructionHash: hash({ construction: source.construction, sharedValues })
  };
  glyph.metrics.leftSideBearing = bounds.xMin;
  glyph.metrics.rightSideBearing = glyph.metrics.advanceWidth - bounds.xMax;
  return glyph;
}

/** Generic component-arrangement constructor. No glyph-name branch selects geometry. */
export function deriveRelatedGlyph(arrangement, model) {
  const construction = arrangement.construction;
  if (construction.arrangement !== 'single-storey-bowl-stem-counter') throw new Error(`${arrangement.id}: unsupported component arrangement.`);
  const stemSide = construction.placement.stemSide;
  if (!['left', 'right'].includes(stemSide)) throw new Error(`${arrangement.id}: stem side is unresolved.`);
  const shared = model.sharedParameters;
  const parts = construction.parts;
  const relationships = construction.relationships || [];
  const attachment = relationships.find(item => item.type === 'bowl-attached-to-stem');
  const counterContainment = relationships.find(item => item.type === 'counter-contained-in-bowl');
  const counterClosure = relationships.find(item => item.type === 'counter-closed-by-stem');
  const terminalAttachment = relationships.find(item => item.type === 'stem-ended-by-terminals');
  if (!attachment || !counterContainment || !counterClosure || !terminalAttachment ||
      counterContainment.counter !== counterClosure.counter || attachment.stem !== counterClosure.stem ||
      attachment.bowl !== counterContainment.bowl) {
    throw new Error(`${arrangement.id}: bowl, counter, stem, join, and terminal relationships are incomplete or contradictory.`);
  }
  const stemDefinition = componentFor(arrangement, model, attachment.stem);
  const bowlDefinition = componentFor(arrangement, model, attachment.bowl);
  const counterDefinition = componentFor(arrangement, model, counterContainment.counter);
  const terminalDefinition = componentFor(arrangement, model, terminalAttachment.upper);
  const lowerTerminalDefinition = componentFor(arrangement, model, terminalAttachment.lower);
  const upperJoinPart = parts[attachment.upperJoin], lowerJoinPart = parts[attachment.lowerJoin];
  const upperTerminalPart = parts[terminalAttachment.upper], lowerTerminalPart = parts[terminalAttachment.lower];
  const stemPart = parts[attachment.stem], counterPart = parts[counterContainment.counter];
  if (![upperJoinPart, lowerJoinPart, upperTerminalPart, lowerTerminalPart].every(Boolean)) throw new Error(`${arrangement.id}: a relationship references a missing join or terminal part.`);
  const upperJoinDefinition = componentFor(arrangement, model, attachment.upperJoin);
  const lowerJoinDefinition = componentFor(arrangement, model, attachment.lowerJoin);
  if (terminalDefinition.profile !== 'flat' || lowerTerminalDefinition.profile !== 'flat') throw new Error(`${arrangement.id}: this arrangement currently requires flat terminals.`);
  if (upperJoinDefinition.continuity !== 'G1' || lowerJoinDefinition.continuity !== 'G1') {
    throw new Error(`${arrangement.id}: unsupported bowl/stem join continuity.`);
  }
  if (bowlDefinition.profile !== 'half-ellipse' || counterDefinition.kind !== 'anatomy.counter') throw new Error(`${arrangement.id}: unsupported bowl or counter component.`);

  const stemWidth = shared[stemDefinition.widthDecisionId]?.value;
  const baseline = shared['decision:baseline'].value;
  const xHeight = shared['decision:x-height'].value;
  const [stemBottom, stemTop] = extentValues(construction.placement.stemExtent, shared) || [];
  const bowlWidth = Math.round((xHeight - baseline) * bowlDefinition.widthRatio);
  const advance = arrangement.metrics.advanceWidth;
  const inkLeft = arrangement.metrics.leftSideBearing;
  const inkRight = advance - arrangement.metrics.rightSideBearing;
  const stemLeft = stemSide === 'left' ? inkLeft : inkRight - stemWidth;
  const stemRight = stemLeft + stemWidth;
  const bowlLeft = stemSide === 'right' ? stemLeft - bowlWidth : stemRight;
  const bowlRight = bowlLeft + bowlWidth;
  const midY = (baseline + xHeight) / 2;
  const insetX = Math.round(stemWidth * counterDefinition.horizontalInsetRatio);
  const insetY = Math.round(stemWidth * counterDefinition.verticalInsetRatio);
  const counterBottom = baseline + insetY;
  const counterTop = xHeight - insetY;
  const counterLeft = stemSide === 'right' ? bowlLeft + insetX : stemRight;
  const counterRight = stemSide === 'right' ? stemLeft : bowlRight - insetX;

  if (!Number.isInteger(stemWidth) || stemWidth <= 0 || !Number.isInteger(stemTop) || !Number.isInteger(stemBottom) ||
      stemTop < xHeight || stemBottom > baseline || bowlWidth <= stemWidth || bowlLeft < 0 || bowlRight > advance ||
      counterLeft >= counterRight || counterBottom >= midY || counterTop <= midY || counterTop >= xHeight) {
    throw new Error(`${arrangement.id}: shared dimensions or component proportions collapse the glyph construction.`);
  }

  let outer;
  if (stemSide === 'right') {
    const builder = new PathBuilder(`${arrangement.id}.bowl-stem-outer`, 'outer', stemLeft, xHeight);
    if (stemTop > xHeight) builder.line(`${stemPart.id}.inner-ascender`, stemLeft, stemTop);
    builder.line(`${upperTerminalPart.id}.flat-edge`, stemRight, stemTop)
      .line(`${stemPart.id}.outer-edge`, stemRight, stemBottom)
      .line(`${lowerTerminalPart.id}.flat-edge`, stemLeft, stemBottom);
    if (stemBottom < baseline) builder.line(`${stemPart.id}.inner-descender`, stemLeft, baseline);
    builder.quad(`${lowerJoinPart.id}.bowl-arc`, bowlLeft, baseline, bowlLeft, midY)
      .quad(`${upperJoinPart.id}.bowl-arc`, bowlLeft, xHeight, stemLeft, xHeight);
    outer = orientContour(builder.close(), 'outer');
  } else {
    const builder = new PathBuilder(`${arrangement.id}.bowl-stem-outer`, 'outer', stemRight, xHeight);
    builder.quad(`${upperJoinPart.id}.bowl-arc`, bowlRight, xHeight, bowlRight, midY)
      .quad(`${lowerJoinPart.id}.bowl-arc`, bowlRight, baseline, stemRight, baseline);
    if (stemBottom < baseline) builder.line(`${stemPart.id}.inner-descender`, stemRight, stemBottom);
    builder.line(`${lowerTerminalPart.id}.flat-edge`, stemLeft, stemBottom)
      .line(`${stemPart.id}.outer-edge`, stemLeft, stemTop)
      .line(`${upperTerminalPart.id}.flat-edge`, stemRight, stemTop);
    if (stemTop > xHeight) builder.line(`${stemPart.id}.inner-ascender`, stemRight, xHeight);
    outer = orientContour(builder.close(), 'outer');
  }

  let counter;
  if (stemSide === 'right') {
    const builder = new PathBuilder(`${arrangement.id}.bowl-counter`, 'counter', stemLeft, counterBottom);
    builder.line(`${stemPart.id}.counter-wall`, stemLeft, counterTop)
      .quad(`${counterPart.id}.upper-arc`, counterLeft, counterTop, counterLeft, midY)
      .quad(`${counterPart.id}.lower-arc`, counterLeft, counterBottom, stemLeft, counterBottom);
    counter = orientContour(builder.close(), 'counter');
  } else {
    const builder = new PathBuilder(`${arrangement.id}.bowl-counter`, 'counter', stemRight, counterTop);
    builder.line(`${stemPart.id}.counter-wall`, stemRight, counterBottom)
      .quad(`${counterPart.id}.lower-arc`, counterRight, counterBottom, counterRight, midY)
      .quad(`${counterPart.id}.upper-arc`, counterRight, counterTop, stemRight, counterTop);
    counter = orientContour(builder.close(), 'counter');
  }

  const values = Object.fromEntries(Object.entries(shared).map(([key, value]) => [key, value.value]));
  const glyph = geometryRecord(arrangement, model, [outer, counter], values);
  const geometryErrors = validateGlyph({ ...glyph, advanceWidth: glyph.metrics.advanceWidth, rightSideBearing: glyph.metrics.rightSideBearing });
  if (geometryErrors.length) throw new Error(`${arrangement.id}: invalid derived contours: ${geometryErrors.join(' ')}`);
  if (glyph.metrics.leftSideBearing !== glyph.bounds.xMin || glyph.metrics.rightSideBearing !== glyph.metrics.advanceWidth - glyph.bounds.xMax) {
    throw new Error(`${arrangement.id}: derived metrics disagree with geometry bounds.`);
  }
  return glyph;
}

export function deriveRelatedGlyphs(model, arrangements = model.glyphs) {
  return Object.fromEntries(arrangements.map(arrangement => [arrangement.id, deriveRelatedGlyph(arrangement, model)]));
}
