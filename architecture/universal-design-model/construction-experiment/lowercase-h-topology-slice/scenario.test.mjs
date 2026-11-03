import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateGlyph } from '../../../../prototype/src/contours.js';
import { compileSemanticDesign, compilerProject } from '../font-adapter.mjs';
import { validateSemanticDesign } from '../model.mjs';
import { executeTransaction } from '../../integration-experiment/engine.mjs';
import { createHConstruction, H_GLYPH_ID, H_METHOD, validateHConstruction } from './grammar.mjs';
import { deriveStemShoulderGeometry } from './geometry.mjs';
import { acceptCandidate, compilerInputMatchesValidatedGeometry, createAcceptedSource, interpretRequest,
  OPERATION, operationHandlers, prepareTransaction, runFollowup, runPreparedTransaction, runRequest, SUPPORTED_REQUEST, SUPPORTED_VARIANT } from './scenario.mjs';

const clone = structuredClone;
const json = value => JSON.stringify(value);
const hash = value => createHash('sha256').update(value).digest('hex');
const source = () => createAcceptedSource();
const baseSnapshot = value => json({ model: value.model, family: value.family });
const resolved = () => {
  const start = source();
  const result = runRequest(start, SUPPORTED_REQUEST);
  assert.equal(result.status, 'committed-candidate', result.error || JSON.stringify(result.diagnostics));
  return { start, result };
};

test('the exact request and one documented variant preserve source text, spans, and explicit preservation intent', () => {
  for (const request of [SUPPORTED_REQUEST, SUPPORTED_VARIANT]) {
    const result = interpretRequest(request);
    assert.equal(result.status, 'resolved');
    assert.equal(result.text, request);
    assert.deepEqual(result.intents.map(item => item.kind), ['construction', 'preservation']);
    for (const intent of result.intents) {
      assert.ok(request.slice(intent.source.start, intent.source.end).includes(intent.source.text));
      assert.equal(intent.source.messageId, 'msg:nl-add-h-1');
      assert.equal(intent.origin, 'explicit');
    }
    assert.ok(result.inferred.some(value => value.includes('cap-height')));
  }
});

test('unsupported, ambiguous, conflicting, empty, and malformed requests produce diagnostics without a candidate', () => {
  const cases = [
    [null, 'invalid'], ['', 'invalid'], ['Add lowercase b with a stem and shoulder, preserving every existing glyph.', 'unsupported'],
    ['Add h with a vertical stem and shoulder, preserving every existing glyph.', 'ambiguous'],
    ['Add a lowercase h and change the existing n while preserving every existing glyph.', 'conflict'],
    ['Add a lowercase h with a serifed bowl and shoulder, preserving every existing glyph.', 'unsupported']
  ];
  for (const [request, status] of cases) {
    const interpreted = interpretRequest(request);
    assert.equal(interpreted.status, status);
    assert.ok(interpreted.diagnostics.length);
    assert.equal(prepareTransaction(source(), request).candidate, null);
  }
});

test('the candidate-only h target resolves exactly and retains the accepted parent glyph inventory', () => {
  const start = source();
  const before = baseSnapshot(start);
  const prepared = prepareTransaction(start, SUPPORTED_REQUEST);
  assert.equal(prepared.status, 'ready');
  assert.deepEqual(prepared.parentGlyphIds, start.model.glyphRegistry.glyphs.map(glyph => glyph.id).sort());
  assert.equal(prepared.operation.type, OPERATION);
  assert.equal(prepared.operation.selectorId, 'sel:h-target');
  assert.deepEqual(prepared.model.selectors.find(item => item.id === 'sel:h-target').resolution.includedGlyphIds, [H_GLYPH_ID]);
  assert.equal(baseSnapshot(start), before);
});

test('an existing id or Unicode mapping conflicts with the new target; stale source acceptance is rejected', () => {
  const alreadyPresent = source();
  const fake = { id: H_GLYPH_ID, name: 'h', unicodes: [0x0068], classes: ['letter', 'lowercase'] };
  alreadyPresent.model.glyphRegistry.glyphs.push(fake);
  assert.equal(prepareTransaction(alreadyPresent, SUPPORTED_REQUEST).diagnostics[0].code, 'target-conflict');
  const stale = source();
  stale.model.revisions.acceptedRevisionId = 'rev:stale';
  assert.equal(prepareTransaction(stale, SUPPORTED_REQUEST).diagnostics[0].code, 'unaccepted-source');
  const staleSelector = prepareTransaction(source(), SUPPORTED_REQUEST);
  staleSelector.model.selectors.find(item => item.id === 'sel:h-target').registryRevisionId = 'rev:stale';
  const staleResult = runPreparedTransaction(staleSelector);
  assert.equal(staleResult.status, 'rejected');
  assert.match(staleResult.error, /stale/iu);
});

test('the semantic h grammar is distinct from n and has explicit stem, shoulder, return, terminals, and open-space boundaries', () => {
  const { start, result } = resolved();
  const h = result.model.glyphRegistry.glyphs.find(item => item.id === H_GLYPH_ID);
  const n = start.model.glyphRegistry.glyphs.find(item => item.name === 'n');
  assert.equal(h.construction.method, H_METHOD);
  assert.equal(h.construction.nodes.filter(item => item.kind === 'anatomy.stem').length, 1);
  assert.equal(h.construction.nodes.filter(item => item.kind === 'anatomy.shoulder').length, 1);
  assert.equal(n.construction.nodes.filter(item => item.kind === 'anatomy.stem').length, 2);
  assert.equal(n.construction.nodes.find(item => item.kind === 'anatomy.shoulder').role, 'arched-bridge');
  assert.equal(h.construction.nodes.find(item => item.kind === 'anatomy.shoulder').role, 'arched-return');
  assert.equal(h.construction.nodes.find(item => item.kind === 'anatomy.open-space').role, 'shoulder-open-counter');
  assert.deepEqual(validateHConstruction(h, result.model), []);
  assert.deepEqual(validateSemanticDesign(result.model), []);
  assert.equal(h.construction.nodes.find(item => item.role === 'upper-stem-terminal').parameters.profile, 'flat');
  assert.equal(h.construction.nodes.find(item => item.role === 'lower-shoulder-return-terminal').parameters.profile, 'flat');
  assert.equal(h.construction.nodes.find(item => item.role === 'arched-return').parameters.outerControlRiseRatio, 0.6);
  assert.ok(!json(h.construction).includes('contour-point'));
});

test('invalid component attachment and topology changes are rejected by the semantic grammar validator', () => {
  const prepared = prepareTransaction(source(), SUPPORTED_REQUEST);
  const model = prepared.model;
  const target = model.glyphRegistry.glyphs.find(item => item.id === H_GLYPH_ID);
  target.construction = createHConstruction({ stemWidthDecisionId: 'decision:shared-stem-width', xHeightDecisionId: 'decision:x-height',
    ascenderDecisionId: 'decision:h-ascender', baselineDecisionId: 'decision:baseline',
    provenance: { glyphId: H_GLYPH_ID, operationId: 'op:test', sourceRevisionId: prepared.sourceRevisionId, intentIds: ['intent:test'] } });
  const shoulder = target.construction.nodes.find(item => item.role === 'arched-return');
  shoulder.relations = shoulder.relations.filter(item => !(item.type === 'attaches-to'));
  assert.ok(validateHConstruction(target, model).some(message => message.includes('attachments')));
  target.construction.nodes.push(clone(target.construction.nodes[0]));
  assert.ok(validateHConstruction(target, model).some(message => message.includes('unique') || message.includes('exactly')));
});

test('invalid semantic ratios and dimensions fail transactionally before acceptance', () => {
  const start = source(), snapshot = baseSnapshot(start), prepared = prepareTransaction(start, SUPPORTED_REQUEST);
  const invalidConstruct = args => {
    const record = createHConstruction(args);
    record.nodes.find(item => item.role === 'arched-return').parameters.outerControlRiseRatio = 4;
    return record;
  };
  const result = runPreparedTransaction(prepared, { construct: invalidConstruct });
  assert.equal(result.status, 'rejected');
  assert.match(result.error, /outerControlRiseRatio/);
  assert.equal(baseSnapshot(start), snapshot);
  const malformed = prepareTransaction(source(), SUPPORTED_REQUEST);
  malformed.operation.parameters.unrecognized = true;
  assert.match(runPreparedTransaction(malformed).error, /parameter schema/);
  const badDimensions = clone(prepared.model);
  badDimensions.state.characteristics.find(item => item.id === 'decision:h-ascender').value.value = 400;
  const badPrepared = { ...prepared, model: badDimensions };
  assert.equal(runPreparedTransaction(badPrepared).status, 'rejected');
});

test('the new handler rejects any staged change to a pre-existing glyph before constructing h', () => {
  const start = source(), snapshot = baseSnapshot(start), prepared = prepareTransaction(start, SUPPORTED_REQUEST);
  prepared.family.glyphs['glyph:u006f'].contours[0].points[0].x++;
  const result = runPreparedTransaction(prepared);
  assert.equal(result.status, 'rejected');
  assert.match(result.error, /pre-existing glyph or its derived compiler input changed/);
  assert.equal(baseSnapshot(start), snapshot);
});

test('the geometry adapter follows semantic roles and dimensions rather than glyph-name dispatch', () => {
  const prepared = prepareTransaction(source(), SUPPORTED_REQUEST);
  const model = clone(prepared.model);
  const baseline = model.glyphRegistry.glyphs.find(item => item.id === H_GLYPH_ID);
  const reference = clone(baseline);
  reference.construction = createHConstruction({ stemWidthDecisionId: 'decision:shared-stem-width', xHeightDecisionId: 'decision:x-height',
    ascenderDecisionId: 'decision:h-ascender', baselineDecisionId: 'decision:baseline', identityPrefix: 'h',
    provenance: { glyphId: reference.id, operationId: 'op:test-reference', sourceRevisionId: prepared.sourceRevisionId, intentIds: ['intent:test-reference'] } });
  const referenceGeometry = deriveStemShoulderGeometry(reference, model);
  const sample = { ...clone(baseline), id: 'glyph:u0069', name: 'probe', character: 'i', unicodes: [0x0069] };
  sample.construction = createHConstruction({ stemWidthDecisionId: 'decision:shared-stem-width', xHeightDecisionId: 'decision:x-height',
    ascenderDecisionId: 'decision:h-ascender', baselineDecisionId: 'decision:baseline', identityPrefix: 'probe',
    provenance: { glyphId: sample.id, operationId: 'op:test-probe', sourceRevisionId: prepared.sourceRevisionId, intentIds: ['intent:test-probe'] } });
  const geometry = deriveStemShoulderGeometry(sample, model);
  const actual = geometry.contours[0].segments.map(({ type, from, control, to }) => ({ type, from, control, to }));
  const expected = referenceGeometry.contours[0].segments.map(({ type, from, control, to }) => ({ type, from, control, to }));
  assert.deepEqual(actual, expected);
  assert.equal(geometry.name, 'probe');
  assert.deepEqual(validateHConstruction(sample, model), []);
});

test('geometry failure rolls the candidate back and does not mutate accepted source state', () => {
  const start = source(), snapshot = baseSnapshot(start), prepared = prepareTransaction(start, SUPPORTED_REQUEST);
  const result = runPreparedTransaction(prepared, { derive: (glyph, model) => {
    const geometry = deriveStemShoulderGeometry(glyph, model);
    geometry.contours[0].points = [];
    return geometry;
  } });
  assert.equal(result.status, 'rejected');
  assert.match(result.error, /outline validation failed/);
  assert.equal(baseSnapshot(start), snapshot);
});

test('a later dependent operation failure rolls back construction and preserves the accepted input', () => {
  const start = source(), snapshot = baseSnapshot(start), prepared = prepareTransaction(start, SUPPORTED_REQUEST);
  const beforePrepared = json({ model: prepared.model, family: prepared.family });
  const later = { id: 'op:test-fail-later', type: 'test.fail-after-h', selectorId: prepared.operation.selectorId,
    phase: 'construction', parameters: {}, dependsOn: [prepared.operation.id], preconditions: [{ type: 'revision', id: prepared.sourceRevisionId }],
    postconditions: [], metricPolicy: {}, provenance: { intentIds: prepared.operation.provenance.intentIds },
    capability: 'implemented-experiment', resolution: { status: 'resolved', reason: null }, conflicts: [], exceptions: [] };
  prepared.model.operations.push(later);
  const beforeExecution = json({ model: prepared.model, family: prepared.family });
  const result = executeTransaction(prepared.model, prepared.family, { operationHandlers: {
    ...operationHandlers(), 'test.fail-after-h': () => { throw new Error('injected later-stage failure'); }
  } });
  assert.equal(result.status, 'rejected');
  assert.match(result.error, /injected later-stage failure/);
  assert.equal(json({ model: prepared.model, family: prepared.family }), beforeExecution);
  assert.equal(baseSnapshot(start), snapshot);
  assert.deepEqual(prepared.model.glyphRegistry.glyphs.find(item => item.id === H_GLYPH_ID).construction.nodes, []);
  assert.notEqual(beforePrepared, beforeExecution);
});

test('the accepted source is immutable, every existing glyph record is preserved, and compiled geometry matches executor-validated geometry', () => {
  const start = source(), snapshot = baseSnapshot(start), { result } = resolved();
  assert.equal(baseSnapshot(start), snapshot);
  assert.equal(result.revision.parentRevisionIds[0], start.model.revisions.headRevisionId);
  assert.deepEqual([...result.revision.preservedGlyphIds].sort(), start.model.glyphRegistry.glyphs.map(item => item.id).sort());
  for (const id of start.model.glyphRegistry.glyphs.map(item => item.id)) {
    assert.deepEqual(result.model.glyphRegistry.glyphs.find(item => item.id === id), start.model.glyphRegistry.glyphs.find(item => item.id === id));
    assert.deepEqual(result.family.glyphs[id], start.family.glyphs[id]);
    assert.deepEqual(result.model.derived.geometry.glyphs[id], start.model.derived.geometry.glyphs[id]);
  }
  assert.equal(compilerInputMatchesValidatedGeometry(result.model, result.family), true);
  const project = compilerProject(result.model);
  assert.deepEqual(project.glyphs[H_GLYPH_ID].contours.map(contour => contour.points), result.family.glyphs[H_GLYPH_ID].contours.map(contour => contour.points));
});

test('derived h geometry has stable boundary references, valid outline, measured bounds, and declared metrics', () => {
  const { result } = resolved();
  const geometry = result.model.derived.geometry.glyphs[H_GLYPH_ID];
  const construction = result.model.glyphRegistry.glyphs.find(item => item.id === H_GLYPH_ID).construction;
  const open = construction.nodes.find(item => item.kind === 'anatomy.open-space');
  assert.equal(geometry.contours.length, 1);
  assert.equal(geometry.bounds.xMin, 55);
  assert.equal(geometry.bounds.xMax, 595);
  assert.equal(geometry.bounds.yMin, 0);
  assert.equal(geometry.bounds.yMax, 700);
  assert.equal(geometry.metrics.advanceWidth, 650);
  assert.equal(geometry.metrics.leftSideBearing, 55);
  assert.equal(geometry.metrics.rightSideBearing, 55);
  assert.deepEqual(validateGlyph({ ...geometry, advanceWidth: 650, rightSideBearing: 55 }), []);
  assert.deepEqual([...geometry.contours[0].segments.map(segment => segment.id)].sort(),
    [...construction.identity.boundaryIds.filter(id => id !== open.parameters.openingBoundaryId)].sort());
  assert.deepEqual(geometry.openSpaces[0], { id: open.id, boundaryIds: open.parameters.boundaryIds,
    openingBoundaryId: open.parameters.openingBoundaryId });
  assert.equal(construction.identity.stableNodeIds.length, construction.nodes.length);
  assert.equal(result.operation.metricPolicy.advance, 'preserve-explicit-source-metric');
  assert.equal(result.operation.metricPolicy.bearings, 'recompute-from-derived-bounds');
  assert.equal(result.operation.metricPolicy.kerning, 'invalidate-for-review');
});

test('the diagnostic compiler adds U+0068 and leaves every pre-existing compiled glyph record unchanged', () => {
  const { start, result } = resolved();
  assert.equal(result.candidateFont.audit.valid, true);
  assert.equal(result.sourceFont.audit.valid, true);
  const h = result.candidateFont.parsed.glyphs.h;
  assert.deepEqual(h.unicodes, [0x0068]);
  assert.equal(h.advanceWidth, 650);
  assert.equal(h.contours.length, 1);
  assert.deepEqual(h.contours[0].points, result.family.glyphs[H_GLYPH_ID].contours[0].points.map(({ x, y, on }) => ({ x, y, on })));
  for (const id of start.model.glyphRegistry.glyphs.map(item => item.id)) {
    const name = start.model.glyphRegistry.glyphs.find(item => item.id === id).name;
    assert.equal(json(result.sourceFont.parsed.glyphs[name]), json(result.candidateFont.parsed.glyphs[name]), `${name} compiler record changed`);
  }
  assert.ok(result.revision.changedGlyphIds.includes(H_GLYPH_ID));
});

test('font compilation failure returns no candidate and leaves the accepted source unchanged', () => {
  const start = source(), snapshot = baseSnapshot(start);
  let calls = 0;
  const result = runRequest(start, SUPPORTED_REQUEST, { compile: model => {
    calls++;
    if (calls === 2) throw new Error('injected compiler failure');
    return compileSemanticDesign(model);
  } });
  assert.equal(result.status, 'rejected');
  assert.equal(result.stage, 'font-compilation');
  assert.match(result.error, /injected compiler failure/);
  assert.equal(result.candidate, null);
  assert.equal(baseSnapshot(start), snapshot);
});

test('acceptance creates a separate immutable revision and follow-up does not replay the add-h operation', () => {
  const { start, result } = resolved();
  const accepted = acceptCandidate(result);
  assert.equal(accepted.acceptedRevisionId, result.revision.id);
  assert.ok(Object.isFrozen(accepted.model));
  assert.equal(start.model.revisions.headRevisionId, result.sourceRevisionId);
  assert.equal(result.revision.status, 'candidate');
  const acceptedSnapshot = json({ model: accepted.model, family: accepted.family });
  const followup = runFollowup(accepted);
  assert.equal(followup.status, 'committed-candidate', followup.error || 'follow-up failed');
  assert.equal(followup.revision.parentRevisionIds[0], accepted.acceptedRevisionId);
  assert.deepEqual(followup.revision.operationIds, [followup.revision.operationIds[0]]);
  assert.notEqual(followup.revision.operationIds[0], result.operation.id);
  assert.equal(followup.revision.deltaOperationIds.includes(result.operation.id), false);
  assert.equal(json({ model: accepted.model, family: accepted.family }), acceptedSnapshot);
  assert.notEqual(followup.model.derived.geometry.glyphs[H_GLYPH_ID].constructionHash,
    accepted.model.derived.geometry.glyphs[H_GLYPH_ID].constructionHash);
});

test('the parent revision and every request source record remain traceable in candidate provenance', () => {
  const { result } = resolved();
  const h = result.model.glyphRegistry.glyphs.find(item => item.id === H_GLYPH_ID);
  const constructionIntent = result.interpreted.intents.find(item => item.kind === 'construction');
  assert.equal(h.construction.provenance.operationId, result.operation.id);
  assert.equal(h.construction.provenance.sourceRevisionId, result.sourceRevisionId);
  assert.deepEqual(h.construction.provenance.intentIds, result.operation.provenance.intentIds);
  assert.equal(result.model.input.messages.at(-1).text, SUPPORTED_REQUEST);
  assert.ok(result.operation.provenance.intentIds.includes(constructionIntent.id));
  assert.equal(result.model.lowercaseHTopologyStaging.status, 'constructed');
  assert.equal(result.model.lowercaseHTopologyStaging.constructionHash, hash(json(h.construction)));
});
