import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShapingRequest } from './shaping-request-adapter.mjs';
import {
  acceptedDesignSnapshot, arabicRequestContext, horizontalJapaneseContext, japaneseRequestContext,
  latinRequestContext, mixedResolvedContext, mongolianRequestContext, unresolvedMixedContext
} from './shaping-request.fixtures.mjs';
import { lowercaseHeartUppercasePreserved, lowercaseReflectionWithExceptions } from './fixtures.mjs';

const build = (layoutContext, designSnapshot = acceptedDesignSnapshot) => buildShapingRequest({ designSnapshot, layoutContext, sourceEncoding: 'UTF-16' });
const codes = result => result.diagnostics.map(item => item.code);

test('Latin horizontal request carries input, font revision, source range, features, and horizontal metrics without shaped glyph output', () => {
  const result = build(latinRequestContext);
  assert.equal(result.status, 'ready');
  const request = result.request;
  assert.equal(request.type, 'lfcfoundry.shaping-request');
  assert.equal(request.version, 1);
  assert.deepEqual(request.font, { designId: acceptedDesignSnapshot.designId, revisionId: acceptedDesignSnapshot.revisionId, familyName: acceptedDesignSnapshot.familyName, artifactId: null });
  assert.deepEqual(request.source, { text: 'fi', encoding: 'UTF-16', indexUnit: 'utf16' });
  assert.deepEqual(request.runs[0].source, { text: 'fi', sourceRange: { unit: 'utf16', start: 0, end: 2 }, encoding: 'UTF-16', codePoints: [0x66, 0x69] });
  assert.deepEqual(request.runs[0].sourceClusters, [
    { clusterId: 'source:f', sourceRange: { unit: 'utf16', start: 0, end: 1 } },
    { clusterId: 'source:i', sourceRange: { unit: 'utf16', start: 1, end: 2 } }
  ]);
  assert.equal(request.runs[0].direction.value, 'ltr');
  assert.equal(request.runs[0].requiredMetricCapabilities[0], 'horizontal-metrics');
  assert.equal(request.execution.status, 'not-performed');
  assert.equal(request.execution.shapedGlyphs, null);
  assert.ok(request.execution.requiredExternalCapabilities.some(item => item.capability === 'font-shaping-engine'));
});

test('Arabic RTL request preserves supplied script, language, direction, and contextual-joining requirement without resolving forms', () => {
  const result = build(arabicRequestContext);
  assert.equal(result.status, 'ready');
  const run = result.request.runs[0];
  assert.deepEqual([run.scriptTag, run.languageTag, run.direction.value], ['Arab', 'ar', 'rtl']);
  assert.ok(run.requiredShapingCapabilities.includes('contextual-joining'));
  assert.deepEqual(run.nominalMappingPreflight.map(item => item.glyphId), ['glyph:beh', 'glyph:lam', 'glyph:alef']);
  assert.equal(result.request.execution.shapedGlyphs, null);
  assert.ok(!Object.hasOwn(run, 'shapedGlyphs'));
});

test('mixed Latin and Arabic contexts become separate requests with preserved logical source positions and upstream bidi provenance', () => {
  const result = build(mixedResolvedContext);
  assert.equal(result.status, 'ready');
  assert.equal(result.request.paragraph.baseDirection, 'ltr');
  assert.deepEqual(result.request.runs.map(run => [run.scriptTag, run.languageTag, run.direction.value]), [['Latn', 'en', 'ltr'], ['Arab', 'ar', 'rtl']]);
  assert.deepEqual(result.request.runs.map(run => run.source.sourceRange), [{ unit: 'utf16', start: 0, end: 1 }, { unit: 'utf16', start: 1, end: 2 }]);
  assert.deepEqual(result.request.runs.map(run => run.source.text), ['A', 'ب']);
  assert.equal(result.request.paragraph.bidiResolution.resolverId, 'fixture:upstream-bidi');
  assert.equal(result.request.execution.requiredExternalCapabilities.find(item => item.capability === 'paragraph-bidi-resolver').status, 'resolved-upstream-not-run-here');
});

test('mixed text without resolved run directions returns unresolved and does not guess', () => {
  const result = build(unresolvedMixedContext);
  assert.equal(result.status, 'unresolved');
  assert.equal(result.request, null);
  assert.ok(codes(result).includes('direction-unresolved'));
  assert.ok(codes(result).includes('bidi-resolution-required'));
});

test('Japanese vertical request preserves column progression, TTB direction, orientation policy, and supported vertical features', () => {
  const result = build(japaneseRequestContext);
  assert.equal(result.status, 'ready');
  assert.equal(result.request.paragraph.writingMode, 'vertical');
  assert.equal(result.request.paragraph.blockProgression, 'right-to-left');
  assert.deepEqual(result.request.runs.map(run => run.direction.value), ['ttb', 'ltr', 'ttb']);
  assert.deepEqual(result.request.runs.map(run => run.features[0].tag), ['vert', 'vrt2', 'vert']);
  assert.deepEqual(result.request.runs.map(run => run.orientationPolicy.mode), ['unicode-vertical-orientation', 'sideways-run', 'unicode-vertical-orientation']);
  assert.ok(result.request.runs.every(run => run.requiredMetricCapabilities.includes('vertical-metrics')));
  assert.ok(result.request.execution.requiredExternalCapabilities.some(item => item.capability === 'vertical-orientation-and-placement-policy'));
  assert.equal(result.request.execution.status, 'not-performed');
});

test('Traditional Mongolian keeps TTB run direction distinct from LTR column progression and requires vertical metrics', () => {
  const result = build(mongolianRequestContext);
  assert.equal(result.status, 'ready');
  assert.equal(result.request.paragraph.writingMode, 'vertical');
  assert.equal(result.request.paragraph.blockProgression, 'left-to-right');
  assert.equal(result.request.runs[0].direction.value, 'ttb');
  assert.equal(result.request.runs[0].languageTag, 'mn');
  assert.ok(result.request.runs[0].requiredMetricCapabilities.includes('vertical-metrics'));
  assert.ok(result.request.runs[0].requiredShapingCapabilities.includes('contextual-joining'));
});

test('missing vertical metrics, vertical alternates, script support, language, direction, and feature support are explicit unresolved results', () => {
  const noMetrics = structuredClone(acceptedDesignSnapshot);
  noMetrics.writingSupport.glyphMetrics = noMetrics.writingSupport.glyphMetrics.filter(item => item.glyphId !== 'glyph:uni65E5');
  assert.ok(codes(build(japaneseRequestContext, noMetrics)).includes('vertical-metrics-unavailable'));

  const noAlternate = structuredClone(acceptedDesignSnapshot);
  noAlternate.writingSupport.shapingRules.substitutions = noAlternate.writingSupport.shapingRules.substitutions.filter(item => item.id !== 'rule:A-vrt2');
  assert.ok(codes(build(japaneseRequestContext, noAlternate)).includes('vertical-alternate-unavailable'));

  const noScript = structuredClone(acceptedDesignSnapshot);
  noScript.writingSupport.scripts = noScript.writingSupport.scripts.filter(item => item.scriptTag !== 'Mong');
  assert.ok(codes(build(mongolianRequestContext, noScript)).includes('script-not-registered'));

  const noLanguage = structuredClone(latinRequestContext);
  noLanguage.runs[0].languageTag = null;
  assert.ok(codes(build(noLanguage)).includes('language-unresolved'));

  const noDirection = structuredClone(latinRequestContext);
  noDirection.runs[0].direction = 'auto';
  assert.ok(codes(build(noDirection)).includes('direction-unresolved'));

  const noFeature = structuredClone(latinRequestContext);
  noFeature.runs[0].features = [{ tag: 'ss20', value: 1 }];
  assert.ok(codes(build(noFeature)).includes('feature-capability-unknown'));

  const noHorizontalMetrics = structuredClone(acceptedDesignSnapshot);
  const latinGlyph = noHorizontalMetrics.writingSupport.characterMappings.find(item => item.codePoint === 0x66).glyphId;
  noHorizontalMetrics.writingSupport.glyphMetrics.find(item => item.glyphId === latinGlyph).horizontal.endSideBearing = null;
  assert.ok(codes(build(latinRequestContext, noHorizontalMetrics)).includes('horizontal-metrics-unavailable'));

  const danglingMapping = structuredClone(acceptedDesignSnapshot);
  danglingMapping.writingSupport.characterMappings.find(item => item.codePoint === 0x66).glyphId = 'glyph:not-registered';
  assert.ok(codes(build(latinRequestContext, danglingMapping)).includes('character-mapping-dangling'));
});

test('unregistered variation axes and unsupported features do not silently fall back', () => {
  const context = structuredClone(latinRequestContext);
  context.runs[0].variations = [{ tag: 'wght', value: 700 }];
  assert.ok(codes(build(context)).includes('unsupported-variation-setting'));
  const design = structuredClone(acceptedDesignSnapshot);
  design.writingSupport.scripts.find(item => item.scriptTag === 'Latn').features.find(item => item.tag === 'liga').status = 'unsupported';
  assert.ok(codes(build(latinRequestContext, design)).includes('feature-unsupported'));

  const variableDesign = structuredClone(acceptedDesignSnapshot);
  variableDesign.variationAxes = [{ tag: 'wght', min: 100, default: 400, max: 900 }];
  context.runs[0].variations = [{ tag: 'wght', value: 700 }];
  const variableRequest = build(context, variableDesign);
  assert.equal(variableRequest.status, 'ready');
  assert.deepEqual(variableRequest.request.runs[0].variations, [{ tag: 'wght', value: 700 }]);
});

test('same accepted construction can request horizontal and vertical presentations without mutating design state', () => {
  const before = JSON.stringify(acceptedDesignSnapshot);
  const horizontal = build(horizontalJapaneseContext);
  const vertical = build(japaneseRequestContext);
  assert.equal(horizontal.status, 'ready');
  assert.equal(vertical.status, 'ready');
  const shared = acceptedDesignSnapshot.writingSupport.glyphForms.find(form => form.glyphId === 'glyph:uni3001.vert');
  assert.equal(shared.semanticConstructionId, 'construction:uni3001');
  assert.equal(horizontal.request.font.revisionId, vertical.request.font.revisionId);
  assert.equal(JSON.stringify(acceptedDesignSnapshot), before);
});

test('direction-independent heart and reflection decisions retain their meaning and are not rewritten by request construction', () => {
  const heartBefore = JSON.stringify(lowercaseHeartUppercasePreserved);
  const reflectionBefore = JSON.stringify(lowercaseReflectionWithExceptions);
  const horizontal = build(latinRequestContext);
  const vertical = build(japaneseRequestContext);
  assert.equal(horizontal.status, 'ready');
  assert.equal(vertical.status, 'ready');
  assert.equal(lowercaseHeartUppercasePreserved.operations[0].type, 'substitute.glyph');
  assert.equal(lowercaseReflectionWithExceptions.operations[0].type, 'geometry.reflect');
  assert.equal(JSON.stringify(lowercaseHeartUppercasePreserved), heartBefore);
  assert.equal(JSON.stringify(lowercaseReflectionWithExceptions), reflectionBefore);
});

test('unaccepted or unvalidated design snapshots are not used to build requests', () => {
  const draft = structuredClone(acceptedDesignSnapshot);
  draft.status = 'candidate';
  const result = build(latinRequestContext, draft);
  assert.equal(result.status, 'unresolved');
  assert.equal(result.request, null);
  assert.ok(codes(result).includes('design-snapshot-not-accepted'));
});
