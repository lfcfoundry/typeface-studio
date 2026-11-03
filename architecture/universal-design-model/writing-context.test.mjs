import test from 'node:test';
import assert from 'node:assert/strict';
import { lowercaseHeartUppercasePreserved, lowercaseReflectionWithExceptions } from './fixtures.mjs';
import {
  arabicHorizontalRtl, horizontalAndVerticalMetrics, japaneseVerticalMixedOrientation, latinHorizontalLtr,
  mixedDirectionParagraph, mongolianVerticalLtrColumns, multiCodePointToSingleGlyphShaping,
  sharedConstructionVerticalAlternate, writingContextExamples
} from './writing-context.fixtures.mjs';

const directions = new Set(['ltr', 'rtl', 'ttb', 'btt']);
const progressions = new Set(['top-to-bottom', 'bottom-to-top', 'right-to-left', 'left-to-right']);
const orientationResults = new Set(['upright', 'sideways-clockwise', 'sideways-counterclockwise', 'font-vertical-alternate', 'context-dependent', 'user-override']);

function validateLayoutContext(context) {
  const errors = [];
  const paragraph = context?.paragraph;
  if (!['horizontal', 'vertical'].includes(paragraph?.writingMode)) errors.push('invalid writing mode');
  if (!progressions.has(paragraph?.blockProgression)) errors.push('invalid block progression');
  if (paragraph?.writingMode === 'horizontal' && ['left-to-right', 'right-to-left'].includes(paragraph.blockProgression)) errors.push('block progression is parallel to horizontal inline axis');
  if (paragraph?.writingMode === 'vertical' && ['top-to-bottom', 'bottom-to-top'].includes(paragraph.blockProgression)) errors.push('block progression is parallel to vertical inline axis');
  if (!['ltr', 'rtl', 'auto'].includes(paragraph?.baseDirection)) errors.push('invalid paragraph base direction');
  for (const run of context?.runs || []) {
    if (!directions.has(run.direction)) errors.push(`invalid resolved direction in ${run.id}`);
    if (run.directionSource === 'unresolved' || run.direction === 'auto') errors.push(`unresolved run direction in ${run.id}`);
    const results = (run.orientationPolicy?.overrides || []).map(item => item.result);
    if (results.some(result => !orientationResults.has(result))) errors.push(`invalid orientation in ${run.id}`);
    const byRange = new Map();
    for (const item of run.orientationPolicy?.overrides || []) {
      const key = `${item.sourceRange?.unit}:${item.sourceRange?.start}:${item.sourceRange?.end}`;
      const prior = byRange.get(key);
      if (prior && prior !== item.result && !item.precedence) errors.push(`contradictory orientation overrides in ${run.id}`);
      byRange.set(key, item.result);
    }
  }
  return errors;
}

function validateWritingSupport(support) {
  const errors = [];
  if (support?.version !== 1 || !support.unicodeDataVersion) errors.push('missing writing-support version metadata');
  const glyphIds = new Set((support?.glyphs || []).map(glyph => glyph.id));
  if (glyphIds.size !== (support?.glyphs || []).length) errors.push('duplicate glyph identity');
  for (const mapping of support?.characterMappings || []) {
    if (!Number.isInteger(mapping.codePoint) || mapping.codePoint < 0 || mapping.codePoint > 0x10ffff || (mapping.codePoint >= 0xd800 && mapping.codePoint <= 0xdfff)) errors.push('invalid Unicode scalar mapping');
    if (!glyphIds.has(mapping.glyphId)) errors.push(`mapping references unknown glyph ${mapping.glyphId}`);
  }
  for (const form of support?.glyphForms || []) {
    if (!glyphIds.has(form.glyphId) || !glyphIds.has(form.formOfGlyphId)) errors.push('glyph form references unknown glyph');
    if (form.glyphId === form.formOfGlyphId) errors.push('alternate form must have distinct glyph identity');
  }
  for (const metric of support?.glyphMetrics || []) {
    if (!glyphIds.has(metric.glyphId)) errors.push(`metrics reference unknown glyph ${metric.glyphId}`);
    if (metric.horizontal && !Number.isFinite(metric.horizontal.advance)) errors.push('invalid horizontal advance');
    if (metric.vertical && !Number.isFinite(metric.vertical.advanceHeight)) errors.push('invalid vertical advance');
  }
  for (const rule of support?.shapingRules?.substitutions || []) {
    if (!rule.inputGlyphIds?.length || !rule.outputGlyphIds?.length) errors.push(`empty shaping sequence in ${rule.id}`);
    if ([...(rule.inputGlyphIds || []), ...(rule.outputGlyphIds || [])].some(id => !glyphIds.has(id))) errors.push(`unknown glyph reference in ${rule.id}`);
    if (!rule.scriptTag || !rule.featureTag) errors.push(`missing shaping conditions in ${rule.id}`);
  }
  return errors;
}

test('all eight writing-context fixtures validate while keeping layout requests outside font-design behavior', () => {
  assert.equal(writingContextExamples.length, 8);
  for (const fixture of writingContextExamples) {
    if (fixture.writingSupport) assert.deepEqual(validateWritingSupport(fixture.writingSupport), [], 'writing support fixture');
    if (fixture.layoutContext) assert.deepEqual(validateLayoutContext(fixture.layoutContext), [], fixture.layoutContext.id);
  }
});

test('script, language, direction, writing mode, and block/column progression are independent fields', () => {
  assert.deepEqual(latinHorizontalLtr.layoutContext.runs[0] && {
    script: latinHorizontalLtr.layoutContext.runs[0].scriptTag,
    language: latinHorizontalLtr.layoutContext.runs[0].languageTag,
    direction: latinHorizontalLtr.layoutContext.runs[0].direction,
    mode: latinHorizontalLtr.layoutContext.paragraph.writingMode,
    progression: latinHorizontalLtr.layoutContext.paragraph.blockProgression
  }, { script: 'Latn', language: 'en', direction: 'ltr', mode: 'horizontal', progression: 'top-to-bottom' });
  assert.equal(arabicHorizontalRtl.layoutContext.runs[0].scriptTag, 'Arab');
  assert.equal(arabicHorizontalRtl.layoutContext.runs[0].languageTag, 'ar');
  assert.equal(arabicHorizontalRtl.layoutContext.runs[0].direction, 'rtl');
  assert.equal(arabicHorizontalRtl.layoutContext.paragraph.writingMode, 'horizontal');
  assert.equal(japaneseVerticalMixedOrientation.layoutContext.paragraph.blockProgression, 'right-to-left');
  assert.equal(mongolianVerticalLtrColumns.layoutContext.paragraph.blockProgression, 'left-to-right');
  assert.equal(japaneseVerticalMixedOrientation.layoutContext.paragraph.writingMode, 'vertical');
  assert.equal(mongolianVerticalLtrColumns.layoutContext.runs[0].direction, 'ttb');
});

test('Japanese vertical text can mix upright, sideways, and font-alternate orientation without changing writing mode', () => {
  const runs = japaneseVerticalMixedOrientation.layoutContext.runs;
  assert.deepEqual(runs.map(run => run.orientationPolicy.overrides[0].result), ['upright', 'sideways-clockwise', 'font-vertical-alternate']);
  assert.ok(runs.every(run => run.direction === 'ttb' || run.direction === 'ltr'));
  assert.equal(japaneseVerticalMixedOrientation.layoutContext.paragraph.writingMode, 'vertical');
  const support = japaneseVerticalMixedOrientation.writingSupport;
  assert.ok(support.shapingRules.substitutions.some(rule => rule.featureTag === 'vert'));
  assert.ok(!runs.some(run => run.features.some(feature => feature.tag === 'vrt2') && run.features.some(feature => feature.tag === 'vert')));
});

test('glyph identities, Unicode mappings, presentation alternates, and semantic construction references stay distinct', () => {
  const support = sharedConstructionVerticalAlternate.writingSupport;
  const form = support.glyphForms[0];
  assert.notEqual(form.glyphId, form.formOfGlyphId);
  assert.equal(form.semanticConstructionId, 'construction:ideographic-comma');
  assert.equal(support.glyphs.find(glyph => glyph.id === form.glyphId).unicodes.length, 0);
  assert.ok(support.characterMappings.some(mapping => mapping.codePoint === 0x3001 && mapping.glyphId === form.formOfGlyphId));
});

test('Arabic shaping records contextual joining and codepoint sequences independently of bidi direction', () => {
  const support = arabicHorizontalRtl.writingSupport;
  const contextual = support.shapingRules.substitutions.filter(rule => rule.kind === 'contextual-substitution');
  assert.deepEqual(contextual.map(rule => rule.featureTag), ['init', 'medi', 'fina']);
  assert.ok(contextual.every(rule => rule.scriptTag === 'Arab' && rule.languageTags.includes('ar')));
  const ligature = support.shapingRules.substitutions.find(rule => rule.id === 'rule:arabic-lam-alef');
  assert.equal(ligature.inputGlyphIds.length, 2);
  assert.equal(ligature.outputGlyphIds.length, 1);
  assert.equal(arabicHorizontalRtl.layoutContext.paragraph.baseDirection, 'rtl');
  assert.equal(arabicHorizontalRtl.layoutContext.runs[0].direction, 'rtl');
});

test('horizontal and vertical metrics coexist and vertical fallback is explicit', () => {
  const metric = horizontalAndVerticalMetrics.writingSupport.glyphMetrics[0];
  assert.ok(metric.horizontal.advance > 0);
  assert.ok(metric.vertical.advanceHeight > 0);
  assert.deepEqual(metric.vertical.origin, { x: 500, y: 880 });
  assert.equal(horizontalAndVerticalMetrics.writingSupport.metricFallback.vertical, 'unresolved-until-policy-selected');
});

test('a multi-codepoint input may shape to a different glyph count and retains its source cluster range', () => {
  const example = multiCodePointToSingleGlyphShaping.shapingExample;
  const rule = multiCodePointToSingleGlyphShaping.writingSupport.shapingRules.substitutions[0];
  assert.equal(example.inputCodePoints.length, 2);
  assert.equal(rule.inputGlyphIds.length, 2);
  assert.equal(example.outputGlyphIds.length, 1);
  assert.deepEqual(example.sourceRange, { unit: 'utf16', start: 0, end: 2 });
});

test('mixed-direction paragraphs retain logical ranges and per-run direction, script, and language', () => {
  const { layoutContext } = mixedDirectionParagraph;
  assert.equal(layoutContext.paragraph.baseDirection, 'ltr');
  assert.deepEqual(layoutContext.runs.map(run => [run.scriptTag, run.languageTag, run.direction]), [['Latn', 'en', 'ltr'], ['Arab', 'ar', 'rtl']]);
  assert.deepEqual(layoutContext.runs.map(run => [run.sourceRange.start, run.sourceRange.end]), [[0, 6], [6, 11]]);
});

test('contradictory axes, unresolved run directions, conflicting orientations, and invalid mappings are rejected', () => {
  const parallel = structuredClone(latinHorizontalLtr.layoutContext);
  parallel.paragraph.blockProgression = 'left-to-right';
  assert.ok(validateLayoutContext(parallel).some(error => /parallel/u.test(error)));
  const unresolved = structuredClone(latinHorizontalLtr.layoutContext);
  unresolved.runs[0].direction = 'auto';
  assert.ok(validateLayoutContext(unresolved).some(error => /resolved direction/u.test(error)));
  const orientationConflict = structuredClone(japaneseVerticalMixedOrientation.layoutContext);
  orientationConflict.runs[0].orientationPolicy.overrides.push({ ...orientationConflict.runs[0].orientationPolicy.overrides[0], result: 'sideways-clockwise' });
  assert.ok(validateLayoutContext(orientationConflict).some(error => /contradictory orientation/u.test(error)));
  const badMapping = structuredClone(latinHorizontalLtr.writingSupport);
  badMapping.characterMappings.push({ codePoint: 0xd800, glyphId: 'glyph:missing' });
  assert.ok(validateWritingSupport(badMapping).some(error => /Unicode scalar/u.test(error)));
  assert.ok(validateWritingSupport(badMapping).some(error => /unknown glyph/u.test(error)));
});

test('existing Latin heart and reflection architecture fixtures retain their original v2 meaning', () => {
  assert.equal(lowercaseHeartUppercasePreserved.schemaVersion, 2);
  assert.equal(lowercaseHeartUppercasePreserved.operations[0].type, 'substitute.glyph');
  assert.equal(lowercaseHeartUppercasePreserved.selectors.find(selector => selector.id === 'sel:lowercase-o').resolution.includedGlyphIds[0], 'glyph:o');
  assert.equal(lowercaseReflectionWithExceptions.operations[0].type, 'geometry.reflect');
  assert.deepEqual(lowercaseReflectionWithExceptions.selectors[0].exclude.map(item => item.value), ['glyph:b', 'glyph:d']);
});
