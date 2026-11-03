import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSfnt } from '../../../../prototype/src/sfnt-audit.js';
import { validateGlyph } from '../../../../prototype/src/contours.js';
import { parseFont } from 'fontsketch/core';
import {
  buildLowercaseACandidate, compileSemanticDesign, createLowercaseAGlyph, createSemanticDesign,
  deriveGlyph, glyphGeometryHash, initializeConstruction, validateSemanticDesign
} from '../index.mjs';

test('lowercase a declares a distinct single-storey bowl, counter, stem, joins, and terminals', () => {
  const accepted = initializeConstruction(createSemanticDesign());
  const a = createLowercaseAGlyph();
  const candidate = structuredClone(accepted);
  candidate.glyphRegistry.glyphs.push(a);
  candidate.state.characteristics.push({ id: 'decision:baseline', property: 'alignment.baseline', value: { kind: 'font-units', value: 0 } });
  assert.equal(a.id, 'glyph:u0061');
  assert.deepEqual(a.unicodes, [0x0061]);
  assert.equal(a.construction.parameters.topology, 'single-storey');
  assert.deepEqual(new Set(a.construction.nodes.map(item => item.kind)), new Set([
    'anatomy.bowl', 'anatomy.counter', 'anatomy.stem', 'anatomy.join', 'anatomy.terminal'
  ]));
  assert.deepEqual(validateSemanticDesign(candidate), []);
});

test('lowercase a derives deterministic valid outer and counter contours from shared construction parameters', () => {
  const candidate = buildLowercaseACandidate();
  const a = candidate.glyph;
  const repeated = deriveGlyph(candidate.model.glyphRegistry.glyphs.find(item => item.id === a.id), candidate.model);
  assert.deepEqual(repeated, a);
  assert.deepEqual(a.contours.map(item => item.role), ['outer', 'counter']);
  assert.ok(a.contours.every(item => item.closed));
  assert.notEqual(a.contours[0].points[0].id, a.contours[1].points[0].id);
  assert.deepEqual(validateGlyph({ ...a, advanceWidth: a.metrics.advanceWidth, rightSideBearing: a.metrics.rightSideBearing }), []);
  assert.deepEqual(a.bounds, { xMin: 55, yMin: 0, xMax: 595, yMax: 500 });
  assert.deepEqual(a.metrics, { advanceWidth: 650, leftSideBearing: 55, rightSideBearing: 55 });
  assert.deepEqual(a.unicode, 0x0061);
});

test('lowercase a follows the shared stem and x-height decisions rather than duplicating their values', () => {
  const candidate = buildLowercaseACandidate();
  const source = candidate.model.glyphRegistry.glyphs.find(item => item.id === 'glyph:u0061');
  const stemWidth = candidate.model.state.characteristics.find(item => item.id === 'decision:shared-stem-width');
  const xHeight = candidate.model.state.characteristics.find(item => item.id === 'decision:x-height');
  assert.equal(source.construction.nodes.find(item => item.kind === 'anatomy.stem').parameters.widthDecisionId, stemWidth.id);
  assert.equal(source.construction.nodes.find(item => item.kind === 'anatomy.bowl').parameters.xHeightDecisionId, xHeight.id);
  const widened = structuredClone(candidate.model);
  widened.state.characteristics.find(item => item.id === stemWidth.id).value.value = 100;
  const widerA = deriveGlyph(source, widened);
  assert.notEqual(glyphGeometryHash(widerA), glyphGeometryHash(candidate.glyph));
  assert.equal(widerA.bounds.xMin, 45);
  const stem = widerA.contours[0].segments.find(item => item.id === 'part:a-stem.outer-edge');
  assert.equal(stem.from.x - stem.to.x, 0);
  assert.equal(stem.from.x, 595);
  assert.equal(stem.from.x - (widerA.contours[0].segments.find(item => item.id === 'part:a-upper-terminal.flat-edge').from.x), 100);
});

test('adding lowercase a branches a candidate revision and preserves accepted o, n, and H exactly', () => {
  const accepted = initializeConstruction(createSemanticDesign());
  const acceptedSnapshot = JSON.stringify(accepted);
  const result = buildLowercaseACandidate(accepted);
  assert.equal(JSON.stringify(accepted), acceptedSnapshot);
  assert.equal(result.status, 'candidate');
  assert.equal(result.model.revisions.acceptedRevisionId, accepted.revisions.acceptedRevisionId);
  assert.equal(result.model.revisions.headRevisionId, result.revision.id);
  assert.deepEqual(result.revision.changedGlyphIds, ['glyph:u0061']);
  assert.deepEqual(result.revision.preservedGlyphIds, ['glyph:u006f', 'glyph:u006e', 'glyph:u0048']);
  assert.deepEqual(result.revision.preservedDecisionIds, accepted.state.decisions);
  for (const id of ['glyph:u006f', 'glyph:u006e', 'glyph:u0048']) {
    assert.equal(glyphGeometryHash(result.model.derived.geometry.glyphs[id]), glyphGeometryHash(accepted.derived.geometry.glyphs[id]));
  }
});

test('the four-glyph candidate compiles deterministically with lowercase a mapped and existing glyphs preserved', () => {
  const candidate = buildLowercaseACandidate();
  const first = compileSemanticDesign(candidate.model);
  const second = compileSemanticDesign(candidate.model);
  const base = compileSemanticDesign(initializeConstruction(createSemanticDesign()));
  assert.deepEqual(first.bytes, second.bytes);
  assert.equal(first.audit.valid, true);
  assert.deepEqual(first.audit.missingTables, []);
  assert.equal(first.audit.numGlyphs, 6);
  const parsed = parseFont(first.bytes);
  const baseParsed = parseFont(base.bytes);
  assert.deepEqual(parsed.glyphs.a.unicodes, [0x0061]);
  assert.equal(parsed.glyphs.a.advanceWidth, 650);
  assert.equal(parsed.glyphs.a.contours.length, 2);
  for (const name of ['o', 'n', 'H']) {
    assert.deepEqual(parsed.glyphs[name].contours, baseParsed.glyphs[name].contours);
  }
  assert.deepEqual(first.audit.horizontalMetrics.metrics.slice(0, 5), base.audit.horizontalMetrics.metrics,
    'adding a must preserve advances and side bearings of .notdef, space, o, n, and H');
  assert.equal(auditSfnt(first.bytes).valid, true);
});

test('a two-storey topology is not silently treated as the implemented single-storey construction', () => {
  const model = createSemanticDesign();
  const a = createLowercaseAGlyph();
  a.construction.parameters.topology = 'two-storey';
  model.glyphRegistry.glyphs.push(a);
  model.state.characteristics.push({ id: 'decision:baseline', property: 'alignment.baseline', value: { kind: 'font-units', value: 0 } });
  assert.ok(validateSemanticDesign(model).some(error => error.includes('explicit single-storey topology')));
});
