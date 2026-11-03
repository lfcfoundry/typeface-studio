import { createAcceptedSource as createSingleStoreyAcceptedSource,
  prepareTransaction as prepareHAddition, operationHandlers as hOperationHandlers,
  acceptCandidate as acceptHCandidate, runFollowup } from '../construction-experiment/lowercase-h-topology-slice/scenario.mjs';
import { H_GLYPH_ID, H_METHOD } from '../construction-experiment/lowercase-h-topology-slice/grammar.mjs';
import { compileSemanticDesign, compilerProject } from '../construction-experiment/font-adapter.mjs';
import { executeTransaction, resolveSelector } from '../integration-experiment/engine.mjs';
import { recordVisualReview, validateWholeFontSpec } from './contract.mjs';
import { planCoordinatedSpecimen } from './planner.mjs';
import { BRIEF_MESSAGE_ID, resolveWholeFontBrief } from './resolver.mjs';

export const FAMILY_RESOLUTION_OPERATION = 'design.brief.resolve-family';
export const SPECIMEN_H_ADD_REQUEST = 'Add a lowercase h with a vertical stem and shoulder, preserving every existing glyph.';

const clone = structuredClone;
const digest = value => createHashText(JSON.stringify(value));
import { createHash } from 'node:crypto';
function createHashText(text) { return createHash('sha256').update(text).digest('hex'); }

function diagnostic(code, message) { return { code, message }; }

function inferredHIntent(specification) {
  return { id: 'intent:default-specimen-h', kind: 'construction', subject: { scope: 'glyph', glyphId: H_GLYPH_ID },
    predicate: 'glyph.construction.add', value: { glyph: 'h', unicode: 0x0068, method: H_METHOD },
    source: { messageId: specification.brief.messageId, start: null, end: null, text: '' }, origin: 'inferred', confidence: 0.75,
    inference: { ruleId: 'default:specimen-inventory', sourceIntentIds: specification.intents.map(item => item.id) },
    resolution: { status: 'resolved', capability: 'available-experimentally', reason: 'The h is included as a default specimen member; the user did not request it individually.' },
    supersedes: [], conflicts: [] };
}

function defaultPreservationIntent(specification) {
  return { id: 'intent:preserve-accepted-specimen', kind: 'preservation', subject: { scope: 'all-accepted-glyphs' },
    predicate: 'glyph.preserve', value: { scope: 'all-parent-glyphs' },
    source: { messageId: specification.brief.messageId, start: null, end: null, text: '' }, origin: 'defaulted', confidence: 1,
    justification: 'The candidate lifecycle preserves accepted glyph records unless a resolved operation explicitly changes them.',
    resolution: { status: 'resolved', capability: 'implemented', reason: 'Transactional preservation policy.' }, supersedes: [], conflicts: [] };
}

export function prepareCoordinatedCandidate(source, brief) {
  const resolution = resolveWholeFontBrief(brief);
  if (!resolution.specification) return { status: resolution.status, diagnostics: resolution.diagnostics, candidate: null };
  const sourceRevisionId = source?.model?.revisions?.headRevisionId;
  if (!sourceRevisionId || source.model.revisions.acceptedRevisionId !== sourceRevisionId ||
      !source.model.revisions.items.some(item => item.id === sourceRevisionId && item.status === 'accepted')) {
    return { status: 'rejected', stage: 'source-revision', diagnostics: [diagnostic('unaccepted-source', 'The current source must be an accepted revision.')], candidate: null };
  }
  const plan = planCoordinatedSpecimen(resolution.specification, source.model);
  resolution.specification.specimenPlan = plan;
  const specErrors = validateWholeFontSpec(resolution.specification);
  if (specErrors.length) return { status: 'invalid', diagnostics: specErrors.map(message => diagnostic('invalid-specification', message)), candidate: null };

  const prepared = prepareHAddition(source, SPECIMEN_H_ADD_REQUEST);
  if (prepared.status !== 'ready') return { status: 'rejected', stage: prepared.stage || 'construction-planning', diagnostics: prepared.diagnostics || [], candidate: null };

  const model = prepared.model;
  model.input.brief = brief;
  model.input.language = 'en';
  model.input.messages = model.input.messages.filter(message => message.id !== 'msg:nl-add-h-1');
  model.input.messages.push({ id: BRIEF_MESSAGE_ID, text: brief });
  model.intent.statements = model.intent.statements.filter(item => !['intent:nl-add-lowercase-h', 'intent:nl-preserve-existing-glyphs'].includes(item.id));
  model.intent.statements.push(...clone(resolution.specification.intents));
  const hIntent = inferredHIntent(resolution.specification);
  const preserveIntent = defaultPreservationIntent(resolution.specification);
  model.intent.statements.push(hIntent, preserveIntent);

  const parentGlyphIds = [...prepared.parentGlyphIds];
  const selector = { id: 'sel:whole-font-family-records', universe: 'glyph-registry-at-revision',
    registryRevisionId: model.glyphRegistry.revisionId,
    expression: { op: 'any', args: parentGlyphIds.map(value => ({ op: 'glyph-id', value })) }, exclude: [], resolution: null };
  selector.resolution = resolveSelector(selector, model.glyphRegistry.glyphs, { registryRevisionId: model.glyphRegistry.revisionId });
  if (selector.resolution.status !== 'resolved' || JSON.stringify(selector.resolution.includedGlyphIds) !== JSON.stringify(parentGlyphIds)) {
    return { status: 'rejected', stage: 'construction-planning', diagnostics: [diagnostic('inventory-resolution', 'The source glyph inventory did not resolve exactly.')], candidate: null };
  }
  model.selectors.push(selector);

  const specAndPlanHash = digest({ specification: resolution.specification, plan });
  const familyOperation = { id: `op:whole-font-resolve-${sourceRevisionId.slice(4, 12)}`, type: FAMILY_RESOLUTION_OPERATION,
    selectorId: selector.id, parameters: { sourceRevisionId, specAndPlanHash, targetGlyphIds: parentGlyphIds, schemaVersion: 1 },
    phase: 'design', dependsOn: [], preconditions: [{ type: 'revision', id: sourceRevisionId }],
    postconditions: ['whole-font-resolution-recorded', 'family-glyph-scope-snapshotted'],
    metricPolicy: { advance: 'preserve', bearings: 'preserve', kerning: 'preserve' },
    provenance: { intentIds: resolution.specification.intents.map(item => item.id), acceptedDecisionIds: [], source: { text: brief } },
    capability: 'implemented-experiment', resolution: { status: 'resolved', reason: null }, conflicts: [], exceptions: [] };
  const hOperation = model.operations.find(item => item.id === prepared.operation.id);
  hOperation.dependsOn = [familyOperation.id];
  hOperation.provenance.intentIds = [...familyOperation.provenance.intentIds, hIntent.id, preserveIntent.id];
  hOperation.provenance.source = { text: brief, planningDefault: 'default:specimen-inventory' };
  model.operations.push(familyOperation);
  // The executor topologically orders this dependency even though the operation records are stored in user-facing intent order.
  model.operations = [familyOperation, hOperation];
  return { status: 'ready', source, sourceRevisionId, parentGlyphIds, model, family: prepared.family,
    resolution: resolution.specification, plan, operation: familyOperation, hOperation };
}

function familyResolutionHandlerFactory(specification, plan, sourceRevisionId, parentGlyphIds) {
  const expectedHash = digest({ specification, plan });
  const payload = { version: 1, sourceRevisionId, specification: clone(specification), specimenPlan: clone(plan),
    briefCompliance: clone(specification.briefCompliance), visualAcceptance: { status: 'not-reviewed', approved: false } };
  return ({ model, glyph, operation }) => {
    const p = operation.parameters;
    if (operation.type !== FAMILY_RESOLUTION_OPERATION || p.schemaVersion !== 1 || p.sourceRevisionId !== sourceRevisionId ||
        p.specAndPlanHash !== expectedHash || JSON.stringify(p.targetGlyphIds) !== JSON.stringify(parentGlyphIds) ||
        model.revisions.headRevisionId !== sourceRevisionId || !parentGlyphIds.includes(glyph.id)) {
      throw new Error('Whole-font resolution operation is malformed, stale, or outside its accepted family scope.');
    }
    if (glyph.id !== parentGlyphIds[0]) return;
    if (!model.constructionIntegration || model.constructionIntegration.version !== 1) {
      throw new Error('The maintained executor requires the declared constructionIntegration extension for this experiment.');
    }
    if (model.constructionIntegration.wholeFontBriefResolution) throw new Error('A whole-font brief resolution is already staged in this transaction.');
    model.constructionIntegration.wholeFontBriefResolution = clone(payload);
  };
}

function compilerBoundaryMatches(model, family) {
  const project = compilerProject(model);
  return project.glyphOrder.every(id => JSON.stringify(project.glyphs[id].contours.map(contour => contour.points)) ===
    JSON.stringify(family.glyphs[id].contours.map(contour => contour.points)));
}

function rejected(prepared, candidateStatus, stage, error) {
  return { status: 'rejected', candidateStatus, technicalStatus: 'failed', stage, error,
    sourceRevisionId: prepared.sourceRevisionId, candidate: null, model: prepared.source.model, family: prepared.source.family,
    specification: prepared.resolution, specimenPlan: prepared.plan };
}

export function runPreparedCandidate(prepared, { hOptions = {}, compile = compileSemanticDesign } = {}) {
  if (prepared.status !== 'ready') return { status: 'rejected', candidateStatus: null, technicalStatus: 'not-run',
    stage: prepared.stage || 'resolution', diagnostics: prepared.diagnostics || [], candidate: null };
  const handlers = { ...hOperationHandlers(hOptions), [FAMILY_RESOLUTION_OPERATION]: familyResolutionHandlerFactory(
    prepared.resolution, prepared.plan, prepared.sourceRevisionId, prepared.parentGlyphIds) };
  const transaction = executeTransaction(prepared.model, prepared.family, { revisionLabel: 'whole-font-brief-specimen', operationHandlers: handlers });
  if (transaction.status !== 'committed-candidate') {
    return rejected(prepared, 'construction-geometry-invalid', 'transaction', transaction.error);
  }
  try {
    if (!compilerBoundaryMatches(transaction.model, transaction.family)) throw new Error('Compiler input does not match geometry validated by the executor.');
    const sourceFont = compile(prepared.source.model);
    const candidateFont = compile(transaction.model);
    if (!sourceFont.audit?.valid || !candidateFont.audit?.valid) throw new Error('The compiler internal SFNT audit rejected a diagnostic font.');
    const parsedH = candidateFont.parsed?.glyphs?.h;
    if (!parsedH || parsedH.unicodes?.[0] !== 0x0068) throw new Error('The candidate font does not map lowercase h to U+0068.');
    for (const id of prepared.parentGlyphIds) {
      const name = prepared.source.model.glyphRegistry.glyphs.find(item => item.id === id).name;
      if (JSON.stringify(sourceFont.parsed.glyphs[name]) !== JSON.stringify(candidateFont.parsed.glyphs[name])) {
        throw new Error(`An existing glyph record changed unexpectedly: ${name}.`);
      }
    }
    const execution = { ...transaction, sourceRevisionId: prepared.sourceRevisionId, parentGlyphIds: [...prepared.parentGlyphIds],
      sourceFont, candidateFont, stage: 'compiled-candidate' };
    execution.seal = digest({ model: execution.model, family: execution.family,
      sourceFont: digest(Buffer.from(sourceFont.bytes)), candidateFont: digest(Buffer.from(candidateFont.bytes)) });
    return { status: 'committed-candidate', technicalStatus: 'passed', candidateStatus: 'technically-valid-not-visually-reviewed',
      visualReview: { status: 'not-reviewed', decision: null, reviewer: null, evidenceRefs: [] },
      briefCompliance: clone(prepared.resolution.briefCompliance), sourceRevisionId: prepared.sourceRevisionId,
      candidateRevisionId: transaction.revision.id, specification: prepared.resolution, specimenPlan: prepared.plan,
      execution, fontMetrics: { glyphs: Object.fromEntries(['o', 'n', 'H', 'a', 'h'].filter(name => candidateFont.parsed.glyphs[name])
        .map(name => [name, { advanceWidth: candidateFont.parsed.glyphs[name].advanceWidth, bounds: candidateFont.parsed.glyphs[name].bounds }])) },
      compiler: 'fontsketch 0.1.0 with project internal SFNT audit; not independent validation' };
  } catch (error) {
    return rejected(prepared, 'compilation-failed', 'font-compilation', error.message);
  }
}

export function runWholeFontBrief(source, brief, options = {}) {
  const prepared = prepareCoordinatedCandidate(source, brief);
  if (prepared.status !== 'ready') return { status: 'rejected', candidateStatus: null, technicalStatus: 'not-run',
    stage: prepared.stage || 'resolution', diagnostics: prepared.diagnostics || [], candidate: null, sourceRevisionId: source?.model?.revisions?.headRevisionId };
  return runPreparedCandidate(prepared, options);
}

export function createDefaultAcceptedSource() { return createSingleStoreyAcceptedSource(); }

export function acceptWholeFontCandidate(candidate, { acceptIncompleteScope = false } = {}) {
  if (candidate?.candidateStatus !== 'visually-approved' || candidate.visualReview?.decision !== 'approved') {
    throw new Error('A candidate requires an explicit human visual approval before acceptance.');
  }
  if (candidate.briefCompliance?.status !== 'complete' && acceptIncompleteScope !== true) {
    throw new Error('This partial specimen can only be accepted with explicit acknowledgement of its unsupported brief requirements.');
  }
  const accepted = acceptHCandidate(candidate.execution);
  return { ...accepted, acceptedScope: candidate.briefCompliance?.status === 'complete' ? 'whole-brief' : 'partial-specimen-only',
    visualReview: clone(candidate.visualReview), briefCompliance: clone(candidate.briefCompliance) };
}

export { recordVisualReview, runFollowup };
