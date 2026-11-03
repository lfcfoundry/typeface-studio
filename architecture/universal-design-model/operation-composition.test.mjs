import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  executeTransaction,
  resolveSelector,
  validateV2Model
} from './integration-experiment/engine.mjs';
import {
  fixture,
  operation,
  operationHandlers,
  accept as acceptRevision
} from './construction-experiment/transaction-composition/integration.mjs';
import {
  executeTransaction as prerequisiteExecutor
} from './construction-experiment/transaction-composition/baseline/architecture/universal-design-model/integration-experiment/engine.mjs';
import { spineAdapter } from './construction-experiment/cross-grammar-aperture/grammars.mjs';
import { derive as deriveSpine } from './construction-experiment/cross-grammar-aperture/operation.mjs';

const clone = structuredClone;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function runMaintained(base, operations) {
  try {
    if (base.model.revisions.acceptedRevisionId !== base.model.revisions.headRevisionId || base.model.revisions.items.at(-1).status !== 'accepted')
      throw new Error('Transactions must start from accepted state');
    const model = clone(base.model);
    const history = model.constructionIntegration.operationHistory;
    for (const previous of model.operations) if (!history.some(item => item.id === previous.id)) history.push(clone(previous));
    if (operations.some(item => history.some(old => old.id === item.id))) throw new Error('Operation identity already accepted');
    model.operations = clone(operations);
    model.intent.statements.push(...operations.map(item => ({
      id: item.provenance.intentIds[0],
      origin: 'explicit',
      predicate: item.type,
      source: clone(item.provenance.source || { text: 'Explicit experimental operation' })
    })));
    for (const selector of model.selectors) {
      if (selector.registryRevisionId !== model.glyphRegistry.revisionId) throw new Error('Stale glyph selector');
      const fresh = resolveSelector(selector, model.glyphRegistry.glyphs, { registryRevisionId: model.glyphRegistry.revisionId });
      if (hash(fresh.includedGlyphIds) !== hash(selector.resolution.includedGlyphIds)) throw new Error('Selector snapshot differs from expression');
    }
    for (const item of operations) if (!Object.hasOwn(operationHandlers, item.type)) throw new Error('Unregistered integrated operation');
    const result = executeTransaction(model, base.family, { operationHandlers });
    if (result.status === 'rejected') return { ...result, model: base.model, family: base.family };
    return { ...result, seal: hash({ model: result.model, family: result.family }) };
  } catch (error) {
    return { status: 'rejected', error: error.message, model: base.model, family: base.family, revision: null };
  }
}

function accept(result) {
  if (result.status !== 'committed-candidate' || result.seal !== hash({ model: result.model, family: result.family }))
    throw new Error('Only an unmodified validated candidate can be accepted');
  const accepted = { model: clone(result.model), family: clone(result.family) };
  const errors = validateV2Model(accepted.model);
  if (errors.length) throw new Error(errors.join('; '));
  accepted.model.revisions.items.at(-1).status = 'accepted';
  accepted.model.revisions.acceptedRevisionId = accepted.model.revisions.headRevisionId;
  for (const instance of Object.values(accepted.model.constructionIntegration.instances)) {
    const design = instance.design;
    if (design?.revisions && design.revisions.headRevisionId !== design.revisions.acceptedRevisionId) {
      const revision = design.revisions.items.find(item => item.id === design.revisions.headRevisionId);
      if (!revision || revision.status !== 'candidate') throw new Error('Cannot accept nested semantic construction revision');
      revision.status = 'accepted';
      design.revisions.acceptedRevisionId = design.revisions.headRevisionId;
    }
  }
  return deepFreeze(accepted);
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function sequences(base) {
  const reflect = operation('geometry.structure.reflect', 'op:reflect', base);
  const aperture = operation('semantic.aperture.open', 'op:aperture', base);
  const reflected = runMaintained(base, [reflect]);
  const opened = runMaintained(base, [aperture]);
  const extend = (candidate, next) => {
    if (candidate.status !== 'committed-candidate' || candidate.model.revisions.items.at(-1).parentRevisionIds[0] !== base.model.revisions.headRevisionId || candidate.seal !== hash({ model: candidate.model, family: candidate.family }))
      throw new Error('Invalid candidate continuation');
    return runMaintained(base, [...candidate.model.operations, next]);
  };
  return {
    reflection: reflected,
    aperture: opened,
    A: extend(reflected, { ...aperture, dependsOn: [reflect.id] }),
    B: extend(opened, { ...reflect, dependsOn: [aperture.id] })
  };
}

test('maintained executor preserves built-in reflection behavior while extending its dispatch', () => {
  const base = fixture();
  const model = clone(base.model);
  model.operations = [{ ...operation('geometry.structure.reflect', 'legacy', base), type: 'geometry.reflect', parameters: {} }];
  assert.deepEqual(validateV2Model(model), []);
  const original = prerequisiteExecutor(model, base.family);
  const maintained = executeTransaction(model, base.family, { operationHandlers });
  assert.equal(original.status, 'committed-candidate');
  assert.equal(maintained.status, original.status);
  assert.deepEqual(maintained.family, original.family);
  assert.deepEqual(maintained.model.selectors, original.model.selectors);
  assert.deepEqual(maintained.order, original.order);
  assert.notEqual(maintained.revision.id, original.revision.id, 'revision identity now includes transaction content');
});

test('registered reflection and aperture compose in either dependency order for ring and spine grammars', () => {
  assert.deepEqual(Object.keys(operationHandlers).sort(), ['geometry.structure.reflect', 'semantic.aperture.open', 'semantic.terminal.set-profile']);
  for (const kind of ['ring', 'spine']) {
    const base = fixture(kind);
    const snapshot = clone(base);
    const result = sequences(base);
    for (const key of ['reflection', 'aperture', 'A', 'B']) assert.equal(result[key].status, 'committed-candidate', result[key].error);
    assert.deepEqual(base, snapshot, 'accepted inputs stay unchanged');
    assert.deepEqual(result.A.order, ['op:reflect', 'op:aperture']);
    assert.deepEqual(result.B.order, ['op:aperture', 'op:reflect']);
    assert.deepEqual(result.A.family, result.B.family, 'object-attached aperture semantics yield equal output');
    assert.notEqual(result.A.revision.id, result.B.revision.id);
    assert.equal(result.A.model.revisions.acceptedRevisionId, base.model.revisions.acceptedRevisionId);
    assert.deepEqual(result.A.model.constructionIntegration.trace.map(item => item.operationId), result.A.order);
  }
});

test('single-storey a terminal profile changes semantic state and derives bounded geometry through the maintained handler', () => {
  const base = fixture('a');
  const before = clone(base);
  const op = operation('semantic.terminal.set-profile', 'set-upper-terminal', base);
  const result = runMaintained(base, [op]);
  assert.equal(result.status, 'committed-candidate', result.error);
  assert.deepEqual(base, before, 'accepted model and family stay unchanged');

  const main = result.model.constructionIntegration.instances.main;
  const support = result.model.constructionIntegration.instances.support;
  const source = main.design.glyphRegistry.glyphs.find(item => item.id === main.sourceGlyphId);
  const oldSource = base.model.constructionIntegration.instances.main.design.glyphRegistry.glyphs.find(item => item.id === main.sourceGlyphId);
  const terminal = source.construction.nodes.find(item => item.id === op.parameters.terminalId);
  const oldTerminal = oldSource.construction.nodes.find(item => item.id === op.parameters.terminalId);
  assert.equal(terminal.id, oldTerminal.id);
  assert.equal(terminal.role, 'upper-stem-terminal');
  assert.deepEqual(terminal.relations, oldTerminal.relations);
  assert.deepEqual(source.construction.nodes.filter(item => item.id !== terminal.id), oldSource.construction.nodes.filter(item => item.id !== terminal.id));
  assert.equal(terminal.parameters.profile, 'chamfered');
  assert.equal(terminal.parameters.orientation, 'outer-right');
  assert.equal(terminal.parameters.cutRatio, 0.2);
  assert.deepEqual(support.design, base.model.constructionIntegration.instances.support.design, 'neighboring construction instance is untouched');

  const rendered = result.family.glyphs['glyph:assembly'];
  assert.deepEqual(rendered.bounds, base.family.glyphs['glyph:assembly'].bounds, 'the chamfer changes no extreme ink coordinate');
  assert.deepEqual(rendered.metrics, { advanceWidth: 1350, leftSideBearing: 55, rightSideBearing: 55 });
  assert.equal(rendered.components[0].id, 'main');
  assert.equal(rendered.components[0].sourceGlyphId, 'glyph:u0061');
  assert.ok(rendered.components[0].nodeIds.includes(terminal.id));
  assert.equal(rendered.components[1].id, 'support');
  assert.equal(rendered.contours.some(contour => contour.segments.some(segment => segment.id === 'main/part:a-upper-terminal.bevel-edge')), true);
  assert.equal(rendered.contours.some(contour => contour.segments.some(segment => segment.id === 'support/part:a-upper-terminal.bevel-edge')), false);
  const derived = main.design.derived.geometry.glyphs['glyph:u0061'];
  assert.deepEqual(derived.bounds, { xMin: 55, yMin: 0, xMax: 595, yMax: 500 });
  assert.deepEqual(derived.metrics, { advanceWidth: 650, leftSideBearing: 55, rightSideBearing: 55 });
  assert.equal(op.metricPolicy.advance, 'preserve');
  assert.equal(op.metricPolicy.bearings, 'recompute-from-derived-bounds');
  assert.equal(result.revision.invalidated.includes('kerning'), true);
  assert.deepEqual(main.design.revisions.items.at(-1).operationIds, [op.id]);
  assert.equal(result.model.intent.statements.at(-1).source.text, op.provenance.source.text);
});

test('spine adapter derives the same semantic chamfer while preserving terminal ownership, flat defaults, and metrics', () => {
  const base = fixture('spine');
  const before = clone(base);
  const op = operation('semantic.terminal.set-profile', 'spine-top-chamfer', base);
  const result = runMaintained(base, [op]);
  assert.equal(result.status, 'committed-candidate', result.error);
  assert.deepEqual(base, before, 'accepted flat model and geometry remain unchanged');
  const main = result.model.constructionIntegration.instances.main;
  const support = result.model.constructionIntegration.instances.support;
  const oldDesign = base.model.constructionIntegration.instances.main.design;
  const terminal = main.design.construction.nodes.find(node => node.id === 'top');
  const oldTerminal = oldDesign.construction.nodes.find(node => node.id === 'top');
  assert.equal(terminal.id, oldTerminal.id);
  assert.equal(terminal.role, 'upper-stem-terminal');
  assert.deepEqual(main.design.construction.relations, oldDesign.construction.relations);
  assert.deepEqual(main.design.construction.nodes.filter(node => node.id !== 'top'), oldDesign.construction.nodes.filter(node => node.id !== 'top'));
  assert.deepEqual(terminal.parameters, { profile: 'chamfered', orientation: 'outer-right', cutRatio: 0.2 });
  assert.deepEqual(support.design, base.model.constructionIntegration.instances.support.design);
  assert.equal(main.design.revision.status, 'candidate');
  assert.equal(main.design.revision.parent, oldDesign.revision.id);
  assert.equal(main.design.revision.operation.parameters.terminalId, 'top');
  assert.equal(main.design.revision.operation.provenance.source.text, op.provenance.source.text);

  const rendered = result.family.glyphs['glyph:assembly'];
  const local = deriveSpine(main.design, spineAdapter);
  assert.deepEqual(local.bounds, { xMin: 55, yMin: 0, xMax: 595, yMax: 500 });
  assert.deepEqual(local.metrics, { advanceWidth: 650, leftSideBearing: 55, rightSideBearing: 55 });
  assert.deepEqual(local.contours[0].segments.find(segment => segment.id === 'terminal.top.bevel-edge'), {
    id: 'terminal.top.bevel-edge', type: 'line', from: { x: 577, y: 500 }, to: { x: 595, y: 482 }
  });
  const bevel = rendered.contours.flatMap(contour => contour.segments).find(segment => segment.id === 'main/terminal.top.bevel-edge');
  assert.ok(bevel);
  assert.deepEqual([[bevel.from.x, bevel.from.y], [bevel.to.x, bevel.to.y]], [[577, 500], [595, 482]]);
  assert.deepEqual(rendered.bounds, base.family.glyphs['glyph:assembly'].bounds);
  assert.deepEqual(rendered.metrics, { advanceWidth: 1350, leftSideBearing: 55, rightSideBearing: 55 });
  assert.deepEqual(result.family.glyphs['glyph:control'].bounds, { xMin: 55, yMin: 0, xMax: 595, yMax: 500 });
  assert.deepEqual(result.family.glyphs['glyph:control'].metrics, { advanceWidth: 650, leftSideBearing: 55, rightSideBearing: 55 });
  assert.equal(op.metricPolicy.advance, 'preserve');
  assert.equal(op.metricPolicy.bearings, 'recompute-from-derived-bounds');
  assert.equal(result.revision.invalidated.includes('kerning'), true);
  assert.equal(result.model.intent.statements.at(-1).source.text, op.provenance.source.text);
});

test('spine terminal requests reject unsupported, malformed, stale, missing, ambiguous, and foreign targets', () => {
  const base = fixture('spine');
  const unsupported = operation('semantic.terminal.set-profile', 'spine-unsupported', base);
  unsupported.parameters.profile = 'rounded';
  assert.match(runMaintained(base, [unsupported]).error, /unsupported requested terminal profile/iu);
  const badRatio = operation('semantic.terminal.set-profile', 'spine-bad-ratio', base);
  badRatio.parameters.cutRatio = 0;
  assert.match(runMaintained(base, [badRatio]).error, /unsupported requested terminal profile/iu);
  const badOrientation = operation('semantic.terminal.set-profile', 'spine-bad-orientation', base);
  badOrientation.parameters.orientation = 'outer-left';
  assert.match(runMaintained(base, [badOrientation]).error, /unsupported requested terminal profile/iu);
  const wrongCurrent = operation('semantic.terminal.set-profile', 'spine-wrong-current', base, { expectedProfile: 'chamfered' });
  assert.match(runMaintained(base, [wrongCurrent]).error, /profile precondition failed/iu);
  const missing = operation('semantic.terminal.set-profile', 'spine-missing-terminal', base, { terminalId: 'absent' });
  assert.match(runMaintained(base, [missing]).error, /missing terminal target/iu);
  const bottom = operation('semantic.terminal.set-profile', 'spine-lower-terminal', base, { terminalId: 'bottom' });
  assert.match(runMaintained(base, [bottom]).error, /unsupported terminal target role/iu);
  const stale = operation('semantic.terminal.set-profile', 'spine-stale-semantic', base);
  stale.parameters.expectedConstructionRevisionId = 'revision:old';
  assert.match(runMaintained(base, [stale]).error, /stale semantic construction revision/iu);
  const duplicate = clone(base);
  duplicate.model.constructionIntegration.instances.main.design.construction.nodes.push(clone(
    duplicate.model.constructionIntegration.instances.main.design.construction.nodes.find(node => node.id === 'top')
  ));
  assert.match(runMaintained(duplicate, [operation('semantic.terminal.set-profile', 'spine-ambiguous', duplicate)]).error, /ambiguous terminal target/iu);
  const foreign = clone(base);
  foreign.model.constructionIntegration.instances.support.ownerGlyphId = 'glyph:other';
  const otherOwner = operation('semantic.terminal.set-profile', 'spine-foreign-owner', foreign, { componentSelectorId: 'component:support' });
  assert.match(runMaintained(foreign, [otherOwner]).error, /component target absent/iu);
});

test('spine terminal profile composes with reflection in either dependency order', () => {
  const base = fixture('spine');
  const terminal = operation('semantic.terminal.set-profile', 'spine-terminal', base);
  const reflection = operation('geometry.structure.reflect', 'spine-reflect', base);
  assert.match(runMaintained(base, [terminal, reflection]).error, /non-commuting/iu);
  const terminalFirst = runMaintained(base, [terminal, { ...reflection, dependsOn: [terminal.id] }]);
  const reflectionFirst = runMaintained(base, [reflection, { ...terminal, dependsOn: [reflection.id] }]);
  assert.equal(terminalFirst.status, 'committed-candidate', terminalFirst.error);
  assert.equal(reflectionFirst.status, 'committed-candidate', reflectionFirst.error);
  assert.deepEqual(terminalFirst.family, reflectionFirst.family);
  assert.deepEqual(terminalFirst.model.constructionIntegration.instances.main.design.construction,
    reflectionFirst.model.constructionIntegration.instances.main.design.construction);
  assert.deepEqual(terminalFirst.family.glyphs['glyph:assembly'].metrics, reflectionFirst.family.glyphs['glyph:assembly'].metrics);
  assert.equal(terminalFirst.model.constructionIntegration.instances.main.reflected, true);
  assert.equal(reflectionFirst.model.constructionIntegration.instances.main.reflected, true);
});

test('spine terminal and aperture operations compose across accepted follow-up revisions in either order', () => {
  const base = fixture('spine');
  const terminalOp = operation('semantic.terminal.set-profile', 'spine-terminal', base);
  const terminalCandidate = runMaintained(base, [terminalOp]);
  assert.equal(terminalCandidate.status, 'committed-candidate', terminalCandidate.error);
  const afterTerminal = { ...acceptRevision(terminalCandidate), kind: 'spine', terminalId: 'top', targetNodeId: 'bowl:1' };
  const apertureAfterTerminal = runMaintained(afterTerminal, [operation('semantic.aperture.open', 'spine-aperture', afterTerminal)]);
  assert.equal(apertureAfterTerminal.status, 'committed-candidate', apertureAfterTerminal.error);

  const apertureOp = operation('semantic.aperture.open', 'spine-aperture', base);
  const apertureCandidate = runMaintained(base, [apertureOp]);
  assert.equal(apertureCandidate.status, 'committed-candidate', apertureCandidate.error);
  const afterAperture = { ...acceptRevision(apertureCandidate), kind: 'spine', terminalId: 'top', targetNodeId: 'bowl:1' };
  const terminalAfterAperture = runMaintained(afterAperture, [operation('semantic.terminal.set-profile', 'spine-terminal', afterAperture)]);
  assert.equal(terminalAfterAperture.status, 'committed-candidate', terminalAfterAperture.error);

  const a = apertureAfterTerminal.model.constructionIntegration.instances.main.design;
  const b = terminalAfterAperture.model.constructionIntegration.instances.main.design;
  const glyphA = apertureAfterTerminal.family.glyphs['glyph:assembly'];
  const glyphB = terminalAfterAperture.family.glyphs['glyph:assembly'];
  assert.deepEqual(a.construction, b.construction);
  assert.deepEqual(a.apertureExtension, b.apertureExtension);
  assert.deepEqual(glyphA.contours, glyphB.contours);
  assert.deepEqual(glyphA.metrics, glyphB.metrics);
  assert.deepEqual(glyphA.bounds, glyphB.bounds);
  assert.deepEqual(glyphA.components.flatMap(component => component.ports), glyphB.components.flatMap(component => component.ports));
  assert.deepEqual(a.construction.nodes.find(node => node.id === 'top').parameters,
    { profile: 'chamfered', orientation: 'outer-right', cutRatio: 0.2 });
});

test('spine terminal transaction rolls back after a later failure and accepted revisions support follow-up deltas', () => {
  const base = fixture('spine');
  const snapshot = clone(base);
  const terminal = operation('semantic.terminal.set-profile', 'spine-terminal-rollback', base);
  const badAperture = operation('semantic.aperture.open', 'spine-failing-aperture', base, { dependsOn: [terminal.id] });
  badAperture.parameters.terminal = 'rounded';
  const failed = runMaintained(base, [terminal, badAperture]);
  assert.equal(failed.status, 'rejected');
  assert.equal(failed.revision, null);
  assert.deepEqual(base, snapshot);

  const candidate = runMaintained(base, [operation('semantic.terminal.set-profile', 'spine-terminal-accepted', base)]);
  assert.equal(candidate.status, 'committed-candidate', candidate.error);
  const accepted = acceptRevision(candidate);
  const acceptedHash = hash(accepted.model);
  const nested = accepted.model.constructionIntegration.instances.main.design;
  assert.equal(nested.revision.status, 'accepted');
  assert.ok(Object.isFrozen(accepted.model));
  const followupBase = { ...accepted, kind: 'spine', terminalId: 'top', targetNodeId: 'bowl:1' };
  const followup = runMaintained(followupBase, [operation('semantic.aperture.open', 'spine-followup-aperture', followupBase)]);
  assert.equal(followup.status, 'committed-candidate', followup.error);
  assert.equal(followup.model.operations.length, 1);
  assert.equal(followup.model.constructionIntegration.operationHistory.some(item => item.id === 'spine-terminal-accepted'), true);
  assert.equal(hash(accepted.model), acceptedHash);
  assert.equal(accepted.model.constructionIntegration.instances.main.design.apertureExtension.apertures.length, 0);
});

test('terminal profile requests reject unsupported values, unknown parameters, missing or ambiguous targets, and stale revisions', () => {
  const base = fixture('a');
  const unsupported = operation('semantic.terminal.set-profile', 'unsupported-profile', base);
  unsupported.parameters.profile = 'rounded';
  assert.match(runMaintained(base, [unsupported]).error, /unsupported requested terminal profile/iu);
  const invalidRatio = operation('semantic.terminal.set-profile', 'invalid-ratio', base);
  invalidRatio.parameters.cutRatio = 0.26;
  assert.match(runMaintained(base, [invalidRatio]).error, /unsupported requested terminal profile/iu);
  const invalidOrientation = operation('semantic.terminal.set-profile', 'invalid-orientation', base);
  invalidOrientation.parameters.orientation = 'outer-left';
  assert.match(runMaintained(base, [invalidOrientation]).error, /unsupported requested terminal profile/iu);
  const missingParameter = operation('semantic.terminal.set-profile', 'missing-parameter', base);
  delete missingParameter.parameters.orientation;
  assert.match(runMaintained(base, [missingParameter]).error, /parameter schema/iu);
  const wrongCurrentProfile = operation('semantic.terminal.set-profile', 'wrong-current-profile', base, { expectedProfile: 'chamfered' });
  assert.match(runMaintained(base, [wrongCurrentProfile]).error, /profile precondition failed/iu);
  const unknown = operation('semantic.terminal.set-profile', 'unknown-parameter', base);
  unknown.parameters.radius = 8;
  assert.match(runMaintained(base, [unknown]).error, /parameter schema/u);
  const missing = operation('semantic.terminal.set-profile', 'missing-terminal', base, { terminalId: 'part:a-absent' });
  assert.match(runMaintained(base, [missing]).error, /missing terminal target/iu);
  const staleSemantic = operation('semantic.terminal.set-profile', 'stale-semantic', base);
  staleSemantic.parameters.expectedConstructionRevisionId = 'rev:stale-construction';
  assert.match(runMaintained(base, [staleSemantic]).error, /stale semantic construction revision/iu);
  const staleOuter = operation('semantic.terminal.set-profile', 'stale-outer', base);
  staleOuter.preconditions[0].id = 'rev:stale-outer';
  assert.match(runMaintained(base, [staleOuter]).error, /stale revision precondition/u);
  const ambiguous = clone(base);
  const semantic = ambiguous.model.constructionIntegration.instances.main.design;
  const glyph = semantic.glyphRegistry.glyphs.find(item => item.id === 'glyph:u0061');
  glyph.construction.nodes.push(clone(glyph.construction.nodes.find(item => item.id === 'part:a-upper-terminal')));
  assert.match(runMaintained(ambiguous, [operation('semantic.terminal.set-profile', 'ambiguous-terminal', ambiguous)]).error, /ambiguous terminal target/iu);
  const multipleInstances = clone(base);
  multipleInstances.model.constructionIntegration.selectors[0].instanceIds = ['main', 'support'];
  assert.match(runMaintained(multipleInstances, [operation('semantic.terminal.set-profile', 'multiple-instances', multipleInstances)]).error, /exactly one construction instance/iu);
  const ring = fixture('ring');
  assert.match(runMaintained(ring, [operation('semantic.terminal.set-profile', 'unsupported-ring-adapter', ring)]).error, /does not support terminal profiles/iu);
});

test('terminal profile and reflection compose in either declared order while preserving object-attached semantics', () => {
  const base = fixture('a');
  const terminal = operation('semantic.terminal.set-profile', 'terminal', base);
  const reflection = operation('geometry.structure.reflect', 'reflection', base);
  assert.match(runMaintained(base, [terminal, reflection]).error, /non-commuting/u);
  const terminalThenReflection = runMaintained(base, [terminal, { ...reflection, dependsOn: [terminal.id] }]);
  const reflectionThenTerminal = runMaintained(base, [reflection, { ...terminal, dependsOn: [reflection.id] }]);
  assert.equal(terminalThenReflection.status, 'committed-candidate', terminalThenReflection.error);
  assert.equal(reflectionThenTerminal.status, 'committed-candidate', reflectionThenTerminal.error);
  assert.deepEqual(terminalThenReflection.family, reflectionThenTerminal.family);
  const a = terminalThenReflection.model.constructionIntegration.instances.main.design;
  const b = reflectionThenTerminal.model.constructionIntegration.instances.main.design;
  assert.deepEqual(a.glyphRegistry.glyphs.find(item => item.id === 'glyph:u0061').construction,
    b.glyphRegistry.glyphs.find(item => item.id === 'glyph:u0061').construction);
  assert.equal(terminalThenReflection.model.constructionIntegration.instances.main.reflected, true);
  assert.equal(reflectionThenTerminal.model.constructionIntegration.instances.main.reflected, true);
  const bevel = terminalThenReflection.family.glyphs['glyph:assembly'].contours.flatMap(contour => contour.segments)
    .find(segment => segment.id === 'main/part:a-upper-terminal.bevel-edge');
  assert.ok(bevel);
  assert.deepEqual([bevel.from.x, bevel.to.x].sort((x, y) => x - y), [55, 73], 'reflection presents the object-attached outer-right chamfer on the left edge');
  assert.notEqual(terminalThenReflection.revision.id, reflectionThenTerminal.revision.id);
  assert.deepEqual(terminalThenReflection.order, [terminal.id, reflection.id]);
  assert.deepEqual(reflectionThenTerminal.order, [reflection.id, terminal.id]);
});

test('later terminal-operation failure rolls back staged semantic changes, geometry, and candidate history', () => {
  const base = fixture('a');
  const snapshot = clone(base);
  const first = operation('semantic.terminal.set-profile', 'terminal-first', base);
  const later = operation('semantic.terminal.set-profile', 'terminal-later', base, { dependsOn: [first.id] });
  later.parameters.expectedProfile = 'chamfered';
  later.parameters.cutRatio = 0;
  const result = runMaintained(base, [first, later]);
  assert.equal(result.status, 'rejected');
  assert.equal(result.revision, null);
  assert.strictEqual(result.model, base.model);
  assert.strictEqual(result.family, base.family);
  assert.deepEqual(base, snapshot);
});

test('accepted terminal revisions are immutable and follow-up transactions execute only new deltas', () => {
  const base = fixture('a');
  const terminal = operation('semantic.terminal.set-profile', 'terminal-accepted', base);
  const candidate = runMaintained(base, [terminal]);
  const candidateSnapshot = clone(candidate);
  const accepted = accept(candidate);
  assert.deepEqual(candidate, candidateSnapshot);
  const nested = accepted.model.constructionIntegration.instances.main.design;
  assert.equal(nested.revisions.acceptedRevisionId, nested.revisions.headRevisionId);
  assert.ok(Object.isFrozen(accepted.model));
  const followupBase = { ...accepted, kind: 'a', terminalId: base.terminalId };
  const followup = operation('geometry.structure.reflect', 'followup-reflect', followupBase);
  const next = runMaintained(followupBase, [followup]);
  assert.equal(next.status, 'committed-candidate', next.error);
  assert.deepEqual(next.model.constructionIntegration.operationHistory.map(item => item.id), [terminal.id]);
  assert.deepEqual(next.model.operations.map(item => item.id), [followup.id]);
  assert.equal(next.model.constructionIntegration.instances.main.design.glyphRegistry.glyphs.find(item => item.id === 'glyph:u0061').construction.nodes.find(item => item.id === terminal.parameters.terminalId).parameters.profile, 'chamfered');
  assert.throws(() => { accepted.model.constructionIntegration.instances.main.reflected = true; }, TypeError);
});

test('construction-instance reflection preserves neighboring instances, glyph identity, and metrics', () => {
  for (const kind of ['ring', 'spine']) {
    const base = fixture(kind);
    const reflected = runMaintained(base, [operation('geometry.structure.reflect', 'reflect-main', base)]);
    const before = base.family.glyphs['glyph:assembly'];
    const after = reflected.family.glyphs['glyph:assembly'];
    assert.deepEqual(after.contours.filter(contour => contour.id.startsWith('support/')), before.contours.filter(contour => contour.id.startsWith('support/')));
    assert.deepEqual(reflected.family.glyphs['glyph:control'], base.family.glyphs['glyph:control']);
    assert.equal(after.components[0].transform.xx, -1);
    assert.equal(after.components[1].transform.xx, 1);
    assert.equal(reflected.model.constructionIntegration.instances.main.design.id, base.model.constructionIntegration.instances.main.design.id);
    assert.equal(after.metrics.advanceWidth, 1350);
    assert.equal(after.id, before.id);
    assert.equal(after.unicode, before.unicode);
  }
});

test('aperture ports retain semantic boundary ownership and reflected cap coordinates in both operation orders', () => {
  for (const kind of ['ring', 'spine']) {
    const base = fixture(kind);
    const result = sequences(base);
    const a = result.A.family.glyphs['glyph:assembly'];
    const b = result.B.family.glyphs['glyph:assembly'];
    const open = result.aperture.family.glyphs['glyph:assembly'];
    assert.deepEqual(a.components[0].ports, b.components[0].ports);
    assert.equal(a.components[0].ports.length, 2);
    for (const [index, port] of a.components[0].ports.entries()) {
      assert.equal(port.id, open.components[0].ports[index].id);
      assert.equal(port.ownerInstanceId, 'main');
      assert.equal(port.boundaryFrame, 'object');
      assert.equal(port.presentationHandedness, 'reflected');
      assert.equal(port.presentationExposedSide, 'right');
      const cap = a.contours.flatMap(contour => contour.segments).find(segment => segment.id === `${port.id}.cap`);
      assert.ok(cap, `missing cap for ${port.id}`);
      assert.deepEqual([cap.from, cap.to].map(point => [point.x, point.y]).sort(), Object.values(port.endpoints).map(point => [point.x, point.y]).sort());
      for (const role of ['outer', 'inner']) assert.equal(port.endpoints[role].x, 650 - open.components[0].ports[index].endpoints[role].x);
    }
    const semantic = result.A.model.constructionIntegration.instances.main.design;
    assert.equal(semantic.apertureExtension.apertures[0].parameterization, 'quadratic-local-t');
    assert.deepEqual(semantic.construction.relations, result.B.model.constructionIntegration.instances.main.design.construction.relations);
    assert.deepEqual(semantic.decisions, base.model.constructionIntegration.instances.main.design.decisions);
  }
});

test('dependency ordering, cycles, unordered conflicts, stale selectors, and stale revision preconditions are enforced', () => {
  const base = fixture();
  const reflection = operation('geometry.structure.reflect', 'reflect', base);
  const aperture = operation('semantic.aperture.open', 'aperture', base);
  const ordered = runMaintained(base, [reflection, { ...aperture, dependsOn: [reflection.id] }]);
  assert.deepEqual(ordered.order, ['reflect', 'aperture']);
  assert.match(runMaintained(base, [{ ...reflection, dependsOn: [aperture.id] }, { ...aperture, dependsOn: [reflection.id] }]).error, /cycle/u);
  assert.match(runMaintained(base, [reflection, aperture]).error, /non-commuting/u);

  const stale = clone(base);
  stale.model.selectors[0].registryRevisionId = 'rev:old-glyph-registry';
  assert.match(runMaintained(stale, [operation('geometry.structure.reflect', 'stale-selector', stale)]).error, /stale/iu);
  const staleModel = clone(stale.model);
  const staleOperation = operation('geometry.structure.reflect', 'executor-stale-selector', stale);
  staleModel.operations = [staleOperation];
  staleModel.intent.statements.push({ id: staleOperation.provenance.intentIds[0], origin: 'explicit', predicate: staleOperation.type, source: { text: 'stale selector' } });
  const staleAtExecutor = executeTransaction(staleModel, stale.family, { operationHandlers });
  assert.equal(staleAtExecutor.status, 'rejected');
  assert.match(staleAtExecutor.error, /stale/iu);

  const forged = clone(base);
  forged.model.selectors[0].expression = { op: 'glyph-id', value: 'glyph:control' };
  assert.match(runMaintained(forged, [operation('geometry.structure.reflect', 'forged-selector', forged)]).error, /snapshot differs/u);

  const staleCondition = operation('geometry.structure.reflect', 'stale-condition', base);
  staleCondition.preconditions[0].id = 'rev:old-accepted-state';
  assert.match(runMaintained(base, [staleCondition]).error, /stale revision precondition/u);

  const staleComponent = clone(base);
  staleComponent.model.constructionIntegration.selectors[0].registryRevisionId = 'rev:old-components';
  assert.match(runMaintained(staleComponent, [operation('geometry.structure.reflect', 'stale-component', staleComponent)]).error, /stale/u);
});

test('a later handler failure rolls back geometry, semantic construction, and candidate history', () => {
  const base = fixture('spine');
  const before = clone(base);
  const reflection = operation('geometry.structure.reflect', 'first', base);
  const invalidAperture = operation('semantic.aperture.open', 'second', base, { dependsOn: [reflection.id] });
  invalidAperture.parameters.terminal = 'unsupported';
  const result = runMaintained(base, [reflection, invalidAperture]);
  assert.equal(result.status, 'rejected');
  assert.match(result.error, /terminal|unsupported/iu);
  assert.equal(result.revision, null);
  assert.deepEqual(result.model, base.model);
  assert.deepEqual(result.family, base.family);
  assert.deepEqual(base, before);
});

test('accepted candidates are separate and immutable, and tampered candidates cannot be accepted', () => {
  const base = fixture();
  const candidate = sequences(base).A;
  const candidateBefore = clone(candidate);
  const accepted = accept(candidate);
  assert.equal(accepted.model.revisions.acceptedRevisionId, candidate.revision.id);
  assert.deepEqual(candidate, candidateBefore);
  assert.ok(Object.isFrozen(accepted.model));
  assert.ok(Object.isFrozen(accepted.family.glyphs['glyph:assembly']));
  assert.throws(() => { accepted.model.constructionIntegration.instances.main.reflected = false; }, TypeError);
  const tampered = clone(candidate);
  tampered.family.glyphs['glyph:assembly'].metrics.advanceWidth = 1;
  assert.throws(() => accept(tampered), /unmodified/u);
});

test('revision identity responds to parameter content, ignores object key order, and stays deterministic', () => {
  const base = fixture();
  const firstOperation = operation('semantic.aperture.open', 'same-id', base, { halfExtent: 0.2 });
  const differentParameters = operation('semantic.aperture.open', 'same-id', base, { halfExtent: 0.3 });
  const reorderedKeys = clone(firstOperation);
  reorderedKeys.parameters = Object.fromEntries(Object.entries(reorderedKeys.parameters).reverse());
  const sparseParameters = clone(firstOperation);
  sparseParameters.parameters.audit = new Array(1);
  const emptyArrayParameters = clone(firstOperation);
  emptyArrayParameters.parameters.audit = [];
  const unsupportedObject = clone(firstOperation);
  unsupportedObject.parameters.audit = new Date(0);
  const changedConflicts = clone(base);
  changedConflicts.model.conflicts = [{ id: 'conflict:revision-content', status: 'unresolved' }];
  const first = runMaintained(base, [firstOperation]);
  const different = runMaintained(base, [differentParameters]);
  const reordered = runMaintained(base, [reorderedKeys]);
  const sparse = runMaintained(base, [sparseParameters]);
  const emptyArray = runMaintained(base, [emptyArrayParameters]);
  const unsupported = runMaintained(base, [unsupportedObject]);
  const withConflict = runMaintained(changedConflicts, [operation('semantic.aperture.open', 'same-id', changedConflicts, { halfExtent: 0.2 })]);
  assert.equal(first.status, 'committed-candidate');
  assert.notEqual(first.revision.id, different.revision.id);
  assert.equal(first.revision.id, reordered.revision.id);
  assert.notEqual(sparse.revision.id, emptyArray.revision.id, 'array holes serialize as null items');
  assert.equal(unsupported.status, 'rejected', 'non-JSON objects are rejected instead of hashing as empty records');
  assert.notEqual(first.revision.id, withConflict.revision.id, 'resolved model conflicts are part of revision content');
  assert.deepEqual(runMaintained(base, [firstOperation]), first);
});

test('handler maps are per-call plain function maps and asynchronous handlers reject atomically', () => {
  const base = fixture();
  const op = operation('semantic.aperture.open', 'handler-contract', base);
  const model = clone(base.model);
  model.operations = [op];
  model.intent.statements.push({ id: op.provenance.intentIds[0], origin: 'explicit', predicate: op.type, source: { text: 'handler contract' } });
  const beforeModel = clone(model);
  const inherited = Object.create({ 'semantic.aperture.open': () => {} });
  const invalidRegistry = executeTransaction(model, base.family, { operationHandlers: inherited });
  assert.equal(invalidRegistry.status, 'rejected');
  assert.match(invalidRegistry.error, /plain map/u);
  const nonFunction = executeTransaction(model, base.family, { operationHandlers: { 'semantic.aperture.open': true } });
  assert.equal(nonFunction.status, 'rejected');
  assert.match(nonFunction.error, /must be .*function/u);
  const hidden = {};
  Object.defineProperty(hidden, 'semantic.aperture.open', { value: () => {}, enumerable: false });
  const nonEnumerable = executeTransaction(model, base.family, { operationHandlers: hidden });
  assert.equal(nonEnumerable.status, 'rejected');
  assert.match(nonEnumerable.error, /enumerable data property/u);
  const asyncResult = executeTransaction(model, base.family, { operationHandlers: { 'semantic.aperture.open': async () => {} } });
  assert.equal(asyncResult.status, 'rejected');
  assert.match(asyncResult.error, /must be synchronous/u);
  const mutatingOperation = executeTransaction(model, base.family, {
    operationHandlers: { 'semantic.aperture.open': ({ operation: stagedOperation }) => { stagedOperation.parameters.nodeId = 'forged'; } }
  });
  assert.equal(mutatingOperation.status, 'rejected');
  assert.deepEqual(model, beforeModel);
  assert.equal(asyncResult.revision, null);
});

test('follow-up transactions execute only new operations and retain accepted operation history', () => {
  const initial = fixture('spine');
  const candidate = sequences(initial).A;
  const accepted = accept(candidate);
  const base = { ...accepted, targetNodeId: initial.targetNodeId, kind: initial.kind };
  const acceptedHash = hash(accepted);
  const next = operation('geometry.structure.reflect', 'op:followup-reflect', base);
  const result = runMaintained(base, [next]);
  assert.equal(result.status, 'committed-candidate', result.error);
  assert.equal(result.model.constructionIntegration.instances.main.reflected, false);
  assert.equal(result.model.constructionIntegration.instances.main.design.apertureExtension.apertures.length, 1);
  assert.deepEqual(result.model.constructionIntegration.operationHistory.map(item => item.id), ['op:reflect', 'op:aperture']);
  assert.deepEqual(result.model.operations.map(item => item.id), ['op:followup-reflect']);
  assert.equal(hash(accepted), acceptedHash);
  assert.equal(runMaintained(base, [{ ...next, id: 'op:reflect' }]).status, 'rejected');

  const replayModel = clone(base.model);
  const replay = operation('geometry.structure.reflect', 'op:reflect', base);
  replayModel.operations = [replay];
  replayModel.intent.statements.push({ id: replay.provenance.intentIds[0], origin: 'explicit', predicate: replay.type, source: { text: 'replay accepted operation' } });
  const rejectedReplay = executeTransaction(replayModel, base.family, { operationHandlers });
  assert.equal(rejectedReplay.status, 'rejected');
  assert.match(rejectedReplay.error, /already present in accepted revision history/u);
});
