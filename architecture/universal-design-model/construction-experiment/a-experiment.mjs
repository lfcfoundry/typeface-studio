import { createHash } from 'node:crypto';
import { validateV2Model } from '../integration-experiment/engine.mjs';
import { deriveGlyph } from './geometry.mjs';
import { createSemanticDesign, validateSemanticDesign } from './model.mjs';
import { initializeConstruction } from './engine.mjs';

const clone = value => structuredClone(value);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function makeLowercaseA() {
  const stemDecisionId = 'decision:shared-stem-width';
  const xHeightDecisionId = 'decision:x-height';
  const baselineDecisionId = 'decision:baseline';
  const nodes = [
    { id: 'part:a-bowl', kind: 'anatomy.bowl', role: 'attached-bowl',
      parameters: { profile: 'left-half-ellipse', widthRatio: 0.9, xHeightDecisionId },
      relations: [{ type: 'aligned-to', targetId: xHeightDecisionId }, { type: 'connects', targetId: 'part:a-stem' }] },
    { id: 'part:a-counter', kind: 'anatomy.counter', role: 'bowl-counter',
      parameters: { horizontalInsetRatio: 1, verticalInsetRatio: 1 },
      relations: [{ type: 'contained-by', targetId: 'part:a-bowl' }, { type: 'adjacent-to', targetId: 'part:a-stem' }, { type: 'uses-parameter', targetId: stemDecisionId }] },
    { id: 'part:a-stem', kind: 'anatomy.stem', role: 'attached-vertical',
      parameters: { side: 'right', widthDecisionId: stemDecisionId },
      relations: [{ type: 'joins', targetId: 'part:a-upper-join' }, { type: 'joins', targetId: 'part:a-lower-join' }] },
    { id: 'part:a-upper-join', kind: 'anatomy.join', role: 'upper-bowl-stem', parameters: {},
      relations: [{ type: 'connects', targetId: 'part:a-bowl' }, { type: 'connects', targetId: 'part:a-stem' }, { type: 'attaches-to', targetId: 'part:a-upper-terminal' }] },
    { id: 'part:a-lower-join', kind: 'anatomy.join', role: 'lower-bowl-stem', parameters: {},
      relations: [{ type: 'connects', targetId: 'part:a-bowl' }, { type: 'connects', targetId: 'part:a-stem' }, { type: 'attaches-to', targetId: 'part:a-lower-terminal' }] },
    { id: 'part:a-upper-terminal', kind: 'anatomy.terminal', role: 'upper-stem-terminal',
      parameters: { profile: 'flat', alignmentDecisionId: xHeightDecisionId },
      relations: [{ type: 'attaches-to', targetId: 'part:a-stem' }, { type: 'aligned-to', targetId: xHeightDecisionId }] },
    { id: 'part:a-lower-terminal', kind: 'anatomy.terminal', role: 'lower-stem-terminal',
      parameters: { profile: 'flat', alignmentDecisionId: baselineDecisionId },
      relations: [{ type: 'attaches-to', targetId: 'part:a-stem' }, { type: 'aligned-to', targetId: baselineDecisionId }] }
  ];
  return {
    id: 'glyph:u0061', name: 'a', character: 'a', unicodes: [0x0061], classes: ['letter', 'lowercase'],
    construction: { version: 1, method: 'construction.bowl-with-attached-stem', parameters: { topology: 'single-storey', stemSide: 'right' },
      rootNodeIds: nodes.map(item => item.id), nodes, constraints: [
        { id: 'constraint:a-bowl-counter-contained', type: 'containment', nodes: ['part:a-counter', 'part:a-bowl'] },
        { id: 'constraint:a-stem-shared-width', type: 'shared-parameter', node: 'part:a-stem', decision: stemDecisionId }
      ] },
    metrics: { advanceWidth: 650, leftSideBearing: 55, rightSideBearing: 55 }
  };
}

/** Add a single-storey lowercase a as an immutable candidate to the existing three-glyph design. */
export function buildLowercaseACandidate(acceptedModel = initializeConstruction(createSemanticDesign())) {
  const inputSnapshot = JSON.stringify(acceptedModel);
  const errors = [...validateSemanticDesign(acceptedModel), ...validateV2Model(acceptedModel)];
  if (errors.length) throw new Error(`Cannot add lowercase a to an invalid design: ${errors.join(' ')}`);
  if (acceptedModel.revisions.headRevisionId !== acceptedModel.revisions.acceptedRevisionId ||
      acceptedModel.revisions.items.find(item => item.id === acceptedModel.revisions.acceptedRevisionId)?.status !== 'accepted') {
    throw new Error('Lowercase a must branch from the accepted design revision.');
  }
  if (acceptedModel.glyphRegistry.glyphs.some(glyph => glyph.id === 'glyph:u0061' || glyph.unicodes.includes(0x0061))) {
    throw new Error('The accepted glyph registry already contains lowercase a.');
  }

  const candidate = clone(acceptedModel);
  const glyph = makeLowercaseA();
  const topologyDecisionId = 'decision:a-single-storey-topology';
  const baselineDecisionId = 'decision:baseline';
  const selectorId = 'sel:add-lowercase-a';
  const intentId = 'intent:add-single-storey-lowercase-a';
  const operationId = 'op:add-single-storey-lowercase-a';
  const revisionId = `rev:${digest({ parent: acceptedModel.revisions.acceptedRevisionId, glyph: glyph.construction }).slice(0, 16)}`;
  const selector = {
    id: selectorId, universe: 'glyph-registry-at-revision', registryRevisionId: revisionId,
    expression: { op: 'glyph-id', value: glyph.id }, exclude: [],
    resolution: { status: 'resolved', includedGlyphIds: [glyph.id], excludedGlyphIds: [], unclassifiedGlyphIds: [] }
  };
  const intent = {
    id: intentId, kind: 'construction', subject: { scope: 'glyph', selectorId }, predicate: 'glyph.construction.add',
    value: { topology: 'single-storey', glyphId: glyph.id },
    source: { messageId: 'msg:construction-generality-test', start: 0, end: 0, text: 'Experimental single-storey lowercase a construction' },
    origin: 'explicit', confidence: 1,
    resolution: { status: 'resolved', capability: 'implemented', reason: 'Isolated construction experiment; no default topology is implied.' },
    supersedes: [], conflicts: []
  };
  const operation = {
    id: operationId, type: 'construct.glyph.add', selectorId, parameters: { glyphId: glyph.id, method: glyph.construction.method },
    phase: 'construction', dependsOn: [], preconditions: ['glyph-id-unused', 'construction-valid'], postconditions: ['geometry-valid', 'metrics-valid'],
    metricPolicy: { advance: 'explicit', bearings: 'recompute-from-bounds', kerning: 'invalidate-for-review' },
    provenance: { intentIds: [intentId], acceptedDecisionIds: [topologyDecisionId] },
    capability: 'implemented', resolution: { status: 'resolved', reason: null }, conflicts: [], exceptions: []
  };

  candidate.glyphRegistry.glyphs.push(glyph);
  candidate.glyphRegistry.revisionId = revisionId;
  candidate.selectors.push(selector);
  candidate.intent.statements.push(intent);
  candidate.operations.push(operation);
  candidate.state.characteristics.push(
    { id: topologyDecisionId, property: 'glyph.construction.topology', value: { kind: 'enum', value: 'single-storey' },
      selectorId, origin: 'explicit', certainty: 1, acceptance: 'candidate', capability: 'implemented', sourceIntentIds: [intentId], dependencyIds: [glyph.id] },
    { id: baselineDecisionId, property: 'alignment.baseline', value: { kind: 'font-units', value: 0 },
      selectorId, origin: 'explicit', certainty: 1, acceptance: 'candidate', capability: 'implemented', sourceIntentIds: [intentId], dependencyIds: ['part:a-lower-terminal'] }
  );
  candidate.state.decisions.push(topologyDecisionId, baselineDecisionId);
  const derived = deriveGlyph(glyph, candidate);
  candidate.derived.geometry = {
    ...candidate.derived.geometry,
    sourceRevisionId: revisionId,
    glyphs: { ...candidate.derived.geometry.glyphs, [glyph.id]: derived }
  };
  const changedGlyphIds = [glyph.id];
  const preservedGlyphIds = acceptedModel.glyphRegistry.glyphs.map(item => item.id);
  const revision = {
    id: revisionId, parentRevisionIds: [acceptedModel.revisions.acceptedRevisionId], status: 'candidate',
    decisionIds: [...candidate.state.decisions], operationIds: [operationId], deltaOperationIds: [operationId],
    changedGlyphIds, preservedGlyphIds, targetedGlyphIds: changedGlyphIds,
    preservedDecisionIds: [...acceptedModel.state.decisions],
    diff: { semanticChanges: [{ glyphId: glyph.id, topology: 'single-storey', method: glyph.construction.method }], geometryChanges: changedGlyphIds }
  };
  candidate.revisions.items.push(revision);
  candidate.revisions.headRevisionId = revisionId;
  candidate.derived.latestDiff = revision.diff;
  const finalErrors = [...validateSemanticDesign(candidate), ...validateV2Model(candidate)];
  if (finalErrors.length) throw new Error(`Lowercase-a candidate failed validation: ${finalErrors.join(' ')}`);
  if (JSON.stringify(acceptedModel) !== inputSnapshot) throw new Error('Adding lowercase a mutated the accepted input.');
  return { status: 'candidate', acceptedModel, model: candidate, glyph: derived, revision, diff: revision.diff };
}

export function createLowercaseAGlyph() { return makeLowercaseA(); }
