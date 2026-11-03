import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateGlyph } from '../../../../../prototype/src/contours.js';
import { parseFont } from 'fontsketch/core';
import { buildLowercaseACandidate } from '../../a-experiment.mjs';
import { glyphGeometryHash } from '../../geometry.mjs';
import {
  buildRelatedGlyphCandidate, compileRelatedGlyphFont, createRelatedGlyphExperiment, deriveRelatedGlyph,
  deriveRelatedGlyphs, initializeRelatedExperiment, validateRelatedDesign
} from '../experiment.mjs';

function glyphByName(model, name) { return model.glyphs.find(glyph => glyph.name === name); }
function geometryByName(model, name) {
  const source = glyphByName(model, name);
  return model.derived.geometry.glyphs[source.id];
}
function flatEdgeWidth(glyph, role) {
  const segment = glyph.contours[0].segments.find(item => item.id.includes(role) && item.id.endsWith('flat-edge'));
  assert.ok(segment, `missing ${role} flat terminal`);
  return Math.abs(segment.to.x - segment.from.x);
}

test('component definitions are shared while glyph arrangements state stem side and extent independently', () => {
  const accepted = initializeRelatedExperiment();
  assert.deepEqual(validateRelatedDesign(accepted), []);
  assert.deepEqual(accepted.components.map(item => item.kind), ['anatomy.bowl', 'anatomy.counter', 'anatomy.stem', 'anatomy.join', 'anatomy.terminal']);
  assert.deepEqual(accepted.glyphs.map(glyph => [glyph.name, glyph.construction.placement.stemSide, glyph.construction.placement.stemExtent]), [
    ['a', 'right', 'baseline-to-xHeight']
  ]);
  const candidate = buildRelatedGlyphCandidate(accepted);
  assert.deepEqual(candidate.model.glyphs.map(glyph => [glyph.name, glyph.construction.placement.stemSide, glyph.construction.placement.stemExtent]), [
    ['a', 'right', 'baseline-to-xHeight'], ['b', 'left', 'baseline-to-ascender'], ['d', 'right', 'baseline-to-ascender'],
    ['p', 'left', 'descender-to-xHeight'], ['q', 'right', 'descender-to-xHeight']
  ]);
  for (const glyph of candidate.model.glyphs) {
    assert.equal(glyph.construction.arrangement, 'single-storey-bowl-stem-counter');
    assert.equal(new Set(Object.values(glyph.construction.parts).map(part => part.componentId)).size, 5);
    assert.deepEqual(glyph.construction.relationships.map(item => item.type), [
      'bowl-attached-to-stem', 'counter-contained-in-bowl', 'counter-closed-by-stem', 'stem-ended-by-terminals'
    ]);
  }
});

test('one generic arrangement constructor creates deterministic, valid counters and contours for a b d p q', () => {
  const accepted = initializeRelatedExperiment();
  const candidate = buildRelatedGlyphCandidate(accepted);
  const first = deriveRelatedGlyphs(candidate.model);
  const second = deriveRelatedGlyphs(candidate.model);
  assert.deepEqual(first, second);
  for (const glyph of candidate.model.glyphs) {
    const derived = first[glyph.id];
    assert.equal(derived.contours.length, 2, `${glyph.name} should have outer and counter contours`);
    assert.deepEqual(derived.contours.map(contour => contour.role), ['outer', 'counter']);
    assert.ok(derived.contours.every(contour => contour.closed && contour.points.length >= 4));
    assert.deepEqual(validateGlyph({ ...derived, advanceWidth: derived.metrics.advanceWidth, rightSideBearing: derived.metrics.rightSideBearing }), []);
    assert.deepEqual(derived.unicode, glyph.unicodes[0]);
    assert.deepEqual(derived.bounds, {
      xMin: 55,
      xMax: 595,
      yMin: ['p', 'q'].includes(glyph.name) ? -200 : 0,
      yMax: ['b', 'd'].includes(glyph.name) ? 700 : 500
    });
  }
});

test('geometry follows semantic relationship references and rejects contradictory anatomy links', () => {
  const model = buildRelatedGlyphCandidate(initializeRelatedExperiment()).model;
  const b = glyphByName(model, 'b');
  const expected = deriveRelatedGlyph(b, model);
  const relationships = b.construction.relationships;
  const closure = relationships.find(item => item.type === 'counter-closed-by-stem');
  closure.stem = 'bowl';
  assert.throws(() => deriveRelatedGlyph(b, model), /relationships are incomplete or contradictory/);
  closure.stem = 'stem';

  const attachment = relationships.find(item => item.type === 'bowl-attached-to-stem');
  attachment.upperJoin = 'missingJoin';
  assert.throws(() => deriveRelatedGlyph(b, model), /relationship references a missing join/);
  attachment.upperJoin = 'upperJoin';
  assert.deepEqual(deriveRelatedGlyph(b, model), expected);
});

test('generic lowercase a exactly reproduces the established a outline and metrics', () => {
  const related = initializeRelatedExperiment();
  const original = buildLowercaseACandidate();
  const expected = original.model.derived.geometry.glyphs['glyph:u0061'];
  const actual = geometryByName(related, 'a');
  assert.deepEqual(actual.contours, expected.contours);
  assert.deepEqual(actual.bounds, expected.bounds);
  assert.deepEqual(actual.metrics, expected.metrics);
  assert.equal(actual.unicode, 0x0061);
});

test('stem side, ascender/descender reach, shared width, and horizontal metrics are consistent', () => {
  const candidate = buildRelatedGlyphCandidate(initializeRelatedExperiment());
  for (const name of ['a', 'b', 'd', 'p', 'q']) {
    const glyph = geometryByName(candidate.model, name);
    assert.equal(flatEdgeWidth(glyph, 'upper-terminal'), 90, `${name}: upper terminal width must match shared stem width`);
    assert.equal(flatEdgeWidth(glyph, 'lower-terminal'), 90, `${name}: lower terminal width must match shared stem width`);
    assert.deepEqual(glyph.metrics, { advanceWidth: 650, leftSideBearing: 55, rightSideBearing: 55 });
  }
  const widened = structuredClone(candidate.model);
  widened.sharedParameters['decision:shared-stem-width'].value = 100;
  for (const glyph of widened.glyphs) {
    const result = deriveRelatedGlyph(glyph, widened);
    assert.equal(flatEdgeWidth(result, 'upper-terminal'), 100);
    assert.equal(flatEdgeWidth(result, 'lower-terminal'), 100);
  }
});

test('adding b d p q creates a candidate revision and leaves accepted a and its source model unchanged', () => {
  const accepted = initializeRelatedExperiment();
  const acceptedBefore = JSON.stringify(accepted);
  const referenceGlyphsBefore = structuredClone(accepted.referenceModel.derived.geometry.glyphs);
  const candidate = buildRelatedGlyphCandidate(accepted);
  assert.equal(JSON.stringify(accepted), acceptedBefore);
  assert.equal(candidate.status, 'candidate');
  assert.equal(candidate.model.revisions.acceptedRevisionId, accepted.revisions.acceptedRevisionId);
  assert.equal(candidate.model.revisions.headRevisionId, candidate.revision.id);
  assert.deepEqual(candidate.revision.changedGlyphIds, ['glyph:u0062', 'glyph:u0064', 'glyph:u0070', 'glyph:u0071']);
  assert.deepEqual(candidate.revision.preservedGlyphIds, ['glyph:u0061']);
  assert.equal(glyphGeometryHash(geometryByName(candidate.model, 'a')), glyphGeometryHash(geometryByName(accepted, 'a')));
  assert.deepEqual(candidate.revision.operationIds, ['op:add-b', 'op:add-d', 'op:add-p', 'op:add-q']);
  assert.deepEqual(candidate.model.referenceModel.derived.geometry.glyphs, referenceGlyphsBefore,
    'the original o, n, H, and a reference geometries must remain byte-structure-identical');
});

test('related glyph font compiles all mappings and preserves the reference a outline', () => {
  const candidate = buildRelatedGlyphCandidate(initializeRelatedExperiment());
  const first = compileRelatedGlyphFont(candidate.model);
  const second = compileRelatedGlyphFont(candidate.model);
  assert.deepEqual(first.bytes, second.bytes);
  assert.equal(first.audit.valid, true);
  assert.deepEqual(first.audit.missingTables, []);
  assert.equal(first.audit.numGlyphs, 7);
  const parsed = parseFont(first.bytes);
  for (const [name, unicode] of [['a', 0x0061], ['b', 0x0062], ['d', 0x0064], ['p', 0x0070], ['q', 0x0071]]) {
    assert.deepEqual(parsed.glyphs[name].unicodes, [unicode]);
    assert.equal(parsed.glyphs[name].advanceWidth, 650);
    assert.equal(parsed.glyphs[name].contours.length, 2);
  }
  const oldA = buildLowercaseACandidate().model.derived.geometry.glyphs['glyph:u0061'];
  assert.deepEqual(candidate.model.derived.geometry.glyphs['glyph:u0061'].contours, oldA.contours);
});

test('an unsupported stem extent or missing component reference is rejected instead of silently normalized', () => {
  const model = createRelatedGlyphExperiment();
  const invalidExtent = structuredClone(model);
  invalidExtent.glyphs[0].construction.placement.stemExtent = 'automatic';
  assert.ok(validateRelatedDesign(invalidExtent).some(error => error.includes('stem extent must be explicit')));
  const invalidPart = structuredClone(model);
  invalidPart.glyphs[0].construction.parts.counter.componentId = 'component:missing';
  assert.ok(validateRelatedDesign(invalidPart).some(error => error.includes('missing or unknown counter component')));
});

test('all pre-existing construction TTFs and review pages retain their recorded hashes', () => {
  const base = resolve(import.meta.dirname, '../../artifacts');
  const expected = {
    'LFCFoundry-Semantic-Construction-Base.ttf': 'f94fcae18a65a32d3f486d7f4fa652826c8f87832a79a3eae02bff76e9473824',
    'LFCFoundry-Semantic-Construction-Open-Counter.ttf': '00065a4210071d36ecaf4f25ed7808fb74ee04f665627f0f204e4c6131492018',
    'LFCFoundry-Semantic-Construction-Smooth-N-Current-H.ttf': 'b1ef7eaabdd7b134d11cfbafd7bc5dc88653ac8d08faaaefd27c88ef3ab18fad',
    'LFCFoundry-Semantic-Construction-Smooth-N-H-Midpoint.ttf': '3587987a2da0ceb674e1244485254943d2ec8ed608e9424db693cb35250cbbdd',
    'LFCFoundry-Semantic-Construction-Smooth-N-H-Low-0_48.ttf': 'cbce373331f70deb77b793848631f877dbb86582c0640fa3945d9cdfebfa0eb6',
    'LFCFoundry-Semantic-Construction-Lowercase-A-Experiment.ttf': '2ba88fbe348e2c3f770c9744e569c7fdbf5fe17d01d0873d9db5fd85ad81f50c'
  };
  for (const [filename, expectedHash] of Object.entries(expected)) {
    const actual = createHash('sha256').update(readFileSync(resolve(base, filename))).digest('hex');
    assert.equal(actual, expectedHash, `${filename} must remain untouched`);
  }
  const pageHashes = {
    'lowercase-a-review.html': 'b90c2bb856e01b9e80151b7bcb8bbf6239f43a92ff33bcbbbfaf721e70abbb47',
    'geometry-quality-review.html': '4589993716585d23f48e95f739cfb40a32e239119f8e365abb235ab9b7edc677'
  };
  for (const [filename, expectedHash] of Object.entries(pageHashes)) {
    const actual = createHash('sha256').update(readFileSync(resolve(base, '..', filename))).digest('hex');
    assert.equal(actual, expectedHash, `${filename} must remain untouched`);
  }
});
