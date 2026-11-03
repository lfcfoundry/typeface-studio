import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFont } from 'fontsketch/core';
import { auditSfnt } from '../../../../prototype/src/sfnt-audit.js';
import { contourBounds, sampleContour, validateGlyph } from '../../../../prototype/src/contours.js';
import {
  applyConstructionOperation, buildOpenCounterCandidate, compileSemanticDesign, createCrossbarComparison, createSemanticDesign,
  deriveDesignGeometry, glyphGeometryHash, initializeConstruction, makeOpenCounterCandidateOperation,
  presentationReference, validateSemanticDesign
} from '../index.mjs';

const glyph = (model, id) => model.derived.geometry.glyphs[id];

function tangentAtStart(segment) {
  return segment.type === 'quadratic'
    ? { x: 2 * (segment.control.x - segment.from.x), y: 2 * (segment.control.y - segment.from.y) }
    : { x: segment.to.x - segment.from.x, y: segment.to.y - segment.from.y };
}

function tangentAtEnd(segment) {
  return segment.type === 'quadratic'
    ? { x: 2 * (segment.to.x - segment.control.x), y: 2 * (segment.to.y - segment.control.y) }
    : { x: segment.to.x - segment.from.x, y: segment.to.y - segment.from.y };
}

function joinContinuity(contour, firstFragment, secondFragment) {
  const firstIndex = contour.segments.findIndex(segment => segment.id.includes(firstFragment));
  const secondIndex = contour.segments.findIndex(segment => segment.id.includes(secondFragment));
  assert.notEqual(firstIndex, -1, `Missing segment ${firstFragment}`);
  assert.notEqual(secondIndex, -1, `Missing segment ${secondFragment}`);
  assert.equal(Math.abs(firstIndex - secondIndex), 1, `${firstFragment} and ${secondFragment} are not adjacent`);
  const previous = contour.segments[Math.min(firstIndex, secondIndex)];
  const next = contour.segments[Math.max(firstIndex, secondIndex)];
  const incoming = tangentAtEnd(previous), outgoing = tangentAtStart(next);
  const dx = previous.to.x - next.from.x, dy = previous.to.y - next.from.y;
  const cross = incoming.x * outgoing.y - incoming.y * outgoing.x;
  const dot = incoming.x * outgoing.x + incoming.y * outgoing.y;
  return {
    g0: dx === 0 && dy === 0,
    g1: cross === 0 && dot > 0,
    c1: incoming.x === outgoing.x && incoming.y === outgoing.y,
    incoming, outgoing
  };
}

function crossbarBand(glyph) {
  const contour = glyph.contours[0];
  return [...new Set(contour.segments.filter(segment => segment.type === 'line' && segment.from.y === segment.to.y && segment.from.y > 0 && segment.from.y < 700 && Math.min(segment.from.x, segment.to.x) === 145 && Math.max(segment.from.x, segment.to.x) === 505).map(segment => segment.from.y))].sort((a, b) => a - b);
}

test('semantic anatomy, construction methods, relationships, and shared parameter references validate', () => {
  const model = createSemanticDesign();
  assert.deepEqual(validateSemanticDesign(model), []);
  const nodeKinds = Object.fromEntries(model.glyphRegistry.glyphs.map(item => [item.name, item.construction.nodes.map(part => part.kind)]));
  assert.ok(nodeKinds.o.includes('anatomy.bowl') && nodeKinds.o.includes('anatomy.counter'));
  assert.ok(nodeKinds.n.includes('anatomy.stem') && nodeKinds.n.includes('anatomy.shoulder') && nodeKinds.n.includes('anatomy.join'));
  assert.ok(nodeKinds.H.includes('anatomy.stem') && nodeKinds.H.includes('anatomy.crossbar'));
  const invalid = structuredClone(model);
  invalid.glyphRegistry.glyphs.find(item => item.name === 'o').construction.nodes[1].relations[0].targetId = 'missing-part';
  assert.ok(validateSemanticDesign(invalid).some(error => error.includes('dangling')));
});

test('semantic construction derives deterministic, closed quadratic geometry with counters and coherent metrics', () => {
  const model = initializeConstruction(createSemanticDesign());
  assert.deepEqual(deriveDesignGeometry(model), deriveDesignGeometry(model));
  const o = glyph(model, 'glyph:u006f');
  const n = glyph(model, 'glyph:u006e');
  const H = glyph(model, 'glyph:u0048');
  assert.equal(o.contours.length, 2);
  assert.equal(o.contours[1].role, 'counter');
  assert.ok(n.contours[0].segments.some(segment => segment.type === 'quadratic'));
  assert.equal(H.contours.length, 1);
  for (const item of [o, n, H]) {
    assert.ok(item.contours.every(contour => contour.closed && contour.points.length >= 4));
    assert.deepEqual(contourBounds(item.contours), item.bounds);
    assert.deepEqual(validateGlyph({ ...item, advanceWidth: item.metrics.advanceWidth, rightSideBearing: item.metrics.rightSideBearing }), []);
    assert.equal(item.metrics.leftSideBearing, item.bounds.xMin);
    assert.equal(item.metrics.rightSideBearing, item.metrics.advanceWidth - item.bounds.xMax);
    assert.ok(item.contours.every(contour => sampleContour(contour).length >= 3));
  }
});

test('glyph identity, Unicode identity, and font metrics remain separate from construction node identities', () => {
  const model = initializeConstruction(createSemanticDesign());
  const o = model.glyphRegistry.glyphs.find(item => item.name === 'o');
  assert.equal(o.id, 'glyph:u006f');
  assert.deepEqual(o.unicodes, [0x006f]);
  assert.equal(o.construction.nodes[0].id, 'part:o-bowl');
  assert.notEqual(o.id, o.unicodes[0]);
  assert.equal(glyph(model, o.id).metrics.advanceWidth, 620);
});

test('scoped construction operation creates a candidate and regenerates lowercase o only', () => {
  const accepted = initializeConstruction(createSemanticDesign());
  const before = JSON.stringify(accepted);
  const result = buildOpenCounterCandidate(accepted);
  assert.equal(result.status, 'candidate');
  assert.equal(JSON.stringify(accepted), before);
  assert.deepEqual(result.revision.changedGlyphIds, ['glyph:u006f']);
  assert.deepEqual(result.revision.preservedGlyphIds, ['glyph:u006e', 'glyph:u0048']);
  assert.equal(result.model.revisions.acceptedRevisionId, 'rev:semantic-base');
  assert.equal(result.model.revisions.headRevisionId, result.revision.id);
  assert.deepEqual(result.diff.semanticChanges, [{ glyphId: 'glyph:u006f', nodeId: 'part:o-counter', parameter: 'scale', from: 0.78, to: 1 }]);
  assert.notEqual(glyph(accepted, 'glyph:u006f').contours[1].points[1].x, glyph(result.model, 'glyph:u006f').contours[1].points[1].x);
  for (const id of ['glyph:u006e', 'glyph:u0048']) assert.equal(glyphGeometryHash(glyph(accepted, id)), glyphGeometryHash(glyph(result.model, id)));
});

test('failed semantic operation is transactional and does not alter accepted state', () => {
  const accepted = initializeConstruction(createSemanticDesign());
  const before = JSON.stringify(accepted);
  const prepared = makeOpenCounterCandidateOperation(accepted);
  const bad = { ...prepared.operation, parameters: { ...prepared.operation.parameters, value: 0 } };
  const result = applyConstructionOperation({ ...accepted, selectors: [prepared.selector] }, { ...bad, intent: prepared.intent });
  assert.equal(result.status, 'rejected');
  assert.match(result.error, /unsupported semantic parameter value/u);
  assert.equal(JSON.stringify(accepted), before);
});

test('font compiler consumes the derived contours and emits deterministic TTF with the three encoded glyphs', () => {
  const model = initializeConstruction(createSemanticDesign());
  const first = compileSemanticDesign(model);
  const second = compileSemanticDesign(model);
  assert.deepEqual(first.bytes, second.bytes);
  assert.deepEqual(first.audit.missingTables, []);
  assert.equal(first.audit.wholeChecksumValid, true);
  assert.equal(first.audit.numGlyphs, 5); // fontsketch adds .notdef and space to o, n, H
  const parsed = first.parsed;
  assert.deepEqual(parsed.glyphs.o.unicodes, [0x006f]);
  assert.deepEqual(parsed.glyphs.n.unicodes, [0x006e]);
  assert.deepEqual(parsed.glyphs.H.unicodes, [0x0048]);
  assert.ok(parsed.glyphs.o.contours.length >= 2);
  assert.ok(parsed.glyphs.n.contours.length >= 1);
  assert.ok(parsed.glyphs.H.contours.length >= 1);
  assert.equal(parsed.glyphs.o.advanceWidth, 620);
  assert.equal(parsed.glyphs.n.advanceWidth, 650);
  assert.equal(parsed.glyphs.H.advanceWidth, 650);
  assert.deepEqual(first.audit.horizontalMetrics.metrics.slice(2).map(metric => [metric.advanceWidth, metric.leftSideBearing]), [[620, 55], [650, 55], [650, 55]]);
  assert.equal(auditSfnt(first.bytes).valid, true);
});

test('compiled candidate changes o outline while preserving n and H outlines and advances', () => {
  const { accepted, candidate } = (() => {
    const base = initializeConstruction(createSemanticDesign());
    const next = buildOpenCounterCandidate(base);
    assert.equal(next.status, 'candidate');
    return { accepted: base, candidate: next.model };
  })();
  const before = compileSemanticDesign(accepted).parsed.glyphs;
  const after = compileSemanticDesign(candidate).parsed.glyphs;
  assert.notDeepEqual(before.o.contours, after.o.contours);
  for (const name of ['n', 'H']) {
    assert.deepEqual(before[name].contours, after[name].contours);
    assert.equal(before[name].advanceWidth, after[name].advanceWidth);
  }
});

test('the same semantic construction can be referenced in horizontal or vertical presentation without generating alternates', () => {
  const model = initializeConstruction(createSemanticDesign());
  const horizontal = presentationReference(model, 'glyph:u006f', 'horizontal');
  const vertical = presentationReference(model, 'glyph:u006f', 'vertical');
  assert.equal(horizontal.semanticConstructionId, vertical.semanticConstructionId);
  assert.equal(horizontal.geometryHash, vertical.geometryHash);
  assert.equal(vertical.verticalAlternate, null);
  assert.equal(vertical.capability, 'shared-construction-reference-only');
});

test('n shoulder joins have tested positional, tangent, and derivative continuity', () => {
  const model = initializeConstruction(createSemanticDesign());
  const contour = glyph(model, 'glyph:u006e').contours[0];
  const joins = [
    ['left-shoulder-join', 'outer-entry', 'outer stem to arch'],
    ['outer-entry', 'outer-left-center', 'outer left quadratic join'],
    ['outer-left-center', 'outer-center-right', 'outer crown join'],
    ['outer-center-right', 'outer-exit', 'outer right quadratic join'],
    ['outer-exit', 'right-stem-outer', 'arch to right stem'],
    ['right-shoulder-inner', 'inner-approach', 'right counter wall to arch'],
    ['inner-approach', 'inner-return', 'inner crown join'],
    ['inner-return', 'left-stem-bottom-inner', 'arch to left counter wall']
  ];
  const results = Object.fromEntries(joins.map(([a, b, label]) => [label, joinContinuity(contour, a, b)]));
  for (const [label, result] of Object.entries(results)) assert.equal(result.g0, true, `${label} must meet positionally`);
  for (const label of ['outer stem to arch', 'outer left quadratic join', 'outer crown join', 'outer right quadratic join', 'arch to right stem', 'right counter wall to arch', 'inner crown join', 'arch to left counter wall']) {
    assert.equal(results[label].g1, true, `${label} must have a common tangent direction`);
  }
  for (const label of ['outer stem to arch', 'outer left quadratic join', 'outer crown join', 'outer right quadratic join', 'arch to right stem', 'inner crown join']) {
    assert.equal(results[label].c1, true, `${label} should have equal first derivatives`);
  }
  assert.equal(results['right counter wall to arch'].c1, false);
  assert.equal(results['arch to left counter wall'].c1, false);
  assert.deepEqual(deriveDesignGeometry(model), deriveDesignGeometry(model));
  assert.deepEqual(validateGlyph({ ...glyph(model, 'glyph:u006e'), advanceWidth: 650, rightSideBearing: 55 }), []);
});

test('corrected n changes only its outline relative to the existing base artifact', () => {
  const bytes = new Uint8Array(readFileSync(new URL('../artifacts/LFCFoundry-Semantic-Construction-Base.ttf', import.meta.url)));
  const original = parseFont(bytes);
  const correctedModel = initializeConstruction(createSemanticDesign());
  const correctedOutput = compileSemanticDesign(correctedModel);
  const corrected = correctedOutput.parsed;
  assert.notDeepEqual(original.glyphs.n.contours, corrected.glyphs.n.contours);
  for (const name of ['o', 'H']) assert.deepEqual(original.glyphs[name].contours, corrected.glyphs[name].contours);
  for (const name of ['o', 'n', 'H']) {
    assert.deepEqual(original.glyphs[name].unicodes, corrected.glyphs[name].unicodes);
    assert.equal(original.glyphs[name].advanceWidth, corrected.glyphs[name].advanceWidth);
  }
  const originalMetrics = auditSfnt(bytes).horizontalMetrics.metrics;
  const correctedMetrics = auditSfnt(correctedOutput.bytes).horizontalMetrics.metrics;
  assert.deepEqual(correctedMetrics, originalMetrics, 'the correction must preserve every glyph advance and left side bearing');
});

test('H crossbar comparison branches current, midpoint, and modestly lower placement as separate parameter candidates', () => {
  const { accepted, variants } = createCrossbarComparison();
  assert.deepEqual(variants.map(item => [item.label, item.centerRatio, item.status]), [
    ['Existing placement', 367 / 700, 'reference'],
    ['Exact midpoint', 0.5, 'candidate'],
    ['Modestly below midpoint', 0.48, 'candidate']
  ]);
  assert.deepEqual(crossbarBand(glyph(accepted, 'glyph:u0048')), [322, 412]);
  assert.deepEqual(crossbarBand(glyph(variants[1].model, 'glyph:u0048')), [305, 395]);
  assert.deepEqual(crossbarBand(glyph(variants[2].model, 'glyph:u0048')), [291, 381]);
  for (const variant of variants.slice(1)) {
    assert.deepEqual(variant.revision.changedGlyphIds, ['glyph:u0048']);
    for (const id of ['glyph:u006f', 'glyph:u006e']) assert.equal(glyphGeometryHash(glyph(accepted, id)), glyphGeometryHash(glyph(variant.model, id)));
    assert.deepEqual(glyph(accepted, 'glyph:u0048').metrics, glyph(variant.model, 'glyph:u0048').metrics);
  }
  const compiled = variants.map(item => compileSemanticDesign(item.model).parsed.glyphs);
  assert.deepEqual(compiled[0].o.contours, compiled[1].o.contours);
  assert.deepEqual(compiled[0].n.contours, compiled[1].n.contours);
  assert.notDeepEqual(compiled[0].H.contours, compiled[1].H.contours);
  assert.notDeepEqual(compiled[0].H.contours, compiled[2].H.contours);
  assert.notDeepEqual(compiled[1].H.contours, compiled[2].H.contours);
  const metricRows = variants.map(item => auditSfnt(compileSemanticDesign(item.model).bytes).horizontalMetrics.metrics);
  assert.deepEqual(metricRows[1], metricRows[0]);
  assert.deepEqual(metricRows[2], metricRows[0]);
});
