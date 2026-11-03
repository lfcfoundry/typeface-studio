import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileSemanticDesign } from '../../construction-experiment/font-adapter.mjs';
import { acceptWholeFontCandidate, createDefaultAcceptedSource, prepareCoordinatedCandidate, recordVisualReview,
  runFollowup, runPreparedCandidate, runWholeFontBrief } from '../candidate.mjs';
import { validateWholeFontSpec } from '../contract.mjs';
import { planCoordinatedSpecimen } from '../planner.mjs';
import { resolveWholeFontBrief, SUPPORTED_BRIEF, SUPPORTED_BRIEF_VARIANT } from '../resolver.mjs';

const json = value => JSON.stringify(value);
const snapshot = source => json({ model: source.model, family: source.family });
const sha = value => createHash('sha256').update(value).digest('hex');

test('the bounded whole-brief resolver preserves text, spans, scopes, qualitative intent, and provenance', () => {
  const result = resolveWholeFontBrief(SUPPORTED_BRIEF);
  assert.equal(result.status, 'resolved-with-limitations');
  const spec = result.specification;
  assert.equal(spec.brief.text, SUPPORTED_BRIEF);
  for (const item of spec.decisions.filter(decision => decision.origin === 'explicit')) {
    assert.equal(spec.brief.text.slice(item.source.start, item.source.end), item.source.text);
  }
  assert.equal(spec.decisions.find(item => item.id === 'decision:stroke-consistency').scope.kind, 'family');
  assert.equal(spec.decisions.find(item => item.id === 'decision:lowercase-a-topology').scope.kind, 'glyph');
  assert.equal(spec.decisions.find(item => item.id === 'decision:tall-x-height').value.kind, 'qualitative');
  assert.equal(spec.decisions.find(item => item.id === 'decision:humanist-direction').capability, 'unsupported');
  assert.equal(spec.decisions.find(item => item.id === 'decision:rounded-terminals').capability, 'unsupported');
  assert.equal(spec.decisions.find(item => item.id === 'decision:small-size-readability').capability, 'review-required');
  assert.equal(spec.defaults[0].origin, 'defaulted');
  assert.equal(spec.decisions.some(item => item.origin === 'inferred'), false);
  assert.deepEqual(validateWholeFontSpec(spec), []);
});

test('one documented wording variant is accepted, while unsupported, ambiguous, conflicting, and malformed input is explicit', () => {
  assert.equal(resolveWholeFontBrief(SUPPORTED_BRIEF_VARIANT).status, 'resolved-with-limitations');
  const cases = [
    [null, 'invalid'], ['', 'invalid'], ['Create a serif typeface with a conventional double-storey lowercase a.', 'unsupported'],
    ['Create a sans-serif typeface with slab serifs and a conventional double-storey lowercase a.', 'conflict'],
    ['Make a double-storey a.', 'ambiguous'],
    ['Create a humanist sans-serif typeface with a lowercase g and double-storey a.', 'unsupported']
  ];
  for (const [text, expected] of cases) assert.equal(resolveWholeFontBrief(text).status, expected, String(text));
});

test('invalid schemas and fabricated source spans are rejected deterministically', () => {
  const spec = structuredClone(resolveWholeFontBrief(SUPPORTED_BRIEF).specification);
  spec.decisions[0].source.end += 1;
  assert.match(validateWholeFontSpec(spec).join(' '), /invalid source span/u);
  const duplicate = structuredClone(resolveWholeFontBrief(SUPPORTED_BRIEF).specification);
  duplicate.decisions[1].id = duplicate.decisions[0].id;
  assert.match(validateWholeFontSpec(duplicate).join(' '), /unique/u);
});

test('the planner binds shared decisions to existing construction nodes and refuses the bad double-storey-a geometry', () => {
  const source = createDefaultAcceptedSource();
  const result = resolveWholeFontBrief(SUPPORTED_BRIEF);
  const plan = planCoordinatedSpecimen(result.specification, source.model);
  const byName = Object.fromEntries(plan.glyphs.map(item => [item.name, item]));
  assert.deepEqual(Object.keys(byName).sort(), ['H', 'a', 'h', 'n', 'o'].sort());
  assert.equal(byName.a.constructionCapability, 'blocked');
  assert.equal(byName.a.plannedConstructionMethod, null);
  assert.equal(byName.a.acceptedConstructionMethod, 'construction.bowl-with-attached-stem');
  assert.equal(plan.capabilitySummary.usesDoubleStoreyAExperiment, false);
  assert.equal(byName.h.action, 'add-default-specimen-glyph');
  assert.ok(plan.dependencies.some(item => item.decisionId === 'decision:stroke-consistency' && item.glyphName === 'n'));
  assert.ok(plan.excludedGlyphs.length > 0);
});

test('one coordinated executor transaction records the family resolution, adds h, and preserves the accepted glyphs', () => {
  const source = createDefaultAcceptedSource();
  const before = snapshot(source);
  const result = runWholeFontBrief(source, SUPPORTED_BRIEF);
  assert.equal(result.status, 'committed-candidate', result.error);
  assert.equal(result.candidateStatus, 'technically-valid-not-visually-reviewed');
  assert.equal(result.visualReview.status, 'not-reviewed');
  assert.equal(result.briefCompliance.status, 'incomplete-blocked');
  assert.equal(result.execution.revision.status, 'candidate');
  assert.equal(result.execution.revision.parentRevisionIds[0], result.sourceRevisionId);
  assert.equal(result.execution.revision.operationIds.length, 2);
  const hOperation = result.execution.model.operations.find(item => item.type === 'construct.glyph.add-stem-shoulder-h');
  assert.deepEqual(hOperation.dependsOn, [result.execution.model.operations.find(item => item.type === 'design.brief.resolve-family').id]);
  assert.equal(result.execution.model.constructionIntegration.wholeFontBriefResolution.specification.brief.text, SUPPORTED_BRIEF);
  assert.deepEqual(result.execution.revision.changedGlyphIds, ['glyph:u0068']);
  for (const id of result.execution.parentGlyphIds) {
    assert.equal(json(result.execution.family.glyphs[id]), json(source.family.glyphs[id]));
    const name = source.model.glyphRegistry.glyphs.find(item => item.id === id).name;
    assert.equal(json(result.execution.candidateFont.parsed.glyphs[name]), json(result.execution.sourceFont.parsed.glyphs[name]));
  }
  assert.equal(result.execution.candidateFont.parsed.glyphs.h.unicodes[0], 0x0068);
  assert.equal(snapshot(source), before);
});

test('unsupported or ambiguous language creates no candidate revision', () => {
  const source = createDefaultAcceptedSource();
  const before = snapshot(source);
  const result = runWholeFontBrief(source, 'Create a blackletter font with every English glyph.');
  assert.equal(result.status, 'rejected');
  assert.equal(result.candidate, null);
  assert.equal(result.stage, 'resolution');
  assert.equal(snapshot(source), before);
});

test('semantic/geometry and compiler failures roll back the coordinated candidate', () => {
  const source = createDefaultAcceptedSource();
  const before = snapshot(source);
  const prepared = prepareCoordinatedCandidate(source, SUPPORTED_BRIEF);
  const geometryFailure = runWholeFontBrief(source, SUPPORTED_BRIEF, { hOptions: { construct: () => { throw new Error('forced semantic construction failure'); } } });
  assert.equal(geometryFailure.candidateStatus, 'construction-geometry-invalid');
  assert.equal(geometryFailure.candidate, null);
  assert.equal(snapshot(source), before);
  const compileFailure = runWholeFontBrief(source, SUPPORTED_BRIEF, { compile: () => { throw new Error('forced compilation failure'); } });
  assert.equal(compileFailure.candidateStatus, 'compilation-failed');
  assert.equal(compileFailure.candidate, null);
  assert.equal(snapshot(source), before);
  assert.equal(prepared.status, 'ready');
});

test('a later dependent operation failure rolls back the earlier family-resolution and h operations together', () => {
  const source = createDefaultAcceptedSource();
  const before = snapshot(source);
  const prepared = prepareCoordinatedCandidate(source, SUPPORTED_BRIEF);
  const addH = prepared.model.operations.find(item => item.type === 'construct.glyph.add-stem-shoulder-h');
  const selector = prepared.model.selectors.find(item => item.id === 'sel:h-target');
  const failureIntent = prepared.model.intent.statements.find(item => item.id === 'intent:default-specimen-h');
  prepared.model.operations.push({ id: 'op:test-fail-after-h', type: 'construct.h.set-shoulder-rise', selectorId: selector.id,
    parameters: { glyphId: 'glyph:u0068', expectedConstructionHash: 'stale-hash', expectedOuterControlRiseRatio: 0.6, outerControlRiseRatio: 0.55 },
    phase: 'construction', dependsOn: [addH.id], preconditions: [{ type: 'revision', id: prepared.sourceRevisionId }],
    postconditions: [], metricPolicy: { advance: 'preserve', bearings: 'preserve', kerning: 'invalidate-for-review' },
    provenance: { intentIds: [failureIntent.id], acceptedDecisionIds: [] }, capability: 'implemented-experiment',
    resolution: { status: 'resolved', reason: null }, conflicts: [], exceptions: [] });
  const result = runPreparedCandidate(prepared);
  assert.equal(result.candidate, null);
  assert.equal(result.candidateStatus, 'construction-geometry-invalid');
  assert.match(result.error, /stale or invalid h shoulder follow-up/iu);
  assert.equal(snapshot(source), before);
});

test('technical success and FontFace evidence never set visual approval; human review is separately recorded', () => {
  const candidate = runWholeFontBrief(createDefaultAcceptedSource(), SUPPORTED_BRIEF);
  assert.equal(candidate.technicalStatus, 'passed');
  assert.equal(candidate.candidateStatus, 'technically-valid-not-visually-reviewed');
  assert.throws(() => acceptWholeFontCandidate(candidate), /visual approval/u);
  assert.throws(() => recordVisualReview(candidate, { reviewer: '', decision: 'approved', evidenceRefs: ['loaded-font'] }), /review requires/u);
  const unapproved = recordVisualReview(candidate, { reviewer: 'test-only reviewer', decision: 'not-approved', notes: 'Test fixture only.', evidenceRefs: ['test://capture'] });
  assert.equal(unapproved.candidateStatus, 'visually-reviewed-not-approved');
  assert.throws(() => acceptWholeFontCandidate(unapproved, { acceptIncompleteScope: true }), /visual approval/u);
  const approved = recordVisualReview(candidate, { reviewer: 'test-only reviewer', decision: 'approved', notes: 'Simulated state-transition test only.', evidenceRefs: ['test://capture'] });
  assert.equal(approved.candidateStatus, 'visually-approved');
  assert.throws(() => acceptWholeFontCandidate(approved), /explicit acknowledgement/u);
  const accepted = acceptWholeFontCandidate(approved, { acceptIncompleteScope: true });
  assert.equal(accepted.acceptedScope, 'partial-specimen-only');
  assert.equal(accepted.acceptedRevisionId, candidate.candidateRevisionId);
  const followup = runFollowup(accepted, { id: 'op:whole-font-test-followup', outerControlRiseRatio: 0.56 });
  assert.equal(followup.status, 'committed-candidate');
  assert.equal(followup.revision.parentRevisionIds[0], accepted.acceptedRevisionId);
  assert.deepEqual(followup.revision.deltaOperationIds, ['op:whole-font-test-followup']);
  assert.ok(followup.model.constructionIntegration.wholeFontBriefResolution);
  assert.equal(accepted.acceptedRevisionId, candidate.candidateRevisionId);
});

test('the build compiler is the existing diagnostic font adapter, not a contour-specific replacement', () => {
  const source = createDefaultAcceptedSource();
  const compiled = compileSemanticDesign(source.model);
  assert.equal(compiled.audit.valid, true);
  assert.equal(compiled.parsed.glyphs.a.unicodes[0], 0x0061);
  assert.ok(sha(Buffer.from(compiled.bytes)));
});
