import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { compileSemanticDesign, compilerProject, createAcceptedSource, expectedMetrics, interpretRequest,
  operationHandlers, prepareTopologyTransaction, runFollowup, runPreparedTransaction, runTopologyRequest,
  acceptCandidate, SUPPORTED_REQUEST, GLYPH_A, TOPOLOGY_OPERATION } from './scenario.mjs';
import { executeTransaction } from '../../integration-experiment/engine.mjs';
import { design, derive, resolve } from '../two-storey-grammar/grammar.mjs';
import { fontPoints } from '../../../../prototype/src/contours.js';

const clone = structuredClone;
const hash = value => createHash('sha256').update(value).digest('hex');

function sampleTrueTypeContour(points, steps = 64) {
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true });
  const expanded = [];
  for (let i = 0; i < points.length; i++) {
    const current = points[i], next = points[(i + 1) % points.length];
    expanded.push(current);
    if (!current.on && !next.on) expanded.push(midpoint(current, next));
  }
  const startIndex = expanded.findIndex(point => point.on);
  assert.notEqual(startIndex, -1, 'TrueType contour has an on-curve point');
  const ordered = [...expanded.slice(startIndex), ...expanded.slice(0, startIndex), expanded[startIndex]];
  const samples = [];
  let current = ordered[0];
  for (let i = 1; i < ordered.length;) {
    if (ordered[i].on) {
      const end = ordered[i];
      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        samples.push({ x: current.x + (end.x - current.x) * t, y: current.y + (end.y - current.y) * t });
      }
      current = end;
      i++;
    } else {
      const control = ordered[i], end = ordered[i + 1];
      assert.ok(end?.on, 'implicit TrueType off-curve pairs are expanded');
      for (let step = 0; step <= steps; step++) {
        const t = step / steps, u = 1 - t;
        samples.push({ x: u * u * current.x + 2 * u * t * control.x + t * t * end.x,
          y: u * u * current.y + 2 * u * t * control.y + t * t * end.y });
      }
      current = end;
      i += 2;
    }
  }
  return samples;
}

function assertSampledOutlinesAgree(sourceContour, compiledPoints, tolerance = 1.25) {
  // sampleContour only records the endpoints of line segments. Sample lines too,
  // so its point density is comparable with the decoded TrueType path.
  const expected = [];
  let current = sourceContour.start;
  for (const segment of sourceContour.segments) {
    for (let step = 0; step <= 64; step++) {
      if (expected.length && step === 0) continue;
      const t = step / 64;
      if (segment.type === 'line') expected.push({ x: current.x + (segment.to.x - current.x) * t,
        y: current.y + (segment.to.y - current.y) * t });
      else {
        const u = 1 - t;
        expected.push({ x: u * u * segment.from.x + 2 * u * t * segment.control.x + t * t * segment.to.x,
          y: u * u * segment.from.y + 2 * u * t * segment.control.y + t * t * segment.to.y });
      }
    }
    current = segment.to;
  }
  const actual = sampleTrueTypeContour(compiledPoints, 64);
  const nearest = (point, values) => Math.min(...values.map(candidate => Math.hypot(point.x - candidate.x, point.y - candidate.y)));
  const hausdorff = Math.max(...expected.map(point => nearest(point, actual)), ...actual.map(point => nearest(point, expected)));
  assert.ok(hausdorff <= tolerance, `sampled source/compiler outline distance ${hausdorff} exceeds ${tolerance} font units`);
}

function hasStatus(result, status) { assert.equal(result.status, status, result.error || JSON.stringify(result.diagnostics)); }

test('the bounded interpreter preserves exact input and emits explicit construction and preservation provenance', () => {
  const request = `  ${SUPPORTED_REQUEST}  `;
  const result = interpretRequest(request);
  hasStatus(result, 'resolved');
  assert.equal(result.text, request);
  assert.equal(result.targetGlyphName, 'a');
  assert.equal(result.codePoint, 0x0061);
  assert.equal(result.expectedTopology, 'single-storey');
  assert.equal(result.requestedTopology, 'double-storey');
  assert.deepEqual(result.explicit, ['target', 'topology', 'preserve-other-glyphs']);
  assert.deepEqual(result.inferred, []);
  for (const intent of result.intents) assert.equal(request.slice(intent.source.start, intent.source.end), intent.source.text);
  assert.equal(result.intents[0].origin, 'explicit');
  assert.equal(result.intents[1].kind, 'preservation');
  hasStatus(interpretRequest('Change lowercase a to double-storey, keeping every other glyph unchanged.'), 'resolved');
});

test('empty, malformed, unsupported, ambiguous, and conflicting requests produce diagnostics and no operation', () => {
  for (const [input, code] of [
    ['', 'empty-input'], [null, 'malformed-input'],
    ['Make lowercase b double-storey and leave the other glyphs unchanged.', 'unsupported-target'],
    ['Make uppercase A double-storey and leave the other glyphs unchanged.', 'unsupported-target'],
    ['Make the letter a double-storey and leave the other glyphs unchanged.', 'ambiguous-target'],
    ['Make the lowercase a triple-storey and leave the other glyphs unchanged.', 'unsupported-topology'],
    ['Make the lowercase a single-storey and double-storey and leave the other glyphs unchanged.', 'conflicting-topology'],
    ['Make the lowercase a with two bowls.', 'unsupported-request']
  ]) {
    const source = createAcceptedSource(), before = clone(source);
    const result = runTopologyRequest(source, input);
    hasStatus(result, 'rejected');
    assert.equal(result.candidate, null);
    assert.ok(result.diagnostics.some(item => item.code === code), `${input}: expected ${code}`);
    assert.deepEqual(source, before, 'rejected interpretation leaves the accepted source unchanged');
  }
});

test('the maintained executor stages a semantic two-bowl topology candidate and preserves the accepted source', () => {
  const source = createAcceptedSource(), before = clone(source);
  const result = runTopologyRequest(source, SUPPORTED_REQUEST);
  hasStatus(result, 'committed-candidate');
  assert.equal(result.stage, 'compiled-candidate');
  assert.deepEqual(source, before);
  assert.equal(result.revision.parentRevisionIds[0], source.model.revisions.headRevisionId);
  assert.equal(result.revision.status, 'candidate');
  assert.deepEqual(result.revision.operationIds, ['op:nl-double-storey-a']);
  assert.deepEqual(result.revision.targetedGlyphIds, [GLYPH_A]);
  assert.deepEqual([...result.revision.preservedGlyphIds].sort(), ['glyph:u0048', 'glyph:u006e', 'glyph:u006f']);
  assert.equal(result.operation.type, TOPOLOGY_OPERATION);
  assert.deepEqual(result.operation.provenance.intentIds, result.interpreted.intents.map(intent => intent.id));
  assert.deepEqual(result.model.input.messages.at(-1), { id: 'msg:nl-topology-1', text: SUPPORTED_REQUEST });
});

test('semantic topology contains two enclosed bowls, stable shared identities, and explicit new nodes', () => {
  const source = createAcceptedSource();
  const result = runTopologyRequest(source, SUPPORTED_REQUEST);
  hasStatus(result, 'committed-candidate');
  const accepted = source.model.glyphRegistry.glyphs.find(item => item.id === GLYPH_A);
  const candidate = result.model.glyphRegistry.glyphs.find(item => item.id === GLYPH_A);
  const stack = result.model.constructionIntegration.instances[GLYPH_A].design;
  const resolved = resolve(stack);
  assert.equal(candidate.construction.method, 'construction.spine-and-bowl-stack');
  assert.equal(candidate.construction.parameters.topology, 'double-storey');
  assert.equal(resolved.bowls.length, 2);
  assert.equal(stack.construction.nodes.filter(node => node.component === 'counter').length, 2);
  assert.equal(stack.construction.nodes.filter(node => node.component === 'connector').length, 1);
  assert.deepEqual([...candidate.construction.identityDiff.preservedNodeIds].sort(),
    accepted.construction.nodes.map(node => node.id).sort());
  assert.deepEqual([...candidate.construction.identityDiff.addedNodeIds].sort(),
    ['part:a-middle-connector', 'part:a-upper-bowl', 'part:a-upper-counter'].sort());
  assert.equal(candidate.construction.nodes.find(node => node.id === 'part:a-stem').id, 'part:a-stem');
  assert.deepEqual(stack.revision.operation.provenance.intentIds, result.operation.provenance.intentIds);
  assert.equal(stack.revision.parent, source.model.constructionIntegration.instances[GLYPH_A].design.revision.id);
});

test('derived geometry and explicit metric policy agree with measured bounds', () => {
  const source = createAcceptedSource(), result = runTopologyRequest(source, SUPPORTED_REQUEST);
  hasStatus(result, 'committed-candidate');
  assert.deepEqual(expectedMetrics(source.model), {
    bounds: { xMin: 55, yMin: 0, xMax: 595, yMax: 500 },
    metrics: { advanceWidth: 650, leftSideBearing: 55, rightSideBearing: 55 }, contourCount: 2, counters: 1
  });
  assert.deepEqual(expectedMetrics(result.model), {
    bounds: { xMin: 55, yMin: 0, xMax: 595, yMax: 500 },
    metrics: { advanceWidth: 650, leftSideBearing: 55, rightSideBearing: 55 }, contourCount: 3, counters: 2
  });
  assert.equal(result.operation.metricPolicy.advance, 'preserve');
  assert.equal(result.operation.metricPolicy.bearings, 'recompute-from-derived-bounds');
  assert.ok(result.revision.invalidated.includes('kerning'));
});

test('the validated canonical points are the exact points supplied to the compiler and compiled outlines agree by sampling', () => {
  const source = createAcceptedSource(), result = runTopologyRequest(source, SUPPORTED_REQUEST);
  hasStatus(result, 'committed-candidate');
  for (const [model, font] of [[source.model, result.sourceFont], [result.model, result.candidateFont]]) {
    const project = compilerProject(model);
    for (const id of project.glyphOrder) {
      const inputGlyph = project.glyphs[id];
      const parsedGlyph = font.parsed.glyphs[inputGlyph.name];
      assert.ok(parsedGlyph, `compiled ${inputGlyph.name} exists`);
      assert.deepEqual(inputGlyph.contours.map(fontPoints),
        model.derived.geometry.glyphs[id].contours.map(fontPoints), `${inputGlyph.name}: compiler input matches validated geometry`);
      if (id === GLYPH_A) {
        assert.equal(inputGlyph.contours.length, parsedGlyph.contours.length);
        for (let i = 0; i < inputGlyph.contours.length; i++) {
          assertSampledOutlinesAgree(inputGlyph.contours[i], parsedGlyph.contours[i].points);
        }
      }
    }
  }
});

test('source and candidate fonts retain U+0061, expected metrics, and unchanged unrelated glyphs', () => {
  const source = createAcceptedSource(), result = runTopologyRequest(source, SUPPORTED_REQUEST);
  hasStatus(result, 'committed-candidate');
  assert.equal(result.sourceFont.audit.valid, true);
  assert.equal(result.candidateFont.audit.valid, true);
  assert.deepEqual(result.sourceFont.parsed.glyphs.a.unicodes, [0x0061]);
  assert.deepEqual(result.candidateFont.parsed.glyphs.a.unicodes, [0x0061]);
  assert.equal(result.sourceFont.parsed.glyphs.a.advanceWidth, 650);
  assert.equal(result.candidateFont.parsed.glyphs.a.advanceWidth, 650);
  for (const name of ['o', 'n', 'H']) {
    assert.deepEqual(result.sourceFont.parsed.glyphs[name], result.candidateFont.parsed.glyphs[name], `${name} compiled unchanged`);
  }
  assert.notDeepEqual(result.sourceFont.parsed.glyphs.a.contours, result.candidateFont.parsed.glyphs.a.contours);
});

test('missing and ambiguous lowercase-a targets are rejected before the executor creates a candidate', () => {
  const missing = createAcceptedSource();
  missing.model.glyphRegistry.glyphs = missing.model.glyphRegistry.glyphs.filter(item => item.id !== GLYPH_A);
  missing.family.glyphOrder = missing.family.glyphOrder.filter(id => id !== GLYPH_A);
  delete missing.family.glyphs[GLYPH_A];
  const missingResult = prepareTopologyTransaction(missing, SUPPORTED_REQUEST);
  assert.equal(missingResult.status, 'rejected');
  assert.equal(missingResult.stage, 'target-resolution');
  assert.equal(missingResult.candidate, null);

  const ambiguous = createAcceptedSource();
  const duplicate = clone(ambiguous.model.glyphRegistry.glyphs.find(item => item.id === GLYPH_A));
  duplicate.id = 'glyph:u0061-alt';
  ambiguous.model.glyphRegistry.glyphs.push(duplicate);
  const ambiguousResult = prepareTopologyTransaction(ambiguous, SUPPORTED_REQUEST);
  assert.equal(ambiguousResult.status, 'rejected');
  assert.equal(ambiguousResult.stage, 'target-resolution');
  assert.equal(ambiguousResult.diagnostics[0].code, 'ambiguous-target');
});

test('stale glyph selectors, root revisions, and incompatible current topologies are rejected', () => {
  const source = createAcceptedSource(), prepared = prepareTopologyTransaction(source, SUPPORTED_REQUEST);
  hasStatus(prepared, 'ready');
  const staleSelector = clone(prepared);
  staleSelector.model.selectors.find(item => item.id === 'sel:nl-lowercase-a').registryRevisionId = 'rev:stale-registry';
  assert.match(executeTransaction(staleSelector.model, staleSelector.family, { operationHandlers: operationHandlers() }).error, /stale/iu);

  const staleRoot = clone(prepared);
  staleRoot.model.operations[0].preconditions[0].id = 'rev:stale-design';
  assert.match(executeTransaction(staleRoot.model, staleRoot.family, { operationHandlers: operationHandlers() }).error, /stale revision/iu);

  const incompatible = createAcceptedSource();
  const stack = design(2);
  Object.assign(stack, { id: GLYPH_A, name: 'a', characterIdentity: [97], encoding: [97] });
  stack.revision = { id: 'construction:already-double', status: 'accepted', parent: null };
  incompatible.model.constructionIntegration.instances[GLYPH_A].design = stack;
  const mismatch = runTopologyRequest(incompatible, SUPPORTED_REQUEST);
  assert.equal(mismatch.status, 'rejected');
  assert.equal(mismatch.stage, 'transaction');
  assert.match(mismatch.error, /expected single-storey/iu);
});

test('invalid semantic construction and geometry derivation roll back the complete transaction', () => {
  const source = createAcceptedSource(), before = clone(source);
  const badConstruction = runTopologyRequest(source, SUPPORTED_REQUEST, {
    constructDoubleStorey: () => {
      const invalid = design(2);
      invalid.construction.relations = invalid.construction.relations.filter(item => !(item.type === 'contained-by' && item.source === 'counter:1'));
      return invalid;
    }
  });
  assert.equal(badConstruction.status, 'rejected');
  assert.equal(badConstruction.stage, 'transaction');
  assert.match(badConstruction.error, /Every bowl needs its own counter/iu);
  assert.deepEqual(source, before);

  const badGeometry = runTopologyRequest(source, SUPPORTED_REQUEST, { deriveTopology: () => { throw new Error('injected geometry derivation failure'); } });
  assert.equal(badGeometry.status, 'rejected');
  assert.match(badGeometry.error, /injected geometry derivation failure/iu);
  assert.deepEqual(source, before);
});

test('operation validation rejects invalid derived contours without accepting or mutating the source', () => {
  const source = createAcceptedSource(), before = clone(source);
  const invalid = runTopologyRequest(source, SUPPORTED_REQUEST, { deriveTopology: stack => ({
    ...derive(stack), contours: [], bounds: { xMin: 55, yMin: 0, xMax: 595, yMax: 500 },
    metrics: { advanceWidth: 650, leftSideBearing: 55, rightSideBearing: 55 }
  }) });
  assert.equal(invalid.status, 'rejected');
  assert.equal(invalid.stage, 'transaction');
  assert.match(invalid.error, /invalid glyph a|contour|outline/iu);
  assert.deepEqual(source, before);
});

test('font compilation failure prevents candidate publication and acceptance', () => {
  const source = createAcceptedSource(), before = clone(source);
  let calls = 0;
  const result = runTopologyRequest(source, SUPPORTED_REQUEST, { compile: model => {
    calls++;
    if (calls === 2) throw new Error('injected font compilation failure');
    return compileSemanticDesign(model);
  } });
  assert.equal(result.status, 'rejected');
  assert.equal(result.stage, 'font-compilation');
  assert.equal(result.candidate, null);
  assert.match(result.error, /injected font compilation failure/iu);
  assert.deepEqual(source, before);
  assert.throws(() => acceptCandidate(result), /compiled candidate/iu);
});

test('acceptance seals the compiled candidate and preserves separate immutable accepted revisions', () => {
  const source = createAcceptedSource(), before = clone(source);
  const candidate = runTopologyRequest(source, SUPPORTED_REQUEST);
  hasStatus(candidate, 'committed-candidate');
  const accepted = acceptCandidate(candidate);
  assert.equal(accepted.model.revisions.acceptedRevisionId, candidate.revision.id);
  assert.equal(accepted.model.revisions.items.at(-1).status, 'accepted');
  assert.equal(accepted.model.constructionIntegration.instances[GLYPH_A].design.revision.status, 'accepted');
  assert.ok(Object.isFrozen(accepted.model));
  assert.ok(Object.isFrozen(accepted.family));
  assert.deepEqual(source, before);
  assert.throws(() => acceptCandidate({ ...candidate, seal: 'tampered' }), /unchanged/iu);
});

test('a follow-up transaction applies only its new semantic delta after accepting the topology candidate', () => {
  const source = createAcceptedSource();
  const topology = runTopologyRequest(source, SUPPORTED_REQUEST);
  const accepted = acceptCandidate(topology);
  const before = { model: clone(accepted.model), family: clone(accepted.family) };
  const followup = runFollowup(accepted);
  hasStatus(followup, 'committed-candidate');
  assert.deepEqual(followup.model.revisions.items.at(-1).parentRevisionIds, [accepted.acceptedRevisionId]);
  assert.deepEqual(followup.model.revisions.items.at(-1).operationIds, ['op:a-upper-bowl-width-followup']);
  assert.deepEqual(followup.model.operations.map(item => item.id), ['op:a-upper-bowl-width-followup']);
  assert.equal(followup.model.revisions.items.at(-1).status, 'candidate');
  assert.equal(resolve(followup.model.constructionIntegration.instances[GLYPH_A].design).bowls.length, 2);
  assert.equal(followup.model.constructionIntegration.instances[GLYPH_A].design.construction.nodes.find(node => node.id === 'bowl:1').parameters.width, 0.62);
  assert.deepEqual([...followup.model.revisions.items.at(-1).preservedGlyphIds].sort(), ['glyph:u0048', 'glyph:u006e', 'glyph:u006f']);
  assert.equal(followup.font.audit.valid, true);
  assert.deepEqual({ model: accepted.model, family: accepted.family }, before, 'accepted topology candidate remains immutable');
});

test('the accepted topology operation cannot be replayed as a follow-up delta', () => {
  const source = createAcceptedSource(), candidate = runTopologyRequest(source, SUPPORTED_REQUEST);
  const accepted = acceptCandidate(candidate);
  const replay = prepareTopologyTransaction(accepted, SUPPORTED_REQUEST);
  hasStatus(replay, 'ready');
  const result = runPreparedTransaction(replay);
  assert.equal(result.status, 'rejected');
  assert.match(result.error, /already present in accepted revision history/iu);
});

test('both compiled outlines use the established compiler and internal SFNT audit', () => {
  const source = createAcceptedSource(), candidate = runTopologyRequest(source, SUPPORTED_REQUEST);
  hasStatus(candidate, 'committed-candidate');
  assert.equal(candidate.sourceFont.audit.valid, true);
  assert.equal(candidate.candidateFont.audit.valid, true);
  assert.equal(candidate.sourceFont.checksumsVerified, true);
  assert.equal(candidate.candidateFont.checksumsVerified, true);
  assert.deepEqual(candidate.sourceFont.parsed.glyphs.a.unicodes, [97]);
  assert.deepEqual(candidate.candidateFont.parsed.glyphs.a.unicodes, [97]);
  assert.equal(candidate.candidateFont.parsed.glyphs.a.contours.length, 3);
  assert.equal(candidate.sourceFont.parsed.glyphs.a.contours.length, 2);
});
