import { createHash } from 'node:crypto';
import { resolveSelector, validateV2Model } from '../integration-experiment/engine.mjs';
import { deriveDesignGeometry, glyphGeometryHash } from './geometry.mjs';
import { validateSemanticDesign } from './model.mjs';

const clone = value => structuredClone(value);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function initializeConstruction(model) {
  const errors = validateSemanticDesign(model);
  if (errors.length) throw new Error(`Invalid semantic design: ${errors.join(' ')}`);
  const initialized = clone(model);
  initialized.derived.geometry = deriveDesignGeometry(initialized);
  return initialized;
}

/** Apply one construction-level parameter operation as an immutable candidate. */
export function applyConstructionOperation(acceptedModel, operation) {
  const before = JSON.stringify(acceptedModel);
  const baseErrors = [...validateSemanticDesign(acceptedModel), ...validateV2Model(acceptedModel)];
  if (baseErrors.length) return { status: 'rejected', error: baseErrors.join(' '), model: acceptedModel, diff: null };
  if (acceptedModel.revisions.items.find(item => item.id === acceptedModel.revisions.acceptedRevisionId)?.status !== 'accepted' || acceptedModel.revisions.headRevisionId !== acceptedModel.revisions.acceptedRevisionId) {
    return { status: 'rejected', error: 'Construction operations must branch from the accepted revision in this experiment.', model: acceptedModel, diff: null };
  }
  if (operation?.type !== 'construct.parameter.set' || !operation.id || operation.phase !== 'construction' || !operation.selectorId || !(operation.provenance?.intentIds || []).length) {
    return { status: 'rejected', error: 'Expected a provenance-bearing construct.parameter.set operation with a selector.', model: acceptedModel, diff: null };
  }
  if ((operation.dependsOn || []).some(id => !acceptedModel.operations.some(item => item.id === id))) {
    return { status: 'rejected', error: `Operation ${operation.id} references an unavailable dependency.`, model: acceptedModel, diff: null };
  }
  const selector = acceptedModel.selectors.find(item => item.id === operation.selectorId);
  if (!selector) return { status: 'rejected', error: `Operation ${operation.id} references missing selector ${operation.selectorId}.`, model: acceptedModel, diff: null };
  const selection = resolveSelector(selector, acceptedModel.glyphRegistry.glyphs, { registryRevisionId: acceptedModel.glyphRegistry.revisionId });
  if (selection.status !== 'resolved') return { status: 'rejected', error: `Selector ${selector.id} did not resolve: ${JSON.stringify(selection.reason)}.`, model: acceptedModel, diff: null };
  if (selection.includedGlyphIds.length !== 1) return { status: 'rejected', error: 'This construction operation requires exactly one selected glyph.', model: acceptedModel, diff: null };

  try {
    const staged = clone(acceptedModel);
    const targetId = selection.includedGlyphIds[0];
    const target = staged.glyphRegistry.glyphs.find(item => item.id === targetId);
    const node = target.construction.nodes.find(item => item.id === operation.parameters?.nodeId);
    const parameter = operation.parameters?.parameter;
    const value = operation.parameters?.value;
    if (!node || !Object.hasOwn(node.parameters, parameter)) throw new Error(`Operation ${operation.id} targets an unknown semantic parameter.`);
    const isCounterScale = parameter === 'scale' && node.kind === 'anatomy.counter' && Number.isFinite(value) && value > 0 && value <= 1.15;
    const isCrossbarCenter = parameter === 'centerRatio' && node.kind === 'anatomy.crossbar' && Number.isFinite(value) && value >= 0.45 && value <= 0.55;
    if (!isCounterScale && !isCrossbarCenter) throw new Error(`Operation ${operation.id} requests an unsupported semantic parameter value.`);
    const previousValue = node.parameters[parameter];
    if (previousValue === value) throw new Error(`Operation ${operation.id} would not change the construction.`);
    node.parameters[parameter] = value;
    staged.intent.statements.push(clone(operation.intent));
    const operationRecord = clone(operation);
    delete operationRecord.intent;
    staged.operations.push(operationRecord);
    staged.state.characteristics.push({
      id: operation.provenance.acceptedDecisionIds[0], property: isCounterScale ? 'anatomy.counter-scale' : 'anatomy.crossbar-center-ratio', value: { kind: 'ratio', value },
      selectorId: selector.id, origin: 'explicit', certainty: 1, acceptance: 'candidate', capability: 'implemented',
      sourceIntentIds: [...operation.provenance.intentIds], dependencyIds: [node.id]
    });
    staged.state.decisions.push(operation.provenance.acceptedDecisionIds[0]);
    staged.derived.geometry = deriveDesignGeometry(staged, { onlyGlyphIds: [targetId] });

    const beforeGeometry = acceptedModel.derived.geometry.glyphs;
    const afterGeometry = staged.derived.geometry.glyphs;
    const changedGlyphIds = staged.glyphRegistry.glyphs.map(item => item.id).filter(id => glyphGeometryHash(beforeGeometry[id]) !== glyphGeometryHash(afterGeometry[id]));
    if (JSON.stringify(changedGlyphIds) !== JSON.stringify([targetId])) throw new Error(`Expected only ${targetId} geometry to change; got ${changedGlyphIds.join(', ')}.`);
    const preservedGlyphIds = staged.glyphRegistry.glyphs.map(item => item.id).filter(id => !changedGlyphIds.includes(id));
    const revisionId = `rev:${digest({ parent: acceptedModel.revisions.headRevisionId, operationId: operation.id, changedGlyphIds, value }).slice(0, 16)}`;
    const revision = {
      id: revisionId, parentRevisionIds: [acceptedModel.revisions.acceptedRevisionId], status: 'candidate',
      decisionIds: [...acceptedModel.state.decisions, operation.provenance.acceptedDecisionIds[0]], operationIds: [operation.id], deltaOperationIds: [operation.id],
      changedGlyphIds, preservedGlyphIds, targetedGlyphIds: [targetId], preservedDecisionIds: [...acceptedModel.state.decisions],
      diff: { semanticChanges: [{ glyphId: targetId, nodeId: node.id, parameter, from: previousValue, to: value }], geometryChanges: changedGlyphIds }
    };
    staged.revisions.items.push(revision);
    staged.revisions.headRevisionId = revisionId;
    staged.glyphRegistry.revisionId = revisionId;
    staged.derived.geometry.sourceRevisionId = revisionId;
    staged.derived.latestDiff = revision.diff;
    if (JSON.stringify(acceptedModel) !== before) throw new Error('Construction operation mutated its accepted input.');
    return { status: 'candidate', model: staged, revision, diff: revision.diff };
  } catch (error) {
    return { status: 'rejected', error: error.message, model: acceptedModel, diff: null };
  }
}

export function makeOpenCounterCandidateOperation(model) {
  const targetId = 'glyph:u006f';
  const selectorId = 'sel:only-lowercase-o';
  const intentId = 'intent:open-lowercase-o-counter';
  const selector = {
    id: selectorId, universe: 'glyph-registry-at-revision', registryRevisionId: model.glyphRegistry.revisionId,
    expression: { op: 'glyph-id', value: targetId }, exclude: [],
    resolution: { status: 'resolved', includedGlyphIds: [targetId], excludedGlyphIds: [], unclassifiedGlyphIds: [] }
  };
  const intent = {
    id: intentId, kind: 'construction', subject: { scope: 'glyph', selectorId }, predicate: 'anatomy.counter-scale',
    value: { scale: 1 }, source: { messageId: 'msg:1', start: 0, end: 0, text: '' }, origin: 'explicit', confidence: 1,
    resolution: { status: 'resolved', capability: 'implemented', reason: null }, supersedes: [], conflicts: []
  };
  return {
    selector, intent,
    operation: {
      id: 'op:open-lowercase-o-counter', type: 'construct.parameter.set', selectorId, parameters: { nodeId: 'part:o-counter', parameter: 'scale', value: 1 },
      phase: 'construction', dependsOn: [], preconditions: ['semantic-parameter-exists'], postconditions: ['geometry-valid', 'metrics-valid'],
      metricPolicy: { advance: 'preserve', bearings: 'recompute-from-bounds', kerning: 'preserve' },
      provenance: { intentIds: [intentId], acceptedDecisionIds: ['decision:o-counter-scale-candidate'] },
      capability: 'implemented', resolution: { status: 'resolved', reason: null }, conflicts: [], exceptions: []
    }
  };
}

export function buildOpenCounterCandidate(model) {
  const prepared = makeOpenCounterCandidateOperation(model);
  const stagedBase = clone(model);
  stagedBase.selectors.push(prepared.selector);
  return applyConstructionOperation(stagedBase, { ...prepared.operation, intent: prepared.intent });
}

export function makeCrossbarCandidateOperation(model, { centerRatio, suffix, label }) {
  const targetId = 'glyph:u0048';
  const selectorId = `sel:H-crossbar-${suffix}`;
  const intentId = `intent:H-crossbar-${suffix}`;
  const selector = {
    id: selectorId, universe: 'glyph-registry-at-revision', registryRevisionId: model.glyphRegistry.revisionId,
    expression: { op: 'glyph-id', value: targetId }, exclude: [],
    resolution: { status: 'resolved', includedGlyphIds: [targetId], excludedGlyphIds: [], unclassifiedGlyphIds: [] }
  };
  const intent = {
    id: intentId, kind: 'construction', subject: { scope: 'glyph', selectorId }, predicate: 'anatomy.crossbar-center-ratio',
    value: { centerRatio, label }, source: { messageId: 'msg:construction-variation', start: 0, end: 0, text: '' },
    origin: 'explicit', confidence: 1, resolution: { status: 'resolved', capability: 'implemented', reason: null }, supersedes: [], conflicts: []
  };
  return {
    selector, intent,
    operation: {
      id: `op:H-crossbar-${suffix}`, type: 'construct.parameter.set', selectorId,
      parameters: { nodeId: 'part:H-crossbar', parameter: 'centerRatio', value: centerRatio }, phase: 'construction', dependsOn: [],
      preconditions: ['semantic-parameter-exists'], postconditions: ['geometry-valid', 'metrics-valid'],
      metricPolicy: { advance: 'preserve', bearings: 'recompute-from-bounds', kerning: 'preserve' },
      provenance: { intentIds: [intentId], acceptedDecisionIds: [`decision:H-crossbar-${suffix}`] },
      capability: 'implemented', resolution: { status: 'resolved', reason: null }, conflicts: [], exceptions: []
    }
  };
}

export function buildCrossbarCandidate(model, variation) {
  const prepared = makeCrossbarCandidateOperation(model, variation);
  const stagedBase = clone(model);
  stagedBase.selectors.push(prepared.selector);
  return applyConstructionOperation(stagedBase, { ...prepared.operation, intent: prepared.intent });
}
