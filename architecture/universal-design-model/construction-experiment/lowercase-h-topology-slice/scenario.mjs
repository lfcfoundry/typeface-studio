import { createHash } from 'node:crypto';
import { canonicalizeInitialGeometry, executeTransaction, resolveSelector } from '../../integration-experiment/engine.mjs';
import { compilerProject, compileSemanticDesign } from '../font-adapter.mjs';
import { createAcceptedSource } from '../natural-language-topology-slice/scenario.mjs';
import { validateSemanticDesign } from '../model.mjs';
import { validateGlyph } from '../../../../prototype/src/contours.js';
import { assertValidHConstruction, createHConstruction, H_CAPABILITY, H_GLYPH_ID, H_METHOD } from './grammar.mjs';
import { deriveStemShoulderGeometry } from './geometry.mjs';

export const SUPPORTED_REQUEST = 'Add a lowercase h with a vertical stem and shoulder, preserving every existing glyph.';
export const SUPPORTED_VARIANT = 'Add lowercase h with a vertical stem and shoulder; preserve all existing glyphs.';
export const OPERATION = 'construct.glyph.add-stem-shoulder-h';
export const FOLLOWUP_OPERATION = 'construct.h.set-shoulder-rise';

const clone = structuredClone;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const deepFreeze = value => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
};
const diag = (code, message) => ({ code, message });
const registryGlyph = (model, id) => model.glyphRegistry.glyphs.find(glyph => glyph.id === id);
const spanFor = (text, fragment) => {
  const start = text.toLocaleLowerCase('en').indexOf(fragment.toLocaleLowerCase('en'));
  if (start < 0) throw new Error(`Could not locate intent source span: ${fragment}`);
  return { messageId: 'msg:nl-add-h-1', start, end: start + fragment.length, text: text.slice(start, start + fragment.length) };
};

/** Exact two-string grammar; it never maps an unrecognized request to this operation. */
export function interpretRequest(input) {
  if (typeof input !== 'string') return { status: 'invalid', diagnostics: [diag('malformed-input', 'Request must be text.')] };
  const text = input;
  const normalized = text.trim().toLocaleLowerCase('en').replace(/[’]/gu, "'").replace(/\s+/gu, ' ');
  if (!normalized) return { status: 'invalid', diagnostics: [diag('empty-input', 'Enter a glyph-construction request.')] };
  if (/\b(?:replace|redesign|change|remove|modify)\b[\s\S]*\b(?:existing|other|every) glyph/iu.test(normalized) ||
      /\bpreserve\b[\s\S]*\bbut\b[\s\S]*\b(?:change|replace|remove)\b/iu.test(normalized)) {
    return { status: 'conflict', diagnostics: [diag('conflicting-preservation', 'The request both preserves existing glyphs and asks to change them.')] };
  }
  if (/\b(?:lowercase|lower-case)\s+[a-z]\b/iu.test(normalized) && !/\b(?:lowercase|lower-case)\s+h\b/iu.test(normalized)) {
    return { status: 'unsupported', diagnostics: [diag('unsupported-target', 'This slice constructs only lowercase h.')] };
  }
  if (/\b(?:uppercase|capital)\s+h\b/iu.test(normalized)) {
    return { status: 'unsupported', diagnostics: [diag('unsupported-target', 'Uppercase H is outside this experiment.')] };
  }
  if (/\bh\b/iu.test(normalized) && !/\blowercase\s+h\b/iu.test(normalized)) {
    return { status: 'ambiguous', diagnostics: [diag('ambiguous-target', 'Specify lowercase h explicitly.')] };
  }
  const canonical = normalized.replace(/[.!?]+$/u, '');
  const accepted = canonical === SUPPORTED_REQUEST.toLocaleLowerCase('en').replace(/[.!?]+$/u, '') ||
    canonical === SUPPORTED_VARIANT.toLocaleLowerCase('en').replace(/[.!?]+$/u, '');
  if (!accepted) return { status: 'unsupported', diagnostics: [diag('unsupported-request', 'Only the documented lowercase-h vertical-stem and shoulder request is supported.')] };

  const targetMatch = /lowercase h with a vertical stem and shoulder|lowercase h with a vertical stem and shoulder/iu.exec(text);
  const targetText = targetMatch?.[0] || 'lowercase h';
  const preserveText = canonical === SUPPORTED_REQUEST.toLocaleLowerCase('en').replace(/[.!?]+$/u, '')
    ? 'preserving every existing glyph' : 'preserve all existing glyphs';
  const constructionIntent = {
    id: 'intent:nl-add-lowercase-h', kind: 'construction',
    subject: { scope: 'new-glyph', glyphId: H_GLYPH_ID }, predicate: 'glyph.construction.add',
    value: { glyph: 'h', unicode: 0x0068, anatomy: ['vertical-stem', 'shoulder'], topology: 'ascender-stem-shoulder-return-open-counter' },
    source: spanFor(text, targetText), origin: 'explicit', confidence: 1,
    resolution: { status: 'resolved', capability: H_CAPABILITY, reason: null }, supersedes: [], conflicts: []
  };
  const preservationIntent = {
    id: 'intent:nl-preserve-existing-glyphs', kind: 'preservation',
    subject: { scope: 'all-accepted-glyphs' }, predicate: 'glyph.preserve',
    value: { scope: 'every-glyph-in-parent-revision' }, source: spanFor(text, preserveText),
    origin: 'explicit', confidence: 1,
    resolution: { status: 'resolved', capability: 'implemented-experiment', reason: null }, supersedes: [], conflicts: []
  };
  return { status: 'resolved', text, intents: [constructionIntent, preservationIntent], targetGlyphId: H_GLYPH_ID,
    unicode: 0x0068, requestedTopology: 'ascender-stem-shoulder-return-open-counter',
    explicit: ['new lowercase h', 'vertical stem', 'shoulder', 'preserve every existing glyph'],
    inferred: ['ascender aligns to the existing cap-height decision', 'the open shoulder counter reaches the exterior at the baseline',
      'advance width uses the experiment fixture width and side bearings are recomputed from derived bounds'] };
}

function makeSelector(id, registryRevisionId, expression, registry, exclude = []) {
  const selector = { id, universe: 'glyph-registry-at-revision', registryRevisionId, expression, exclude, resolution: null };
  selector.resolution = resolveSelector(selector, registry, { registryRevisionId });
  return selector;
}

function shellGlyph() {
  return { id: H_GLYPH_ID, name: 'h', character: 'h', unicodes: [0x0068], classes: ['letter', 'lowercase'],
    construction: { version: 1, method: H_METHOD, parameters: {}, rootNodeIds: [], nodes: [], constraints: [], identity: {}, provenance: null },
    metrics: { advanceWidth: 650, leftSideBearing: 55, rightSideBearing: 55 } };
}

function shellGeometry(glyph) {
  return { id: glyph.id, name: glyph.name, character: glyph.character, unicode: glyph.unicodes[0], classes: [...glyph.classes],
    contours: [], bounds: { xMin: 0, yMin: 0, xMax: 0, yMax: 0 }, metrics: clone(glyph.metrics), components: [] };
}

function operationRecord({ operationId, type, selectorId, parameters, intents, sourceRevisionId, sourceText, metricPolicy }) {
  return { id: operationId, type, selectorId, phase: 'construction', parameters, dependsOn: [],
    preconditions: [{ type: 'revision', id: sourceRevisionId }], postconditions: ['semantic-topology-valid', 'derived-geometry-valid', 'font-compilation-valid'],
    metricPolicy, provenance: { intentIds: intents.map(intent => intent.id), acceptedDecisionIds: [], source: { text: sourceText } },
    capability: H_CAPABILITY, resolution: { status: 'resolved', reason: null }, conflicts: [], exceptions: [] };
}

function strictKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) {
    throw new Error(`Malformed ${label} parameter schema.`);
  }
}

function deriveIntoCandidate(model, family, glyphRecord, familyGlyph, derive = deriveStemShoulderGeometry) {
  const geometry = derive(glyphRecord, model);
  const errors = validateGlyph({ ...geometry, advanceWidth: geometry.metrics.advanceWidth,
    rightSideBearing: geometry.metrics.rightSideBearing });
  if (errors.length) throw new Error(`Derived h outline validation failed: ${errors.join(' ')}`);
  model.derived.geometry.glyphs[glyphRecord.id] = clone(geometry);
  Object.assign(familyGlyph, clone(geometry));
  const canonicalFamily = canonicalizeInitialGeometry({ glyphOrder: [glyphRecord.id], glyphs: { [glyphRecord.id]: familyGlyph } });
  const canonicalGlyph = canonicalFamily.glyphs[glyphRecord.id];
  Object.assign(familyGlyph, clone(canonicalGlyph));
  model.derived.geometry.glyphs[glyphRecord.id] = clone(canonicalGlyph);
  return canonicalGlyph;
}

function constructHandlerFactory({ derive = deriveStemShoulderGeometry, construct = createHConstruction } = {}) {
  return ({ model, family, glyph, operation }) => {
    strictKeys(operation.parameters, ['glyphId', 'unicode', 'method', 'expectedAbsent', 'parentRevisionId',
      'expectedRegistryRevisionId', 'stagedRegistryRevisionId', 'preservedGlyphIds', 'preservedGlyphHashes', 'ascenderDecisionId'], 'add-h operation');
    const p = operation.parameters;
    if (operation.type !== OPERATION || glyph.id !== H_GLYPH_ID || p.glyphId !== glyph.id || p.unicode !== 0x0068 ||
        p.method !== H_METHOD || p.expectedAbsent !== true) throw new Error('Operation scope or requested h capability is invalid.');
    if (model.revisions.headRevisionId !== p.parentRevisionId || operation.preconditions?.[0]?.id !== p.parentRevisionId) throw new Error('Stale accepted source revision.');
    const staging = model.lowercaseHTopologyStaging;
    if (!staging || staging.parentRevisionId !== p.parentRevisionId || staging.parentRegistryRevisionId !== p.expectedRegistryRevisionId ||
        staging.stagedRegistryRevisionId !== p.stagedRegistryRevisionId || model.glyphRegistry.revisionId !== p.stagedRegistryRevisionId ||
        JSON.stringify(staging.parentGlyphIds) !== JSON.stringify(p.preservedGlyphIds) ||
        JSON.stringify(staging.parentGlyphHashes) !== JSON.stringify(p.preservedGlyphHashes)) throw new Error('Stale or contradictory new-glyph staging record.');
    if (staging.parentGlyphIds.includes(H_GLYPH_ID) || model.glyphRegistry.glyphs.some(item => item.id !== H_GLYPH_ID && item.unicodes.includes(0x0068))) {
      throw new Error('The lowercase-h target is no longer absent from the accepted parent.');
    }
    if (family.glyphOrder.filter(id => id === H_GLYPH_ID).length !== 1 || model.glyphRegistry.glyphs.filter(item => item.id === H_GLYPH_ID).length !== 1) {
      throw new Error('The lowercase-h target is missing or ambiguous.');
    }
    const intentIds = operation.provenance.intentIds;
    const constructionIntent = model.intent.statements.find(item => intentIds.includes(item.id) && item.kind === 'construction');
    const preservationIntent = model.intent.statements.find(item => intentIds.includes(item.id) && item.kind === 'preservation');
    if (!constructionIntent || !preservationIntent || JSON.stringify(preservedGlyphIds(model, H_GLYPH_ID)) !== JSON.stringify(p.preservedGlyphIds)) {
      throw new Error('The operation does not carry matching construction and preservation provenance.');
    }
    const currentHashes = Object.fromEntries(p.preservedGlyphIds.map(id => [id, digest({ registry: registryGlyph(model, id),
      derived: model.derived.geometry.glyphs[id], family: family.glyphs[id] })]));
    if (JSON.stringify(currentHashes) !== JSON.stringify(p.preservedGlyphHashes)) throw new Error('A pre-existing glyph or its derived compiler input changed while staging h.');
    const ascender = model.state.characteristics.find(item => item.id === p.ascenderDecisionId);
    if (!ascender || ascender.acceptance !== 'candidate' || ascender.origin !== 'inferred' ||
        ascender.value?.value !== model.state.characteristics.find(item => item.id === 'decision:cap-height')?.value?.value) {
      throw new Error('The inferred h ascender decision is missing or inconsistent with the accepted cap height.');
    }
    const semanticGlyph = registryGlyph(model, glyph.id);
    semanticGlyph.construction = construct({ stemWidthDecisionId: 'decision:shared-stem-width', xHeightDecisionId: 'decision:x-height',
      ascenderDecisionId: p.ascenderDecisionId, baselineDecisionId: 'decision:baseline', identityPrefix: 'h',
      provenance: { glyphId: glyph.id, operationId: operation.id, sourceRevisionId: p.parentRevisionId, intentIds: [...intentIds] } });
    assertValidHConstruction(semanticGlyph, model);
    const semanticErrors = validateSemanticDesign(model);
    if (semanticErrors.length) throw new Error(`Semantic construction validation failed: ${semanticErrors.join(' ')}`);
    const geometry = deriveIntoCandidate(model, family, semanticGlyph, glyph, derive);
    if (geometry.metrics.advanceWidth !== 650 || geometry.metrics.leftSideBearing !== geometry.bounds.xMin ||
        geometry.metrics.rightSideBearing !== geometry.metrics.advanceWidth - geometry.bounds.xMax) {
      throw new Error('Derived h geometry violates advance-preservation and bounds-derived bearing policy.');
    }
    model.lowercaseHTopologyStaging = { ...staging, status: 'constructed', constructionHash: digest(semanticGlyph.construction), geometryHash: digest(geometry) };
  };
}

function followupHandlerFactory({ derive = deriveStemShoulderGeometry } = {}) {
  return ({ model, family, glyph, operation }) => {
    strictKeys(operation.parameters, ['glyphId', 'expectedConstructionHash', 'expectedOuterControlRiseRatio', 'outerControlRiseRatio'], 'h shoulder follow-up');
    const p = operation.parameters;
    if (operation.type !== FOLLOWUP_OPERATION || glyph.id !== H_GLYPH_ID || p.glyphId !== glyph.id) throw new Error('Unsupported h follow-up target.');
    const semanticGlyph = registryGlyph(model, glyph.id);
    const currentHash = digest(semanticGlyph.construction);
    const shoulder = semanticGlyph.construction.nodes.find(item => item.kind === 'anatomy.shoulder' && item.role === 'arched-return');
    if (!shoulder || currentHash !== p.expectedConstructionHash || shoulder.parameters.outerControlRiseRatio !== p.expectedOuterControlRiseRatio ||
        !Number.isFinite(p.outerControlRiseRatio) || p.outerControlRiseRatio < 0.2 || p.outerControlRiseRatio > 0.8) {
      throw new Error('Stale or invalid h shoulder follow-up.');
    }
    shoulder.parameters.outerControlRiseRatio = p.outerControlRiseRatio;
    semanticGlyph.construction.provenance = { ...semanticGlyph.construction.provenance, operationId: operation.id,
      parentConstructionHash: currentHash, intentIds: [...operation.provenance.intentIds] };
    assertValidHConstruction(semanticGlyph, model);
    const errors = validateSemanticDesign(model);
    if (errors.length) throw new Error(`Follow-up semantic validation failed: ${errors.join(' ')}`);
    deriveIntoCandidate(model, family, semanticGlyph, glyph, derive);
  };
}

export function operationHandlers(options = {}) {
  return Object.freeze({ [OPERATION]: constructHandlerFactory(options), [FOLLOWUP_OPERATION]: followupHandlerFactory(options) });
}

function preservedGlyphIds(model, exceptId = null) { return model.glyphRegistry.glyphs.map(glyph => glyph.id).filter(id => id !== exceptId).sort(); }
function jsonGeometry(glyph) {
  return JSON.stringify({ id: glyph.id, name: glyph.name, character: glyph.character, unicode: glyph.unicode,
    classes: glyph.classes, contours: glyph.contours, bounds: glyph.bounds, metrics: glyph.metrics });
}

export function prepareTransaction(source, requestText) {
  const interpreted = interpretRequest(requestText);
  if (interpreted.status !== 'resolved') return { status: interpreted.status, diagnostics: interpreted.diagnostics, candidate: null };
  const sourceRevisionId = source.model.revisions.headRevisionId;
  const acceptedRevision = source.model.revisions.items.find(item => item.id === sourceRevisionId && item.status === 'accepted');
  if (!acceptedRevision || source.model.revisions.acceptedRevisionId !== sourceRevisionId) return { status: 'rejected', stage: 'source-revision', diagnostics: [diag('unaccepted-source', 'The source must be the current accepted revision.')], candidate: null };
  if (source.model.glyphRegistry.glyphs.some(glyph => glyph.id === H_GLYPH_ID || glyph.unicodes.includes(0x0068))) {
    return { status: 'rejected', stage: 'target-resolution', diagnostics: [diag('target-conflict', 'Lowercase h already exists in the accepted glyph registry.')], candidate: null };
  }
  const model = clone(source.model), family = clone(source.family);
  const parentGlyphIds = preservedGlyphIds(model);
  if (JSON.stringify([...family.glyphOrder].sort()) !== JSON.stringify([...parentGlyphIds].sort()) ||
      family.glyphOrder.length !== parentGlyphIds.length ||
      JSON.stringify([...(acceptedRevision.preservedGlyphIds || [])].sort()) !== JSON.stringify(parentGlyphIds) ||
      parentGlyphIds.some(id => !family.glyphs[id] || !model.derived.geometry.glyphs[id] ||
        jsonGeometry(model.derived.geometry.glyphs[id]) !== jsonGeometry(family.glyphs[id])) ||
      new Set(model.glyphRegistry.glyphs.flatMap(glyph => glyph.unicodes)).size !== model.glyphRegistry.glyphs.flatMap(glyph => glyph.unicodes).length) {
    return { status: 'rejected', stage: 'source-snapshot', diagnostics: [diag('inconsistent-parent-snapshot', 'Accepted glyph registry, family, Unicode mapping, and derived geometry must agree.')], candidate: null };
  }
  const parentGlyphHashes = Object.fromEntries(parentGlyphIds.map(id => [id, digest({ registry: registryGlyph(model, id),
    derived: model.derived.geometry.glyphs[id], family: family.glyphs[id] })]));
  const parentRegistryRevisionId = model.glyphRegistry.revisionId;
  const stagedRegistryRevisionId = `rev:${digest({ parentRegistryRevisionId, parentGlyphIds, added: [H_GLYPH_ID, 0x0068] }).slice(0, 16)}`;
  const target = shellGlyph();
  model.glyphRegistry.glyphs.push(target);
  model.glyphRegistry.revisionId = stagedRegistryRevisionId;
  model.constructionEngine.supportedMethods.push(H_METHOD);
  model.state.characteristics.push({ id: 'decision:h-ascender', property: 'proportion.lowercase-ascender',
    value: { kind: 'font-units', value: model.state.characteristics.find(item => item.id === 'decision:cap-height').value.value },
    selectorId: 'sel:h-target', origin: 'inferred', certainty: 0.8, acceptance: 'candidate', capability: H_CAPABILITY,
    sourceIntentIds: [interpreted.intents[0].id], dependencyIds: ['decision:cap-height'] });
  model.state.decisions.push('decision:h-ascender');
  const targetSelector = makeSelector('sel:h-target', stagedRegistryRevisionId, { op: 'glyph-id', value: H_GLYPH_ID }, model.glyphRegistry.glyphs);
  const preserveSelector = makeSelector('sel:h-parent-glyphs', stagedRegistryRevisionId, { op: 'glyph-registry' }, model.glyphRegistry.glyphs,
    [{ op: 'glyph-id', value: H_GLYPH_ID }]);
  if (targetSelector.resolution.status !== 'resolved' || targetSelector.resolution.includedGlyphIds.length !== 1 ||
      preserveSelector.resolution.status !== 'resolved' || JSON.stringify(preserveSelector.resolution.includedGlyphIds) !== JSON.stringify(parentGlyphIds)) {
    return { status: 'rejected', stage: 'target-resolution', diagnostics: [diag('selector-resolution', 'The new h target or accepted-glyph preservation selector did not resolve exactly.')], candidate: null };
  }
  model.selectors.push(targetSelector, preserveSelector);
  model.input.messages = [...model.input.messages, { id: 'msg:nl-add-h-1', text: requestText }];
  model.intent.statements.push(...clone(interpreted.intents));
  model.lowercaseHTopologyStaging = { parentRevisionId: sourceRevisionId, parentRegistryRevisionId,
    stagedRegistryRevisionId, parentGlyphIds: [...parentGlyphIds], parentGlyphHashes: clone(parentGlyphHashes), status: 'identity-shell-staged' };
  family.glyphOrder.push(H_GLYPH_ID);
  family.glyphs[H_GLYPH_ID] = shellGeometry(target);
  model.derived.geometry.glyphs[H_GLYPH_ID] = shellGeometry(target);
  const operation = operationRecord({ operationId: 'op:nl-add-stem-shoulder-h', type: OPERATION, selectorId: targetSelector.id,
    parameters: { glyphId: H_GLYPH_ID, unicode: 0x0068, method: H_METHOD, expectedAbsent: true,
      parentRevisionId: sourceRevisionId, expectedRegistryRevisionId: parentRegistryRevisionId,
      stagedRegistryRevisionId, preservedGlyphIds: [...parentGlyphIds], preservedGlyphHashes: clone(parentGlyphHashes),
      ascenderDecisionId: 'decision:h-ascender' },
    intents: interpreted.intents, sourceRevisionId, sourceText: requestText,
    metricPolicy: { advance: 'preserve-explicit-source-metric', bearings: 'recompute-from-derived-bounds', kerning: 'invalidate-for-review' } });
  model.operations = [operation];
  return { status: 'ready', model, family, operation, interpreted, sourceRevisionId, parentGlyphIds, targetGlyphId: H_GLYPH_ID };
}

export function runPreparedTransaction(prepared, options = {}) {
  if (prepared.status !== 'ready') return { status: prepared.status, stage: prepared.stage || 'interpretation', diagnostics: prepared.diagnostics || [], candidate: null };
  const result = executeTransaction(prepared.model, prepared.family, { operationHandlers: operationHandlers(options) });
  if (result.status !== 'committed-candidate') return { status: 'rejected', stage: 'transaction', error: result.error,
    candidate: null, model: prepared.model, family: prepared.family };
  result.model.derived.geometry.sourceRevisionId = result.revision.id;
  return { ...result, sourceRevisionId: prepared.sourceRevisionId, parentGlyphIds: prepared.parentGlyphIds,
    targetGlyphId: prepared.targetGlyphId, interpreted: prepared.interpreted, operation: prepared.operation };
}

export function runRequest(source, requestText, { compile = compileSemanticDesign, ...options } = {}) {
  const prepared = prepareTransaction(source, requestText);
  if (prepared.status !== 'ready') return { status: 'rejected', stage: prepared.stage || 'interpretation', diagnostics: prepared.diagnostics || [], candidate: null, model: source.model, family: source.family };
  const transaction = runPreparedTransaction(prepared, options);
  if (transaction.status !== 'committed-candidate') return { ...transaction, model: source.model, family: source.family, sourceRevisionId: source.model.revisions.headRevisionId };
  try {
    const sourceFont = compile(source.model);
    if (!compilerInputMatchesValidatedGeometry(transaction.model, transaction.family)) {
      throw new Error('Font compiler input differs from the geometry validated by the transaction executor.');
    }
    const candidateFont = compile(transaction.model);
    const compiledH = candidateFont.parsed.glyphs.h;
    if (!candidateFont.audit.valid || !compiledH || compiledH.unicodes?.[0] !== 0x0068 ||
        compiledH.advanceWidth !== transaction.model.derived.geometry.glyphs[H_GLYPH_ID].metrics.advanceWidth) {
      throw new Error('Candidate font failed internal audit, lowercase-h mapping, or advance-width verification.');
    }
    const result = { ...transaction, sourceFont, candidateFont, stage: 'compiled-candidate' };
    result.seal = digest({ model: result.model, family: result.family,
      sourceFont: digest(Buffer.from(sourceFont.bytes)), candidateFont: digest(Buffer.from(candidateFont.bytes)) });
    return result;
  } catch (error) {
    return { status: 'rejected', stage: 'font-compilation', error: error.message, candidate: null,
      model: source.model, family: source.family, sourceRevisionId: source.model.revisions.headRevisionId };
  }
}

export function acceptCandidate(result) {
  if (result.status !== 'committed-candidate' || result.stage !== 'compiled-candidate' || result.seal !== digest({
    model: result.model, family: result.family, sourceFont: digest(Buffer.from(result.sourceFont.bytes)),
    candidateFont: digest(Buffer.from(result.candidateFont.bytes)) })) throw new Error('Only an unchanged, compiled h candidate can be accepted.');
  const model = clone(result.model), family = clone(result.family), revision = model.revisions.items.at(-1);
  if (revision.status !== 'candidate' || revision.parentRevisionIds[0] !== result.sourceRevisionId ||
      JSON.stringify([...revision.preservedGlyphIds].sort()) !== JSON.stringify([...result.parentGlyphIds].sort())) throw new Error('Candidate lineage or preservation set is invalid.');
  revision.status = 'accepted';
  model.revisions.acceptedRevisionId = revision.id;
  for (const decision of model.state.characteristics) if (decision.acceptance === 'candidate') decision.acceptance = 'accepted';
  model.lowercaseHTopologyStaging.status = 'accepted';
  return { model: deepFreeze(model), family: deepFreeze(family), acceptedRevisionId: revision.id, font: result.candidateFont };
}

export function runFollowup(accepted, { id = 'op:h-shoulder-rise-followup', outerControlRiseRatio = 0.56,
  compile = compileSemanticDesign, ...options } = {}) {
  const model = clone(accepted.model), family = clone(accepted.family);
  const glyph = registryGlyph(model, H_GLYPH_ID);
  if (!glyph || model.revisions.headRevisionId !== accepted.acceptedRevisionId || model.revisions.acceptedRevisionId !== accepted.acceptedRevisionId) {
    return { status: 'rejected', stage: 'follow-up-precondition', error: 'Accepted h revision is stale or missing.', model: accepted.model, family: accepted.family };
  }
  const sourceRevisionId = model.revisions.headRevisionId;
  const intent = { id: `intent:${id}`, kind: 'construction', subject: { scope: 'glyph', glyphId: H_GLYPH_ID },
    predicate: 'anatomy.shoulder.outer-control-rise', value: { outerControlRiseRatio },
    source: { messageId: `msg:${id}`, start: 0, end: 0, text: 'Lower the h shoulder arch slightly.' }, origin: 'explicit', confidence: 1,
    resolution: { status: 'resolved', capability: H_CAPABILITY, reason: null }, supersedes: [], conflicts: [] };
  const selector = model.selectors.find(item => item.id === 'sel:h-target');
  const operation = operationRecord({ operationId: id, type: FOLLOWUP_OPERATION, selectorId: selector.id,
    parameters: { glyphId: H_GLYPH_ID, expectedConstructionHash: digest(glyph.construction),
      expectedOuterControlRiseRatio: glyph.construction.nodes.find(item => item.role === 'arched-return').parameters.outerControlRiseRatio,
      outerControlRiseRatio }, intents: [intent], sourceRevisionId, sourceText: intent.source.text,
    metricPolicy: { advance: 'preserve', bearings: 'recompute-from-derived-bounds', kerning: 'invalidate-for-review' } });
  model.intent.statements.push(intent);
  model.operations = [operation];
  const transaction = executeTransaction(model, family, { operationHandlers: operationHandlers(options) });
  if (transaction.status !== 'committed-candidate') return { status: 'rejected', stage: 'follow-up-transaction', error: transaction.error,
    model: accepted.model, family: accepted.family };
  transaction.model.derived.geometry.sourceRevisionId = transaction.revision.id;
  try {
    const font = compile(transaction.model);
    if (!font.audit.valid) throw new Error('Follow-up font failed internal SFNT audit.');
    return { ...transaction, stage: 'follow-up-candidate', font, sourceRevisionId, replayedOperationIds: transaction.revision.operationIds };
  } catch (error) {
    return { status: 'rejected', stage: 'follow-up-compilation', error: error.message, model: accepted.model, family: accepted.family };
  }
}

export function compilerInputMatchesValidatedGeometry(model, validatedFamily) {
  const project = compilerProject(model);
  const id = H_GLYPH_ID;
  return JSON.stringify(project.glyphs[id].contours.map(contour => contour.points)) ===
    JSON.stringify(validatedFamily.glyphs[id].contours.map(contour => contour.points));
}

export { compilerProject, compileSemanticDesign, createAcceptedSource, deriveStemShoulderGeometry, digest };
