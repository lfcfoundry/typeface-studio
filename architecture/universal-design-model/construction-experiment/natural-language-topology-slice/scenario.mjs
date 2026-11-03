import { createHash } from 'node:crypto';
import { canonicalizeInitialGeometry, executeTransaction, resolveSelector, validateV2Model } from '../../integration-experiment/engine.mjs';
import { buildLowercaseACandidate } from '../a-experiment.mjs';
import { compilerProject, compileSemanticDesign } from '../font-adapter.mjs';
import { validateSemanticDesign } from '../model.mjs';
import { validateGlyph } from '../../../../prototype/src/contours.js';
import { design as makeStackDesign, derive as deriveStack, resolve as resolveStack } from '../two-storey-grammar/grammar.mjs';

export const SUPPORTED_REQUEST = 'Make the lowercase a double-storey and leave the other glyphs unchanged.';
export const GLYPH_A = 'glyph:u0061';
export const TOPOLOGY_OPERATION = 'construct.glyph.set-topology';
export const FOLLOWUP_OPERATION = 'construct.bowl.set-width';

const clone = structuredClone;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const freezeData = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeData(child);
  }
  return value;
};

function diagnostic(code, message) { return { code, message }; }
function sourceSpan(text, fragment, from = 0) {
  const start = text.indexOf(fragment, from);
  if (start < 0) throw new Error(`Request span not found: ${fragment}`);
  return { messageId: 'msg:nl-topology-1', start, end: start + fragment.length, text: fragment };
}

/** Exact, deliberately limited grammar. No unrecognized brief is converted to an operation. */
export function interpretRequest(input) {
  if (typeof input !== 'string') return { status: 'invalid', diagnostics: [diagnostic('malformed-input', 'Request must be text.')] };
  const text = input;
  if (!text.trim()) return { status: 'invalid', diagnostics: [diagnostic('empty-input', 'Enter a construction request.')] };
  const normalized = text.trim().toLocaleLowerCase('en').replace(/[’]/gu, "'").replace(/[–—]/gu, '-').replace(/\s+/gu, ' ');

  if (/\b(?:single|one)-storey\b[\s\S]*\bdouble[- ]storey\b|\bdouble[- ]storey\b[\s\S]*\b(?:single|one)-storey\b/u.test(normalized)) {
    return { status: 'conflict', diagnostics: [diagnostic('conflicting-topology', 'The request asks for both single-storey and double-storey lowercase a.')] };
  }
  if (/\b(?:lowercase|lower-case)\s+b\b|\bglyph\s+b\b/u.test(normalized)) {
    return { status: 'unsupported', diagnostics: [diagnostic('unsupported-target', 'This slice supports only lowercase a.')] };
  }
  if (/\b(?:uppercase|upper-case|capital)\s+a\b/u.test(normalized)) {
    return { status: 'unsupported', diagnostics: [diagnostic('unsupported-target', 'Uppercase A is outside this slice.')] };
  }
  if (/\b(?:triple|three)-storey\b/u.test(normalized)) {
    return { status: 'unsupported', diagnostics: [diagnostic('unsupported-topology', 'Only the existing single-storey and double-storey a constructions are supported.')] };
  }
  if (/\b(?:double[- ]storey|double story)\b/u.test(normalized) && !/\b(?:lowercase|lower-case)\s+a\b/u.test(normalized)) {
    return { status: 'ambiguous', diagnostics: [diagnostic('ambiguous-target', 'Name lowercase a explicitly; an unqualified “a” could mean a letter or an article.')] };
  }

  const supported = [
    /^make the lowercase a double[- ]storey and leave the other glyphs unchanged[.!]?$/u,
    /^change lowercase a to double[- ]storey, keeping every other glyph unchanged[.!]?$/u
  ];
  if (!supported.some(pattern => pattern.test(normalized))) {
    return { status: 'unsupported', diagnostics: [diagnostic('unsupported-request', 'This experiment accepts the stated lowercase-a topology request and one documented wording variant only.')] };
  }

  const targetFragment = normalized.startsWith('make ')
    ? text.slice(text.toLocaleLowerCase('en').indexOf('lowercase a'), text.toLocaleLowerCase('en').indexOf('lowercase a') + 'lowercase a double-storey'.length)
    : text.slice(text.toLocaleLowerCase('en').indexOf('lowercase a'), text.toLocaleLowerCase('en').indexOf('lowercase a') + 'lowercase a to double-storey'.length);
  const preserveFragment = normalized.startsWith('make ')
    ? 'leave the other glyphs unchanged'
    : 'every other glyph unchanged';
  const targetSource = sourceSpan(text, targetFragment);
  const preserveSource = sourceSpan(text, preserveFragment);
  const intentId = 'intent:nl-double-storey-a';
  const preserveIntentId = 'intent:nl-preserve-other-glyphs';
  const intents = [
    { id: intentId, kind: 'construction', subject: { scope: 'glyph', selectorId: 'sel:nl-lowercase-a' },
      predicate: 'glyph.construction.topology', value: { topology: 'double-storey' }, source: targetSource,
      origin: 'explicit', confidence: 1, resolution: { status: 'resolved', capability: 'implemented-experiment', reason: null },
      supersedes: ['decision:a-single-storey-topology'], conflicts: [] },
    { id: preserveIntentId, kind: 'preservation', subject: { scope: 'glyph-set', selectorId: 'sel:nl-other-glyphs' },
      predicate: 'glyph.preserve', value: { scope: 'all-other-registered-glyphs' }, source: preserveSource,
      origin: 'explicit', confidence: 1, resolution: { status: 'resolved', capability: 'implemented-experiment', reason: null },
      supersedes: [], conflicts: [] }
  ];
  return { status: 'resolved', text: input, intents, targetGlyphName: 'a', codePoint: 0x0061,
    expectedTopology: 'single-storey', requestedTopology: 'double-storey', explicit: ['target', 'topology', 'preserve-other-glyphs'], inferred: [] };
}

function normalizeStackDesign(stack, source, status = 'accepted') {
  const normalized = clone(stack);
  normalized.id = source.id;
  normalized.name = source.name;
  normalized.characterIdentity = [...source.unicodes];
  normalized.encoding = [...source.unicodes];
  normalized.revision = { id: 'construction:single-storey-a', status, parent: null };
  normalized.provenance = { origin: 'explicit', source: 'Accepted single-storey semantic construction fixture', parentConstruction: source.construction.method };
  return normalized;
}

function registryInfo(model, id) { return model.glyphRegistry.glyphs.find(glyph => glyph.id === id); }

function createFamily(model) {
  const project = compilerProject(model);
  const family = clone(project);
  family.glyphs = Object.fromEntries(family.glyphOrder.map(id => {
    const record = registryInfo(model, id);
    const glyph = family.glyphs[id];
    return [id, { ...glyph, id, character: record.character ?? record.name,
      unicode: record.unicodes.length === 1 ? record.unicodes[0] : null, classes: [...record.classes] }];
  }));
  const canonical = canonicalizeInitialGeometry(family);
  for (const id of canonical.glyphOrder) {
    const prior = model.derived.geometry.glyphs[id];
    model.derived.geometry.glyphs[id] = { ...prior, ...canonical.glyphs[id] };
  }
  return canonical;
}

/** Build an accepted, isolated source snapshot by accepting the existing single-storey-a fixture. */
export function createAcceptedSource() {
  const created = buildLowercaseACandidate();
  const model = clone(created.model);
  for (const characteristic of model.state.characteristics) {
    if (characteristic.acceptance === 'candidate') characteristic.acceptance = 'accepted';
  }
  const priorRevision = model.revisions.headRevisionId;
  const glyph = registryInfo(model, GLYPH_A);
  const stack = normalizeStackDesign(makeStackDesign(1), glyph);
  model.constructionEngine.supportedMethods.push('construction.spine-and-bowl-stack');
  model.constructionIntegration = { version: 1, instances: {
    [GLYPH_A]: { ownerGlyphId: GLYPH_A, capability: 'capability:spine-bowl-stack-v1', design: stack }
  } };
  model.input.messages = [{ id: 'msg:source-single-a', text: 'Accepted source: single-storey lowercase a.' }];
  model.operations = [];
  const family = createFamily(model);
  const sourceId = `rev:${digest({ parent: priorRevision, constructionIntegration: model.constructionIntegration,
    glyphRegistry: model.glyphRegistry, family: family.glyphOrder.map(id => family.glyphs[id]) }).slice(0, 16)}`;
  model.revisions.items.push({ id: sourceId, parentRevisionIds: [priorRevision], status: 'accepted',
    decisionIds: [...model.state.decisions], operationIds: [], deltaOperationIds: [], changedGlyphIds: [],
    preservedGlyphIds: [...family.glyphOrder], targetedGlyphIds: [],
    diff: { semanticChanges: [], geometryChanges: [], note: 'Accepted adapter-backed single-storey source snapshot.' } });
  model.revisions.acceptedRevisionId = sourceId;
  model.revisions.headRevisionId = sourceId;
  model.derived.geometry.sourceRevisionId = sourceId;
  const errors = [...validateSemanticDesign(model), ...validateV2Model(model)];
  if (errors.length) throw new Error(`Invalid accepted source fixture: ${errors.join(' ')}`);
  const grammarSingle = deriveStack(stack);
  const sourceA = family.glyphs[GLYPH_A];
  const sameOutline = JSON.stringify(sourceA.contours.map(contour => contour.points.map(({ x, y, on }) => ({ x, y, on })))) ===
    JSON.stringify(grammarSingle.contours.map(contour => contour.points.map(({ x, y, on }) => ({ x, y, on }))));
  if (!sameOutline || JSON.stringify(sourceA.metrics) !== JSON.stringify(grammarSingle.metrics)) {
    throw new Error('The selected grammar single-storey fixture does not match the accepted source outline and metrics.');
  }
  return { model, family };
}

function selectorFor(model, id, expression) {
  const selector = { id, universe: 'glyph-registry-at-revision', registryRevisionId: model.glyphRegistry.revisionId,
    expression, exclude: [], resolution: null };
  selector.resolution = resolveSelector(selector, model.glyphRegistry.glyphs, { registryRevisionId: model.glyphRegistry.revisionId });
  return selector;
}

function operationRecord({ id, type, selectorId, parameters, intents, source, revisionId }) {
  return { id, type, selectorId, phase: 'construction', parameters, dependsOn: [],
    preconditions: [{ type: 'revision', id: revisionId }], postconditions: ['semantic-topology-valid', 'geometry-valid', 'metrics-valid'],
    metricPolicy: { advance: 'preserve', bearings: 'recompute-from-derived-bounds', kerning: 'invalidate-for-review' },
    provenance: { intentIds: intents.map(intent => intent.id), acceptedDecisionIds: [], source: { text: source } },
    capability: 'implemented-experiment', resolution: { status: 'resolved', reason: null }, conflicts: [], exceptions: [] };
}

function topologyProjection(stack, priorConstruction) {
  const ids = { spine: 'part:a-stem', top: 'part:a-upper-terminal', bottom: 'part:a-lower-terminal',
    'bowl:0': 'part:a-bowl', 'counter:0': 'part:a-counter', 'bowl:1': 'part:a-upper-bowl',
    'counter:1': 'part:a-upper-counter', 'join:1': 'part:a-middle-connector' };
  const decisionStem = 'decision:shared-stem-width';
  const decisionXHeight = 'decision:x-height';
  const decisionBaseline = 'decision:baseline';
  const bowls = stack.construction.nodes.filter(node => node.component === 'bowl').sort((a, b) => a.id.localeCompare(b.id));
  const counters = stack.construction.nodes.filter(node => node.component === 'counter');
  const bowlNodes = bowls.map((node, index) => ({ id: ids[node.id], kind: 'anatomy.bowl', role: index === 0 ? 'lower-bowl' : 'upper-bowl',
    parameters: { ...clone(node.parameters), profile: 'quadratic-half-ellipse', widthDecisionId: decisionStem, xHeightDecisionId: decisionXHeight },
    relations: [{ type: 'attaches-to', targetId: ids.spine, side: 'left' }, { type: 'aligned-to', targetId: decisionXHeight }] }));
  const counterNodes = counters.map((node, index) => {
    const relation = stack.construction.relations.find(item => item.type === 'contained-by' && item.source === node.id);
    return { id: ids[node.id], kind: 'anatomy.counter', role: index === 0 ? 'lower-bowl-counter' : 'upper-bowl-counter',
      parameters: clone(node.parameters), relations: [{ type: 'contained-by', targetId: ids[relation.target] }] };
  });
  const nodes = [
    { id: ids.spine, kind: 'anatomy.stem', role: 'shared-spine', parameters: { widthDecisionId: decisionStem },
      relations: [{ type: 'supports', targetId: ids.top }, { type: 'supports', targetId: ids.bottom }] },
    { id: ids.top, kind: 'anatomy.terminal', role: 'upper-stem-terminal', parameters: { profile: 'flat', alignmentDecisionId: decisionXHeight },
      relations: [{ type: 'attaches-to', targetId: ids.spine }, { type: 'aligned-to', targetId: decisionXHeight }] },
    { id: ids.bottom, kind: 'anatomy.terminal', role: 'lower-stem-terminal', parameters: { profile: 'flat', alignmentDecisionId: decisionBaseline },
      relations: [{ type: 'attaches-to', targetId: ids.spine }, { type: 'aligned-to', targetId: decisionBaseline }] },
    ...bowlNodes,
    ...counterNodes,
    { id: 'part:a-lower-join', kind: 'anatomy.join', role: 'lower-bowl-spine-attachment', parameters: {},
      relations: [{ type: 'connects', targetId: ids['bowl:0'] }, { type: 'attaches-to', targetId: ids.spine }] },
    { id: 'part:a-upper-join', kind: 'anatomy.join', role: 'upper-bowl-spine-attachment', parameters: {},
      relations: [{ type: 'connects', targetId: ids['bowl:1'] }, { type: 'attaches-to', targetId: ids.spine }] },
    ...stack.construction.nodes.filter(node => node.component === 'connector').map(node => ({ id: ids[node.id], kind: 'anatomy.join', role: 'inter-bowl-connector',
      parameters: { continuity: 'G1' }, relations: [
        { type: 'connects', targetId: ids[stack.construction.relations.find(relation => relation.type === 'connects' && relation.source === node.id).lower] },
        { type: 'connects', targetId: ids[stack.construction.relations.find(relation => relation.type === 'connects' && relation.source === node.id).upper] },
        { type: 'attaches-to', targetId: ids.spine }
      ] }))
  ];
  return { version: 1, method: 'construction.spine-and-bowl-stack',
    parameters: { topology: 'double-storey', stemSide: 'right', grammar: 'lfcfoundry.spine-bowl-grammar@1' },
    rootNodeIds: nodes.map(node => node.id), nodes,
    constraints: [{ id: 'constraint:a-double-lower-enclosure', type: 'containment', nodes: [ids['counter:0'], ids['bowl:0']] },
      { id: 'constraint:a-double-upper-enclosure', type: 'containment', nodes: [ids['counter:1'], ids['bowl:1']] },
      { id: 'constraint:a-double-connected-stack', type: 'connected-stack', nodes: [ids['bowl:0'], ids['bowl:1'], ids['spine']] }],
    identityDiff: { preservedNodeIds: ['part:a-stem', 'part:a-upper-terminal', 'part:a-lower-terminal', 'part:a-bowl', 'part:a-counter', 'part:a-lower-join', 'part:a-upper-join'],
      addedNodeIds: ['part:a-upper-bowl', 'part:a-upper-counter', 'part:a-middle-connector'],
      replacedTopology: priorConstruction.parameters.topology } };
}

function geometryRecord(derived, glyphRecord, stack) {
  const map = { spine: 'part:a-stem', top: 'part:a-upper-terminal', bottom: 'part:a-lower-terminal',
    'bowl:0': 'part:a-bowl', 'counter:0': 'part:a-counter', 'bowl:1': 'part:a-upper-bowl',
    'counter:1': 'part:a-upper-counter', 'join:1': 'part:a-middle-connector' };
  const translated = { ...clone(derived), id: glyphRecord.id, name: glyphRecord.name, character: glyphRecord.character,
    unicode: glyphRecord.unicodes[0], classes: [...glyphRecord.classes],
    components: derived.components.map(component => ({ ...component, id: map[component.id] || component.id })),
    constructionId: `construction:${glyphRecord.id}`, derivedFromNodeIds: Object.values(map), constructionHash: digest(stack.construction) };
  return canonicalizeInitialGeometry({ glyphOrder: [glyphRecord.id], glyphs: { [glyphRecord.id]: translated } }).glyphs[glyphRecord.id];
}

function appendTopologyState(model, intent, projection) {
  const oldDecision = model.state.characteristics.find(item => item.id === 'decision:a-single-storey-topology');
  if (!oldDecision || oldDecision.value?.value !== 'single-storey') throw new Error('Accepted source topology decision is missing or incompatible.');
  oldDecision.acceptance = 'superseded';
  oldDecision.supersededBy = 'decision:a-double-storey-topology';
  const newId = 'decision:a-double-storey-topology';
  model.state.characteristics.push({ id: newId, property: 'glyph.construction.topology',
    value: { kind: 'enum', value: 'double-storey' }, selectorId: 'sel:nl-lowercase-a', origin: 'explicit', certainty: 1,
    acceptance: 'candidate', capability: 'implemented-experiment', sourceIntentIds: [intent.id], dependencyIds: [GLYPH_A],
    supersedes: [oldDecision.id], semanticIdentityDiff: projection.identityDiff });
  model.state.decisions.push(newId);
  return projection;
}

function makeDoubleStorey(sourceStack, operation, construct = makeStackDesign) {
  const template = clone(construct(2));
  template.id = sourceStack.id;
  template.name = sourceStack.name;
  template.characterIdentity = [...sourceStack.characterIdentity];
  template.encoding = [...sourceStack.encoding];
  template.decisions = clone(sourceStack.decisions);
  template.provenance = { origin: 'explicit', source: operation.provenance.source.text,
    parentConstruction: 'construction.bowl-with-attached-stem' };
  template.revision = { id: `construction:${digest({ parent: sourceStack.revision.id, operation, construction: template.construction }).slice(0, 16)}`,
    parent: sourceStack.revision.id, status: 'candidate', operation: clone(operation),
    diff: { fromTopology: 'single-storey', toTopology: 'double-storey', addedNodeIds: ['bowl:1', 'counter:1', 'join:1'], preservedNodeIds: ['spine', 'top', 'bottom', 'bowl:0', 'counter:0'] } };
  return template;
}

function updateTarget(model, family, glyph, stack, derive = deriveStack) {
  const topology = resolveStack(stack);
  const projection = topologyProjection(stack, registryInfo(model, GLYPH_A).construction);
  const errors = [...validateSemanticDesign({ ...model,
    glyphRegistry: { ...model.glyphRegistry, glyphs: model.glyphRegistry.glyphs.map(item => item.id === GLYPH_A ? { ...item, construction: projection } : item) } })];
  if (errors.length) throw new Error(`Semantic topology validation failed: ${errors.join(' ')}`);
  const record = registryInfo(model, GLYPH_A);
  const derived = derive(stack);
  if (derived.contours?.length !== topology.bowls.length + 1 || derived.contours[0]?.role !== 'outer' ||
      derived.contours.slice(1).some(contour => contour.role !== 'counter')) {
    throw new Error('Derived geometry does not contain one outer contour and one counter per semantic bowl.');
  }
  const geometry = geometryRecord(derived, record, stack);
  const geometryErrors = validateGlyph({ ...geometry, advanceWidth: geometry.metrics.advanceWidth,
    rightSideBearing: geometry.metrics.rightSideBearing });
  if (geometryErrors.length) throw new Error(`Derived topology geometry is invalid: ${geometryErrors.join(' ')}`);
  const oldMetrics = glyph.metrics;
  if (geometry.metrics.advanceWidth !== oldMetrics.advanceWidth ||
      geometry.metrics.leftSideBearing !== geometry.bounds.xMin ||
      geometry.metrics.rightSideBearing !== geometry.metrics.advanceWidth - geometry.bounds.xMax) {
    throw new Error('Derived topology geometry violates the declared metric policy.');
  }
  record.construction = projection;
  model.derived.geometry.glyphs[GLYPH_A] = clone(geometry);
  model.derived.geometry.sourceRevisionId = model.revisions.headRevisionId;
  model.constructionIntegration.instances[GLYPH_A].design = stack;
  model.constructionIntegration.instances[GLYPH_A].semanticDiff = clone(projection.identityDiff);
  model.constructionIntegration.trace ||= [];
  model.constructionIntegration.trace.push({ operationId: model.operations.at(-1)?.id,
    glyphId: GLYPH_A, constructionRevisionId: stack.revision.id, geometryHash: digest({ contours: geometry.contours, metrics: geometry.metrics }) });
  Object.assign(glyph, clone(geometry));
  return projection;
}

function strictKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...expected].sort().join('|')) {
    throw new Error(`Malformed ${label} parameter schema.`);
  }
}

function topologyHandlerFactory({ deriveTopology = deriveStack, constructDoubleStorey = makeStackDesign } = {}) {
  return ({ model, family, glyph, operation }) => {
    strictKeys(operation.parameters, ['glyphId', 'expectedTopology', 'topology', 'expectedConstructionRevisionId'], 'topology operation');
    const p = operation.parameters;
    if (operation.type !== TOPOLOGY_OPERATION || p.glyphId !== glyph.id || glyph.id !== GLYPH_A) throw new Error('Topology operation target is not the selected lowercase a.');
    if (p.expectedTopology !== 'single-storey' || p.topology !== 'double-storey') throw new Error('Unsupported topology transition.');
    const integration = model.constructionIntegration?.instances?.[GLYPH_A];
    if (!integration || integration.ownerGlyphId !== glyph.id || integration.capability !== 'capability:spine-bowl-stack-v1') throw new Error('Missing, ambiguous, or wrongly owned construction target.');
    const sourceStack = integration.design;
    if (sourceStack.revision.status !== 'accepted' || sourceStack.revision.id !== p.expectedConstructionRevisionId) throw new Error('Stale or unaccepted nested construction revision.');
    if (registryInfo(model, GLYPH_A).construction.parameters?.topology !== p.expectedTopology || resolveStack(sourceStack).bowls.length !== 1) {
      throw new Error('Accepted lowercase a is not the expected single-storey construction.');
    }
    const stack = makeDoubleStorey(sourceStack, operation, constructDoubleStorey);
    const resolved = resolveStack(stack);
    if (resolved.bowls.length !== 2 || stack.construction.nodes.filter(node => node.component === 'counter').length !== 2) throw new Error('Double-storey grammar must contain two bowls and two counters.');
    const intent = model.intent.statements.find(item => operation.provenance.intentIds.includes(item.id) && item.kind === 'construction');
    if (!intent) throw new Error('Topology operation has no source construction intent.');
    const projection = appendTopologyState(model, intent, topologyProjection(stack, registryInfo(model, GLYPH_A).construction));
    updateTarget(model, family, glyph, stack, deriveTopology);
    const decision = model.state.characteristics.find(item => item.id === 'decision:a-double-storey-topology');
    decision.semanticIdentityDiff = clone(projection.identityDiff);
  };
}

function followupHandler({ deriveTopology = deriveStack } = {}) {
  return ({ model, family, glyph, operation }) => {
    strictKeys(operation.parameters, ['glyphId', 'bowlId', 'expectedWidth', 'width', 'expectedConstructionRevisionId'], 'bowl-width follow-up');
    const p = operation.parameters;
    if (operation.type !== FOLLOWUP_OPERATION || p.glyphId !== glyph.id || glyph.id !== GLYPH_A || p.bowlId !== 'bowl:1') throw new Error('Unsupported follow-up target.');
    const instance = model.constructionIntegration?.instances?.[GLYPH_A];
    if (!instance || instance.ownerGlyphId !== glyph.id || instance.design.revision.status !== 'accepted' || instance.design.revision.id !== p.expectedConstructionRevisionId) {
      throw new Error('Stale or wrongly owned follow-up construction target.');
    }
    const stack = clone(instance.design);
    const nodes = stack.construction.nodes.filter(node => node.id === p.bowlId && node.component === 'bowl');
    if (nodes.length !== 1 || nodes[0].parameters.width !== p.expectedWidth || !Number.isFinite(p.width) || p.width <= 0 || p.width >= 1) {
      throw new Error('Follow-up bowl precondition or width is invalid.');
    }
    nodes[0].parameters.width = p.width;
    resolveStack(stack);
    stack.revision = { id: `construction:${digest({ parent: instance.design.revision.id, operation, construction: stack.construction }).slice(0, 16)}`,
      parent: instance.design.revision.id, status: 'candidate', operation: clone(operation),
      diff: { changedNodeIds: ['bowl:1'], fromWidth: p.expectedWidth, toWidth: p.width } };
    const oldGraph = registryInfo(model, GLYPH_A).construction;
    const projection = topologyProjection(stack, oldGraph);
    const semanticModel = { ...model, glyphRegistry: { ...model.glyphRegistry,
      glyphs: model.glyphRegistry.glyphs.map(item => item.id === GLYPH_A ? { ...item, construction: projection } : item) } };
    const errors = validateSemanticDesign(semanticModel);
    if (errors.length) throw new Error(`Follow-up semantic validation failed: ${errors.join(' ')}`);
    const resolved = resolveStack(stack);
    const derived = deriveTopology(stack);
    if (derived.contours?.length !== resolved.bowls.length + 1 || derived.contours[0]?.role !== 'outer' ||
        derived.contours.slice(1).some(contour => contour.role !== 'counter')) throw new Error('Follow-up geometry does not match the semantic bowl/counter topology.');
    const geometry = geometryRecord(derived, registryInfo(model, GLYPH_A), stack);
    const geometryErrors = validateGlyph({ ...geometry, advanceWidth: geometry.metrics.advanceWidth,
      rightSideBearing: geometry.metrics.rightSideBearing });
    if (geometryErrors.length) throw new Error(`Follow-up geometry is invalid: ${geometryErrors.join(' ')}`);
    registryInfo(model, GLYPH_A).construction = projection;
    model.derived.geometry.glyphs[GLYPH_A] = clone(geometry);
    model.constructionIntegration.instances[GLYPH_A].design = stack;
    model.constructionIntegration.instances[GLYPH_A].semanticDiff = clone(projection.identityDiff);
    model.constructionIntegration.trace.push({ operationId: operation.id, glyphId: GLYPH_A,
      constructionRevisionId: stack.revision.id, geometryHash: digest({ contours: geometry.contours, metrics: geometry.metrics }) });
    Object.assign(glyph, clone(geometry));
  };
}

export function operationHandlers(options = {}) {
  return Object.freeze({
    [TOPOLOGY_OPERATION]: topologyHandlerFactory(options),
    [FOLLOWUP_OPERATION]: followupHandler(options)
  });
}

export function prepareTopologyTransaction(source, requestText) {
  const interpreted = interpretRequest(requestText);
  if (interpreted.status !== 'resolved') return { status: interpreted.status, diagnostics: interpreted.diagnostics, candidate: null };
  const model = clone(source.model);
  const family = clone(source.family);
  const targetExpression = { op: 'all', args: [{ op: 'class', value: 'lowercase' }, { op: 'unicode', value: 0x0061 }] };
  const otherExpression = { op: 'all', args: [{ op: 'glyph-registry' }, { op: 'not', arg: { op: 'glyph-id', value: GLYPH_A } }] };
  const targetSelector = model.selectors.find(item => item.id === 'sel:nl-lowercase-a') || selectorFor(model, 'sel:nl-lowercase-a', targetExpression);
  const otherSelector = model.selectors.find(item => item.id === 'sel:nl-other-glyphs') || selectorFor(model, 'sel:nl-other-glyphs', otherExpression);
  if (JSON.stringify(targetSelector.expression) !== JSON.stringify(targetExpression) ||
      JSON.stringify(otherSelector.expression) !== JSON.stringify(otherExpression)) {
    return { status: 'rejected', stage: 'target-resolution', diagnostics: [diagnostic('invalid-selector', 'An existing selector does not match this request scope.')], candidate: null };
  }
  const targetFresh = resolveSelector(targetSelector, model.glyphRegistry.glyphs, { registryRevisionId: model.glyphRegistry.revisionId });
  const otherFresh = resolveSelector(otherSelector, model.glyphRegistry.glyphs, { registryRevisionId: model.glyphRegistry.revisionId });
  if (targetSelector.registryRevisionId !== model.glyphRegistry.revisionId || otherSelector.registryRevisionId !== model.glyphRegistry.revisionId ||
      targetFresh.status !== targetSelector.resolution?.status ||
      JSON.stringify(targetFresh.includedGlyphIds) !== JSON.stringify(targetSelector.resolution?.includedGlyphIds) ||
      otherFresh.status !== otherSelector.resolution?.status ||
      JSON.stringify(otherFresh.includedGlyphIds) !== JSON.stringify(otherSelector.resolution?.includedGlyphIds)) {
    return { status: 'rejected', stage: 'target-resolution', diagnostics: [diagnostic('stale-selector', 'A target or preservation selector is stale for the accepted glyph registry.')], candidate: null };
  }
  if (targetSelector.resolution.status !== 'resolved' || targetSelector.resolution.includedGlyphIds.length !== 1 || targetSelector.resolution.includedGlyphIds[0] !== GLYPH_A) {
    return { status: 'rejected', stage: 'target-resolution', diagnostics: [diagnostic(
      targetSelector.resolution.status === 'ambiguous' ? 'ambiguous-target' : 'missing-target',
      `The lowercase-a target did not resolve to exactly one glyph: ${targetSelector.resolution.status}.`)], candidate: null };
  }
  const baseRevisionId = model.revisions.headRevisionId;
  const stackRevisionId = model.constructionIntegration.instances[GLYPH_A]?.design?.revision?.id;
  if (!stackRevisionId) return { status: 'rejected', stage: 'target-resolution', diagnostics: [diagnostic('missing-construction', 'Lowercase a has no registered spine-and-bowl construction.')], candidate: null };
  const operation = operationRecord({ id: 'op:nl-double-storey-a', type: TOPOLOGY_OPERATION, selectorId: targetSelector.id,
    parameters: { glyphId: GLYPH_A, expectedTopology: interpreted.expectedTopology,
      topology: interpreted.requestedTopology, expectedConstructionRevisionId: stackRevisionId },
    intents: interpreted.intents, source: interpreted.text, revisionId: baseRevisionId });
  if (!model.selectors.some(item => item.id === targetSelector.id)) model.selectors.push(targetSelector);
  if (!model.selectors.some(item => item.id === otherSelector.id)) model.selectors.push(otherSelector);
  model.input.messages = [...(model.input.messages || []), { id: 'msg:nl-topology-1', text: requestText }];
  model.intent.statements.push(...clone(interpreted.intents));
  model.operations = [operation];
  return { status: 'ready', interpreted, model, family, operation, sourceRevisionId: baseRevisionId,
    targetGlyphId: GLYPH_A, preservedGlyphIds: [...otherSelector.resolution.includedGlyphIds] };
}

export function runPreparedTransaction(prepared, options = {}) {
  if (prepared.status !== 'ready') return { status: prepared.status, stage: prepared.stage || 'interpretation', diagnostics: prepared.diagnostics || [], candidate: null };
  const result = executeTransaction(prepared.model, prepared.family, { operationHandlers: operationHandlers(options) });
  if (result.status !== 'committed-candidate') return { status: 'rejected', stage: 'transaction', error: result.error, candidate: null,
    model: prepared.model, family: prepared.family };
  result.model.derived.geometry.sourceRevisionId = result.revision.id;
  return { ...result, status: 'committed-candidate', sourceRevisionId: prepared.sourceRevisionId,
    targetGlyphId: prepared.targetGlyphId, preservedGlyphIds: prepared.preservedGlyphIds,
    interpreted: prepared.interpreted, operation: prepared.operation };
}

export function runTopologyRequest(source, requestText, { compile = compileSemanticDesign, ...handlerOptions } = {}) {
  const prepared = prepareTopologyTransaction(source, requestText);
  if (prepared.status !== 'ready') return { status: 'rejected', stage: prepared.stage || (prepared.status === 'resolved' ? 'target-resolution' : 'interpretation'),
    diagnostics: prepared.diagnostics || [], candidate: null, model: source.model, family: source.family };
  const transaction = runPreparedTransaction(prepared, handlerOptions);
  if (transaction.status !== 'committed-candidate') return { ...transaction, model: source.model, family: source.family };
  try {
    const sourceFont = compile(source.model);
    const candidateFont = compile(transaction.model);
    const record = registryInfo(transaction.model, GLYPH_A);
    if (!candidateFont.audit.valid || candidateFont.parsed.glyphs[record.name]?.unicodes?.[0] !== 0x0061) {
      throw new Error('Candidate font compilation did not preserve the lowercase-a mapping or pass internal SFNT checks.');
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
  if (result.status !== 'committed-candidate' || result.stage !== 'compiled-candidate' ||
      result.seal !== digest({ model: result.model, family: result.family,
        sourceFont: digest(Buffer.from(result.sourceFont.bytes)), candidateFont: digest(Buffer.from(result.candidateFont.bytes)) })) {
    throw new Error('Only an unchanged, internally compiled candidate can be accepted.');
  }
  const accepted = { model: clone(result.model), family: clone(result.family) };
  const revision = accepted.model.revisions.items.at(-1);
  if (revision.status !== 'candidate' || revision.parentRevisionIds[0] !== result.sourceRevisionId) throw new Error('Candidate revision lineage is invalid.');
  revision.status = 'accepted';
  accepted.model.revisions.acceptedRevisionId = revision.id;
  const nested = accepted.model.constructionIntegration.instances[GLYPH_A].design;
  if (nested.revision.status !== 'candidate' || nested.revision.parent !== 'construction:single-storey-a') throw new Error('Nested construction candidate lineage is invalid.');
  nested.revision.status = 'accepted';
  for (const item of accepted.model.state.characteristics) if (item.acceptance === 'candidate') item.acceptance = 'accepted';
  return { model: freezeData(accepted.model), family: freezeData(accepted.family),
    acceptedRevisionId: revision.id, font: result.candidateFont };
}

export function runFollowup(accepted, { id = 'op:a-upper-bowl-width-followup', width = 0.62,
  compile = compileSemanticDesign, ...handlerOptions } = {}) {
  const model = clone(accepted.model), family = clone(accepted.family);
  const nested = model.constructionIntegration.instances[GLYPH_A].design;
  const intent = { id: `intent:${id}`, kind: 'construction', subject: { scope: 'glyph', selectorId: 'sel:nl-lowercase-a' },
    predicate: 'anatomy.bowl.width', value: { bowlId: 'bowl:1', width },
    source: { messageId: `msg:${id}`, start: 0, end: 0, text: 'Narrow the upper bowl slightly.' }, origin: 'explicit', confidence: 1,
    resolution: { status: 'resolved', capability: 'implemented-experiment', reason: null }, supersedes: [], conflicts: [] };
  const operation = operationRecord({ id, type: FOLLOWUP_OPERATION, selectorId: 'sel:nl-lowercase-a',
    parameters: { glyphId: GLYPH_A, bowlId: 'bowl:1', expectedWidth: nested.construction.nodes.find(node => node.id === 'bowl:1')?.parameters.width,
      width, expectedConstructionRevisionId: nested.revision.id }, intents: [intent], source: intent.source.text,
    revisionId: model.revisions.headRevisionId });
  model.intent.statements.push(intent);
  model.operations = [operation];
  const result = executeTransaction(model, family, { operationHandlers: operationHandlers(handlerOptions) });
  if (result.status !== 'committed-candidate') return { ...result, status: 'rejected', stage: 'follow-up-transaction', model: accepted.model, family: accepted.family };
  result.model.derived.geometry.sourceRevisionId = result.revision.id;
  try {
    const font = compile(result.model);
    if (!font.audit.valid) throw new Error('Follow-up font failed internal SFNT checks.');
    return { ...result, stage: 'follow-up-candidate', font, sourceRevisionId: accepted.acceptedRevisionId };
  } catch (error) {
    return { status: 'rejected', stage: 'follow-up-font-compilation', error: error.message, model: accepted.model, family: accepted.family };
  }
}

export function expectedMetrics(model) {
  const id = GLYPH_A;
  const glyph = model.derived.geometry.glyphs[id];
  return { bounds: clone(glyph.bounds), metrics: clone(glyph.metrics), contourCount: glyph.contours.length,
    counters: glyph.contours.filter(contour => contour.role === 'counter').length };
}

export { compilerProject, compileSemanticDesign, digest };
