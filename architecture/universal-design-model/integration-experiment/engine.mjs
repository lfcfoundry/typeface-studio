import { createHash } from 'node:crypto';
import { validateSpec } from '../../../prototype/src/spec.js';
import { heartOutline, } from '../../../prototype/src/glyph-operations.js';
import { contourBounds, rectContour, sampleContour, validateGlyph } from '../../../prototype/src/contours.js';

const DESIGN_TYPE = 'lfcfoundry.universal-typeface-design';
const DESIGN_VERSION = 2;
const mapCapability = value => ({ supported: 'implemented', approximate: 'approximate', unsupported: 'unsupported', unknown: 'unknown' })[value] || 'unknown';

function clone(value) { return structuredClone(value); }
function freezeData(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeData(child);
  }
  return value;
}
function digest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function canonicalJson(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (typeof value === 'bigint') throw new TypeError('Revision content must contain only JSON-compatible values.');
  if (ancestors.has(value)) throw new TypeError('Revision content cannot contain cycles.');
  ancestors.add(value);
  let result;
  if (Array.isArray(value)) {
    result = `[${Array.from({ length: value.length }, (_, index) => canonicalJson(value[index], ancestors) ?? 'null').join(',')}]`;
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      throw new TypeError('Revision content must contain only JSON-compatible records and arrays.');
    const entries = [];
    for (const key of Object.keys(value).sort()) {
      const serialized = canonicalJson(value[key], ancestors);
      if (serialized !== undefined) entries.push(`${JSON.stringify(key)}:${serialized}`);
    }
    result = `{${entries.join(',')}}`;
  }
  ancestors.delete(value);
  return result;
}
function contentDigest(value) { return createHash('sha256').update(canonicalJson(value)).digest('hex'); }
function sourceSpan(span, messageId = 'msg:1') {
  return { messageId, start: span?.start ?? null, end: span?.end ?? null, text: span?.text ?? '' };
}
function sourceRecord(text, start, end, messageId = 'msg:1') {
  return { messageId, start, end, text: text.slice(start, end) };
}

function legacyProperty(parameter, concept = '') {
  if (parameter === 'system' && /^construction\./u.test(concept)) return concept;
  return ({
    system: 'construction.seed-design', family: 'classification.family', width: 'proportion.width',
    stem: 'stroke.primary-width', weight: 'stroke.weight', contrast: 'stroke.contrast',
    xHeight: 'proportion.x-height', capHeight: 'proportion.cap-height', aperture: 'anatomy.aperture',
    counterScale: 'anatomy.counter-size', terminal: 'anatomy.terminal-shape', terminalRadiusRatio: 'anatomy.terminal-degree',
    spacing: 'spacing.side-bearings', monospaced: 'spacing.model', serifBracket: 'serif.bracket'
  })[parameter] || `legacy.${parameter}`;
}

function glyphClasses(glyph) {
  const classes = new Set(glyph.classes || []);
  const ch = glyph.character || glyph.name;
  if (ch && /^\p{L}$/u.test(ch)) {
    classes.add('letter');
    if (/^\p{Lu}$/u.test(ch)) classes.add('uppercase');
    if (/^\p{Ll}$/u.test(ch)) classes.add('lowercase');
  }
  if (glyph.unicode === 32 || ch === 'space') classes.add('spacing');
  if (ch === '.notdef' || glyph.name === '.notdef') classes.add('notdef');
  if (ch && /^[\p{P}\p{S}]$/u.test(ch)) classes.add('punctuation');
  return [...classes];
}

function glyphRegistry(family) {
  return family.glyphOrder.map(id => {
    const glyph = family.glyphs[id];
    return {
      id: glyph.id,
      name: glyph.name,
      character: glyph.character ?? null,
      unicodes: glyph.unicode === null || glyph.unicode === undefined ? [] : [glyph.unicode],
      classes: glyphClasses(glyph),
      metrics: clone(glyph.metrics)
    };
  });
}

function matchIdentity(registry, glyphName, codePoint) {
  const byName = registry.filter(g => g.name === glyphName || g.character === glyphName);
  const byUnicode = Number.isInteger(codePoint) ? registry.filter(g => g.unicodes.includes(codePoint)) : [];
  if (byName.length > 1 || byUnicode.length > 1) return { status: 'ambiguous', candidates: [...new Set([...byName, ...byUnicode].map(g => g.id))] };
  if (byName.length === 1 && byUnicode.length === 1 && byName[0].id !== byUnicode[0].id) return { status: 'ambiguous', candidates: [byName[0].id, byUnicode[0].id] };
  const result = byName[0] || byUnicode[0];
  return result ? { status: 'resolved', glyphId: result.id } : { status: 'unresolved', reason: `No registered glyph matches ${glyphName ?? `U+${Number(codePoint).toString(16)}`}.` };
}

function makeExactSelector(id, targets, registry) {
  const resolved = targets.map(target => matchIdentity(registry, target.glyph, target.codePoint));
  const ambiguous = resolved.find(item => item.status === 'ambiguous');
  const missing = resolved.find(item => item.status === 'unresolved');
  const members = [...new Set(resolved.filter(item => item.status === 'resolved').map(item => item.glyphId))];
  const status = ambiguous ? 'ambiguous' : missing ? 'unresolved' : members.length ? 'resolved' : 'empty';
  return {
    id, universe: 'glyph-registry-at-revision',
    expression: { op: 'any', args: members.map(glyphId => ({ op: 'glyph-id', value: glyphId })) },
    exclude: [], resolution: {
      status, includedGlyphIds: status === 'resolved' ? members : [], excludedGlyphIds: [],
      unclassifiedGlyphIds: [], reason: ambiguous?.candidates || missing?.reason || (status === 'empty' ? 'Selector matched no glyphs.' : null)
    }
  };
}

/**
 * Read-only adapter from the current v1 spec into the isolated v2 execution
 * model. The generator's family is supplied only as the v2 glyph registry;
 * v1 parameters are retained as mapped characteristics, not executed here.
 */
export function adaptV1Spec(spec, family, { revisionId = 'rev:v1-base' } = {}) {
  const validation = validateSpec(spec);
  if (validation.length) throw new Error(`Cannot adapt invalid v1 spec: ${validation.join(' ')}`);
  const original = clone(spec);
  const registry = glyphRegistry(family);
  const sourceText = spec.source.brief;
  const intents = [], characteristics = [], selectors = [], operations = [], warnings = [];
  const spanOwners = new Map();

  const globalRecords = [...(spec.instructions || []), ...(spec.inferred || [])];
  for (const [index, record] of globalRecords.entries()) {
    const span = sourceSpan(record.sourceSpan);
    const id = record.id || `instruction:${index + 1}`;
    const intentId = `intent:${id}`;
    intents.push({
      id: intentId, kind: record.origin === 'inferred' ? 'characteristic' : 'characteristic',
      subject: { scope: 'family', selectorId: 'sel:family' }, predicate: record.concept || 'legacy.unknown',
      value: { value: clone(record.resolvedValue ?? record.value), polarity: record.polarity ?? 'positive' },
      source: span, origin: record.origin === 'inferred' ? 'inferred' : 'explicit',
      confidence: Number.isFinite(record.certainty) ? record.certainty : 0.75,
      resolution: { status: record.capability === 'unsupported' ? 'unsupported' : 'resolved', capability: mapCapability(record.capability), reason: record.explanation || null },
      supersedes: [], conflicts: clone(record.conflicts || (record.negatedBy ? [record.negatedBy] : []))
    });
    for (const parameter of record.parameters || [record.concept || 'legacy.unknown']) {
      characteristics.push({ id: `decision:${id}:${parameter}`, property: legacyProperty(parameter, record.concept),
        value: { kind: 'legacy-parameter', value: clone(record.resolvedValue ?? record.value) }, selectorId: 'sel:family',
        origin: record.origin === 'inferred' ? 'inferred' : 'explicit', certainty: Number.isFinite(record.certainty) ? record.certainty : 0.75,
        acceptance: record.capability === 'unsupported' ? 'unresolved' : 'accepted', capability: mapCapability(record.capability),
        sourceIntentIds: [intentId], dependencyIds: [] });
    }
    if (span.start !== null) spanOwners.set(`${span.start}:${span.end}:${span.text}`, true);
  }

  for (const [parameter, value] of Object.entries(spec.resolvedParameters || {})) {
    const explicit = Object.hasOwn(spec.explicitParameters || {}, parameter);
    const defaultRecord = (spec.defaults || []).find(item => item.parameter === parameter);
    if (!explicit && !defaultRecord) continue;
    characteristics.push({ id: `decision:legacy:${parameter}`, property: legacyProperty(parameter),
      value: { kind: explicit ? 'legacy-parameter' : 'legacy-default', value: clone(value) }, selectorId: 'sel:family',
      origin: explicit ? 'explicit' : 'inferred', certainty: explicit ? 1 : 0.5,
      acceptance: explicit ? 'accepted' : 'default', capability: 'unknown', sourceIntentIds: [], dependencyIds: [],
      reason: defaultRecord?.reason || null });
  }

  for (const record of [...(spec.unsupported || []), ...(spec.approximations || [])]) {
    const key = `${record.sourceSpan?.start}:${record.sourceSpan?.end}:${record.sourceSpan?.text}`;
    if (!record.sourceSpan || !spanOwners.has(key)) {
      warnings.push({ code: 'legacy-record-preserved', message: 'A v1 unsupported/approximation record was retained verbatim because it had no one-to-one intent mapping.' });
      intents.push({ id: `intent:unmapped-${intents.length + 1}`, kind: 'characteristic', subject: { scope: 'family', selectorId: 'sel:family' },
        predicate: record.concept || 'legacy.unmapped', value: { raw: clone(record) },
        source: sourceSpan(record.sourceSpan), origin: 'explicit', confidence: 0,
        resolution: { status: 'unresolved', capability: 'unknown', reason: 'Preserved from a v1 aggregate record without a direct span mapping.' }, supersedes: [], conflicts: [] });
    }
  }

  const glyphModel = spec.glyphInstructions;
  const glyphConflicts = clone(glyphModel.conflicts || []);
  for (const instruction of glyphModel.instructions) {
    const targets = instruction.target.glyphs.map((glyph, index) => ({ glyph, codePoint: instruction.target.codePoints[index] }));
    const selectorId = `sel:${instruction.id}`;
    const selector = makeExactSelector(selectorId, targets, registry);
    if (instruction.target.caseScope === 'ambiguous' || instruction.target.candidates?.length) {
      selector.resolution = { status: 'ambiguous', includedGlyphIds: [], excludedGlyphIds: [], unclassifiedGlyphIds: [],
        reason: `The v1 target is ambiguous between ${instruction.target.candidates.join(', ') || instruction.target.text || 'multiple glyphs'}.` };
    }
    selector.registryRevisionId = revisionId;
    selectors.push(selector);
    const intentId = `intent:${instruction.id}`;
    const origin = instruction.origin === 'inferred' ? 'inferred' : 'explicit';
    intents.push({ id: intentId, kind: instruction.kind === 'substitution' ? 'substitution' : instruction.kind === 'exception' ? 'preservation' : 'construction',
      subject: { scope: instruction.target.glyphs.length === 1 ? 'glyph' : 'class', selectorId },
      predicate: instruction.operation.type, value: { parameters: clone(instruction.operation.parameters), target: {
        text: instruction.target.text, glyphs: clone(instruction.target.glyphs), codePoints: clone(instruction.target.codePoints),
        caseScope: instruction.target.caseScope, candidates: clone(instruction.target.candidates || [])
      } },
      source: sourceSpan(instruction.sourceSpan), origin, confidence: instruction.confidence,
      resolution: { status: instruction.resolution.status === 'resolved' && selector.resolution.status === 'resolved' ? 'resolved' : instruction.resolution.status,
        capability: mapCapability(instruction.capability), reason: instruction.resolution.reason || selector.resolution.reason || null },
      supersedes: [], conflicts: clone(instruction.conflicts || []) });
    const type = instruction.operation.type === 'replace-outline' ? 'substitute.glyph'
      : instruction.operation.type === 'preserve-outline' ? 'glyph.preserve' : instruction.operation.type;
    operations.push({ id: `op:${instruction.id}`, type, selectorId, parameters: clone(instruction.operation.parameters), phase: 'geometry', dependsOn: [],
      preconditions: type === 'substitute.glyph' ? ['target-glyph-exists'] : [],
      postconditions: type === 'substitute.glyph' ? ['outline-valid', 'unicode-mapping-preserved', 'metrics-valid'] : [],
      metricPolicy: { advance: 'preserve', bearings: 'recompute-from-bounds', kerning: 'invalidate-for-review' },
      provenance: { intentIds: [intentId], acceptedDecisionIds: [] }, capability: mapCapability(instruction.capability),
      resolution: { status: ['unsupported', 'conflict', 'ambiguous'].includes(instruction.resolution.status) ? instruction.resolution.status
        : selector.resolution.status === 'resolved' ? instruction.resolution.status : selector.resolution.status,
        reason: selector.resolution.reason || instruction.resolution.reason || null },
      conflicts: clone(instruction.conflicts || []), exceptions: instruction.kind === 'exception' ? selector.resolution.includedGlyphIds : [] });
  }
  if (glyphConflicts.length) warnings.push({ code: 'v1-glyph-conflicts-preserved', conflicts: glyphConflicts });

  const accepted = {
    id: revisionId, parentRevisionIds: [], status: 'accepted', decisionIds: characteristics.filter(x => x.acceptance === 'accepted').map(x => x.id),
    operationIds: [], deltaOperationIds: []
  };
  const model = {
    type: DESIGN_TYPE, schemaVersion: DESIGN_VERSION, designId: `design:${digest({ brief: sourceText, revisionId }).slice(0, 16)}`,
    family: { name: family.metadata.family, unitsPerEm: family.metrics.unitsPerEm },
    input: { brief: sourceText, language: spec.source.language || 'en', messages: [{ id: 'msg:1', text: sourceText }] },
    intent: { statements: intents }, state: { characteristics, constraints: [], decisions: accepted.decisionIds },
    glyphRegistry: { revisionId, glyphs: registry }, selectors, operations,
    conflicts: [...clone(spec.conflicts || []), ...glyphConflicts],
    revisions: { acceptedRevisionId: revisionId, headRevisionId: revisionId, items: [accepted] },
    geometry: { sourceRevisionId: revisionId, glyphOrder: [...family.glyphOrder], glyphHashes: Object.fromEntries(family.glyphOrder.map(id => [id, digest(family.glyphs[id])])) },
    adapter: { from: { type: spec.type, version: spec.version, glyphInstructionVersion: glyphModel.version }, warnings, legacySource: original, preservedUnknownRecords: {
      unsupported: clone(spec.unsupported || []), approximations: clone(spec.approximations || []), conflicts: clone(spec.conflicts || [])
    } }
  };
  const errors = validateV2Model(model);
  if (errors.length) throw new Error(`Adapted v2 model is invalid: ${errors.join(' ')}`);
  // Protect the adapter's read-only promise against accidental future mutation.
  if (JSON.stringify(spec) !== JSON.stringify(original)) throw new Error('The v1 adapter mutated its input.');
  return model;
}

export function validateV2Model(model) {
  const errors = [];
  if (model?.type !== DESIGN_TYPE || model.schemaVersion !== DESIGN_VERSION) errors.push('Unsupported v2 envelope.');
  if (!Array.isArray(model?.intent?.statements) || !Array.isArray(model?.operations) || !Array.isArray(model?.selectors)) errors.push('Missing intent, operation, or selector records.');
  const glyphIds = new Set((model.glyphRegistry?.glyphs || []).map(g => g.id));
  const selectorIds = new Set((model.selectors || []).map(s => s.id));
  const operationIds = new Set((model.operations || []).map(op => op.id));
  if (glyphIds.size !== (model.glyphRegistry?.glyphs || []).length) errors.push('Duplicate glyph identity in registry.');
  if (selectorIds.size !== (model.selectors || []).length) errors.push('Duplicate selector identity.');
  if (operationIds.size !== (model.operations || []).length) errors.push('Duplicate operation identity.');
  for (const selector of model.selectors || []) {
    if (!selector.universe || !selector.expression || !['resolved', 'empty', 'unresolved', 'ambiguous'].includes(selector.resolution?.status)) errors.push(`Malformed selector ${selector.id}.`);
    for (const id of [...(selector.resolution?.includedGlyphIds || []), ...(selector.resolution?.excludedGlyphIds || [])]) if (!glyphIds.has(id)) errors.push(`Selector ${selector.id} refers to missing glyph ${id}.`);
  }
  for (const op of model.operations || []) {
    if (!op.id || !op.type || !selectorIds.has(op.selectorId) || !op.provenance?.intentIds?.length) errors.push(`Malformed operation ${op.id || '(missing id)'}.`);
    for (const dependency of op.dependsOn || []) if (!operationIds.has(dependency)) errors.push(`Operation ${op.id} has missing dependency ${dependency}.`);
  }
  return errors;
}

function predicateMatches(predicate, glyph) {
  const classes = new Set(glyph.classes || []);
  switch (predicate.op) {
    case 'glyph-registry': return true;
    case 'glyph-id': return glyph.id === predicate.value;
    case 'unicode': return glyph.unicodes.includes(predicate.value);
    case 'class': return classes.has(predicate.value);
    case 'all': return predicate.args.every(child => predicateMatches(child, glyph));
    case 'any': return predicate.args.some(child => predicateMatches(child, glyph));
    case 'not': return !predicateMatches(predicate.arg, glyph);
    default: return false;
  }
}

function unknownSelectorReferences(predicate, registry) {
  if (!predicate || typeof predicate !== 'object') return [];
  if (predicate.op === 'glyph-id' && !registry.some(g => g.id === predicate.value)) return [`Unknown glyph ID ${predicate.value}.`];
  if (predicate.op === 'unicode' && !registry.some(g => g.unicodes.includes(predicate.value))) return [`No glyph maps U+${Number(predicate.value).toString(16).toUpperCase()}.`];
  if (predicate.op === 'class' && !['letter', 'uppercase', 'lowercase', 'punctuation', 'spacing', 'mark', 'combining', 'notdef'].includes(predicate.value)) return [`Unknown glyph class ${predicate.value}.`];
  return [ ...(predicate.args || []).flatMap(x => unknownSelectorReferences(x, registry)), ...unknownSelectorReferences(predicate.arg, registry) ];
}

function ambiguousSelectorReferences(predicate, registry) {
  if (!predicate || typeof predicate !== 'object') return [];
  if (predicate.op === 'unicode' && registry.filter(glyph => glyph.unicodes.includes(predicate.value)).length > 1)
    return [`Unicode U+${Number(predicate.value).toString(16).toUpperCase()} maps to multiple glyph identities.`];
  return [ ...(predicate.args || []).flatMap(x => ambiguousSelectorReferences(x, registry)), ...ambiguousSelectorReferences(predicate.arg, registry) ];
}

export function resolveSelector(selector, registry, { registryRevisionId = null } = {}) {
  if (selector.universe === 'glyph-registry-at-revision' && registryRevisionId && selector.registryRevisionId && selector.registryRevisionId !== registryRevisionId) {
    return { status: 'unresolved', includedGlyphIds: [], excludedGlyphIds: [], reason: 'Selector universe revision does not match the supplied glyph registry.' };
  }
  const ambiguous = [ ...ambiguousSelectorReferences(selector.expression, registry), ...(selector.exclude || []).flatMap(x => ambiguousSelectorReferences(x, registry)) ];
  if (ambiguous.length) return { status: 'ambiguous', includedGlyphIds: [], excludedGlyphIds: [], reason: ambiguous };
  const unknown = [ ...unknownSelectorReferences(selector.expression, registry), ...(selector.exclude || []).flatMap(x => unknownSelectorReferences(x, registry)) ];
  if (unknown.length) return { status: 'unresolved', includedGlyphIds: [], excludedGlyphIds: [], reason: unknown };
  const matching = registry.filter(glyph => predicateMatches(selector.expression, glyph));
  const excluded = new Set((selector.exclude || []).flatMap(expr => registry.filter(glyph => predicateMatches(expr, glyph)).map(glyph => glyph.id)));
  const includedGlyphIds = matching.map(glyph => glyph.id).filter(id => !excluded.has(id)).sort();
  const excludedGlyphIds = matching.map(glyph => glyph.id).filter(id => excluded.has(id)).sort();
  return { status: includedGlyphIds.length ? 'resolved' : 'empty', includedGlyphIds, excludedGlyphIds, reason: includedGlyphIds.length ? null : 'Selector matched no glyphs.' };
}

function validateOperationHandlers(operationHandlers) {
  if (operationHandlers === undefined) return Object.freeze(Object.create(null));
  if (!operationHandlers || typeof operationHandlers !== 'object' || Array.isArray(operationHandlers))
    throw new TypeError('Operation handlers must be a plain map of operation types to functions.');
  const prototype = Object.getPrototypeOf(operationHandlers);
  if (prototype !== Object.prototype && prototype !== null)
    throw new TypeError('Operation handlers must be a plain map of operation types to functions.');
  const handlers = Object.create(null);
  for (const key of Reflect.ownKeys(operationHandlers)) {
    if (typeof key !== 'string') throw new TypeError('Operation handler keys must be operation type strings.');
    const descriptor = Object.getOwnPropertyDescriptor(operationHandlers, key);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'function')
      throw new TypeError(`Operation handler ${key || '(empty type)'} must be an enumerable data property containing a function.`);
    handlers[key] = descriptor.value;
  }
  return Object.freeze(handlers);
}

function validateRevisionPreconditions(operations, model) {
  for (const operation of operations) {
    const preconditions = operation.preconditions ?? [];
    if (!Array.isArray(preconditions)) throw new Error(`Operation ${operation.id} has malformed preconditions.`);
    for (const condition of preconditions) {
      if (condition && typeof condition === 'object' && condition.type === 'revision' && condition.id !== model.revisions.headRevisionId)
        throw new Error(`Operation ${operation.id} has a stale revision precondition.`);
    }
  }
}

function validateNoAcceptedOperationReplay(operations, model) {
  const acceptedOperationIds = new Set((model.revisions.items || [])
    .filter(revision => revision.status === 'accepted')
    .flatMap(revision => revision.operationIds || []));
  const replayed = operations.find(operation => acceptedOperationIds.has(operation.id));
  if (replayed) throw new Error(`Operation ${replayed.id} is already present in accepted revision history.`);
}

function dependencyOrder(operations) {
  const byId = new Map(operations.map(op => [op.id, op]));
  const indegree = new Map(operations.map(op => [op.id, 0]));
  const outgoing = new Map(operations.map(op => [op.id, []]));
  for (const op of operations) for (const dep of op.dependsOn || []) {
    if (!byId.has(dep)) throw new Error(`Operation ${op.id} has missing dependency ${dep}.`);
    indegree.set(op.id, indegree.get(op.id) + 1); outgoing.get(dep).push(op.id);
  }
  const ready = [...indegree].filter(([, count]) => count === 0).map(([id]) => id).sort();
  const result = [];
  while (ready.length) {
    const id = ready.shift(); result.push(byId.get(id));
    for (const next of outgoing.get(id).sort()) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) { ready.push(next); ready.sort(); }
    }
  }
  if (result.length !== operations.length) throw new Error('Operation dependency graph contains a cycle.');
  return result;
}

function isMutating(op) { return op.type !== 'glyph.preserve'; }
function hasDependencyPath(fromId, toId, operations) {
  const byId = new Map(operations.map(op => [op.id, op]));
  const visited = new Set();
  function walk(id) {
    if (id === toId) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    return (byId.get(id)?.dependsOn || []).some(walk);
  }
  return walk(fromId);
}

function validateOperationInteractions(operations, selected) {
  for (let i = 0; i < operations.length; i++) for (let j = i + 1; j < operations.length; j++) {
    const a = operations[i], b = operations[j];
    const overlap = selected.get(a.id).filter(id => selected.get(b.id).includes(id));
    if (!overlap.length) continue;
    if (!isMutating(a) || !isMutating(b)) throw new Error(`Operation conflict between ${a.id} and ${b.id} on ${overlap.join(', ')}: preservation overlaps a mutating operation.`);
    const ordered = hasDependencyPath(a.id, b.id, operations) || hasDependencyPath(b.id, a.id, operations);
    if (!ordered && (a.type === 'substitute.glyph' || b.type === 'substitute.glyph' || a.type.startsWith('geometry.') || b.type.startsWith('geometry.')))
      throw new Error(`Operation conflict between ${a.id} and ${b.id} on ${overlap.join(', ')}: non-commuting operations need an explicit dependency.`);
  }
}

function mapGlyphOperation(model, op, registry) {
  const selector = model.selectors.find(item => item.id === op.selectorId);
  if (!selector) throw new Error(`Operation ${op.id} references missing selector ${op.selectorId}.`);
  let result;
  if (selector.registryRevisionId && selector.registryRevisionId !== model.glyphRegistry.revisionId)
    throw new Error(`Selector ${selector.id} is stale for glyph registry revision ${model.glyphRegistry.revisionId}.`);
  if (selector.registryRevisionId === model.glyphRegistry.revisionId && selector.resolution?.status === 'resolved') {
    const memberIds = [...(selector.resolution.includedGlyphIds || []), ...(selector.resolution.excludedGlyphIds || [])];
    if (memberIds.some(id => !registry.some(glyph => glyph.id === id))) throw new Error(`Selector ${selector.id} snapshot references a glyph absent from revision ${selector.registryRevisionId}.`);
    result = clone(selector.resolution);
  } else {
    result = resolveSelector(selector, registry, { registryRevisionId: model.glyphRegistry.revisionId });
    selector.resolution = result;
    selector.registryRevisionId = model.glyphRegistry.revisionId;
  }
  if (op.capability === 'unsupported' || op.resolution.status === 'unsupported') throw new Error(`Operation ${op.id} is unsupported: ${op.resolution.reason || op.type}.`);
  if (!['resolved'].includes(op.resolution.status)) throw new Error(`Operation ${op.id} is unresolved: ${op.resolution.reason || op.resolution.status}.`);
  if (result.status !== 'resolved') throw new Error(`Operation ${op.id} selector ${selector.id} is ${result.status}: ${JSON.stringify(result.reason)}.`);
  return result.includedGlyphIds;
}

function translateContour(contour, dx, dy) {
  const move = p => ({ ...p, x: p.x + dx, y: p.y + dy });
  contour.start = move(contour.start);
  for (const segment of contour.segments) {
    segment.from = move(segment.from); segment.to = move(segment.to);
    if (segment.control) segment.control = move(segment.control);
  }
  contour.points = contour.points.map(move);
}

function reflectPositionData(value, advance) {
  if (Array.isArray(value)) return value.map(item => reflectPositionData(item, advance));
  if (!value || typeof value !== 'object') return value;
  const copy = { ...value };
  if (typeof copy.x === 'number') copy.x = advance - copy.x;
  for (const [key, child] of Object.entries(copy)) if (key !== 'x') copy[key] = reflectPositionData(child, advance);
  return copy;
}

function contourArea(contour) {
  const points = sampleContour(contour);
  let sum = 0;
  for (let i = 0; i < points.length; i++) sum += points[i].x * points[(i + 1) % points.length].y - points[(i + 1) % points.length].x * points[i].y;
  return sum / 2;
}

function rebuildContourPoints(contour) {
  const segments = contour.segments;
  const startPointId = contour.startPointId || `${contour.id}.start`;
  let previousEndpointId = startPointId;
  const nextSegments = segments.map(segment => {
    const fromPointId = segment.fromPointId || previousEndpointId;
    const closesAtStart = segment.to.x === contour.start.x && segment.to.y === contour.start.y;
    const toPointId = segment.toPointId || (closesAtStart ? startPointId : `${contour.id}.${segment.id}.end`);
    const controlPointId = segment.type === 'quadratic' ? segment.controlPointId || `${contour.id}.${segment.id}.control` : undefined;
    previousEndpointId = toPointId;
    return { ...segment, fromPointId, toPointId, ...(controlPointId ? { controlPointId } : {}) };
  });
  const points = [{ id: startPointId, ...contour.start, on: true }];
  for (const segment of nextSegments) {
    if (segment.type === 'quadratic') points.push({ id: segment.controlPointId, ...segment.control, on: false });
    if (segment.toPointId !== startPointId) points.push({ id: segment.toPointId, ...segment.to, on: true });
  }
  return { ...contour, startPointId, segments: nextSegments, points };
}

export function canonicalizeInitialGeometry(family) {
  const result = clone(family);
  for (const glyph of Object.values(result.glyphs)) glyph.contours = glyph.contours.map(rebuildContourPoints);
  return result;
}

function reverseContour(contour) {
  const segments = contour.segments;
  if (!segments.length) return contour;
  const last = segments.at(-1);
  const newStartPointId = last.toPointId || `${contour.id}.${last.id}.end`;
  const nextSegments = [...segments].reverse().map(segment => segment.type === 'quadratic'
    ? { ...segment, from: { ...segment.to }, to: { ...segment.from }, fromPointId: segment.toPointId, toPointId: segment.fromPointId, control: { ...segment.control } }
    : { ...segment, from: { ...segment.to }, to: { ...segment.from }, fromPointId: segment.toPointId, toPointId: segment.fromPointId });
  return rebuildContourPoints({ ...contour, start: { ...last.to }, startPointId: newStartPointId, segments: nextSegments });
}

function normalizeWinding(contour) {
  const area = contourArea(contour);
  const wrong = contour.role === 'outer' ? area > 0 : contour.role === 'counter' ? area < 0 : false;
  return wrong ? reverseContour(contour) : contour;
}

export function reflectGlyph(glyph) {
  const advance = glyph.metrics.advanceWidth;
  const contours = glyph.contours.map(contour => {
    const reflected = clone(contour);
    const reflectPoint = point => ({ ...point, x: advance - point.x });
    reflected.start = reflectPoint(reflected.start);
    reflected.points = reflected.points.map(reflectPoint);
    reflected.segments = reflected.segments.map(segment => ({ ...segment,
      from: reflectPoint(segment.from), to: reflectPoint(segment.to),
      ...(segment.control ? { control: reflectPoint(segment.control) } : {})
    }));
    return rebuildContourPoints(normalizeWinding(reflected));
  });
  glyph.contours = contours;
  if (glyph.anchors) glyph.anchors = reflectPositionData(glyph.anchors, advance);
  if (glyph.components) glyph.components = glyph.components.map(component => {
    const next = reflectPositionData(component, advance);
    if (component.transform && typeof component.transform === 'object') {
      const t = component.transform;
      next.transform = { ...t, xx: typeof t.xx === 'number' ? -t.xx : t.xx,
        xy: typeof t.xy === 'number' ? (t.xy === 0 ? 0 : -t.xy) : t.xy, dx: typeof t.dx === 'number' ? advance - t.dx : t.dx };
    }
    return next;
  });
  glyph.bounds = contourBounds(glyph.contours);
  glyph.metrics.leftSideBearing = glyph.contours.length ? glyph.bounds.xMin : glyph.metrics.leftSideBearing;
  glyph.metrics.rightSideBearing = glyph.contours.length ? advance - glyph.bounds.xMax : glyph.metrics.rightSideBearing;
}

function substituteHeart(glyph, family, operation) {
  if (operation.parameters.shape !== 'heart') throw new Error(`Operation ${operation.id} requests unsupported outline shape ${operation.parameters.shape}.`);
  const bounds = contourBounds(glyph.contours);
  const width = bounds.xMax - bounds.xMin;
  const height = glyph.anchors?.top || family.design.xHeight || (bounds.yMax - bounds.yMin);
  const contour = heartOutline(glyph, { width, height, weight: family.design.weight || 400 });
  translateContour(contour, bounds.xMin, bounds.yMin);
  glyph.contours = [contour];
  glyph.components = [{ id: `${glyph.id}.glyph-substitution-heart`, componentId: 'shape.heart', kind: 'glyph-substitution', contourId: contour.id }];
  glyph.substitution = { operationId: operation.id, shape: 'heart' };
  glyph.appliedOperations ||= [];
  glyph.appliedOperations.push(operation.id);
  glyph.bounds = contourBounds(glyph.contours);
  glyph.metrics.leftSideBearing = glyph.bounds.xMin;
  glyph.metrics.rightSideBearing = glyph.metrics.advanceWidth - glyph.bounds.xMax;
}

function glyphState(glyph) {
  return { contours: glyph.contours, metrics: glyph.metrics, anchors: glyph.anchors, components: glyph.components, substitution: glyph.substitution };
}

/** Execute a v2 operation transaction against an initial generated family. */
export function executeTransaction(model, family, { revisionLabel = 'v2-operation-transaction', operationHandlers = undefined } = {}) {
  const modelBefore = clone(model), familyBefore = clone(family);
  const errors = validateV2Model(model);
  if (errors.length) return { status: 'rejected', error: errors.join(' '), model, family, revision: null };
  try {
    const handlers = validateOperationHandlers(operationHandlers);
    const stagedModel = clone(model), stagedFamily = clone(family);
    validateNoAcceptedOperationReplay(stagedModel.operations, stagedModel);
    const registry = glyphRegistry(stagedFamily);
    const selected = new Map();
    for (const op of stagedModel.operations) selected.set(op.id, mapGlyphOperation(stagedModel, op, registry));
    validateRevisionPreconditions(stagedModel.operations, stagedModel);
    validateOperationInteractions(stagedModel.operations, selected);
    const order = dependencyOrder(stagedModel.operations);
    const targeted = new Set();
    for (const op of order) {
      const ids = selected.get(op.id);
      for (const id of ids) {
        targeted.add(id);
        const glyph = stagedFamily.glyphs[id];
        if (!glyph) throw new Error(`Operation ${op.id} resolved missing glyph ${id}.`);
        if (op.type === 'glyph.preserve') {
          glyph.preservedByOperations ||= [];
          glyph.preservedByOperations.push(op.id);
          continue;
        }
        if (op.type === 'substitute.glyph') substituteHeart(glyph, stagedFamily, op);
        else if (op.type === 'geometry.reflect') {
          reflectGlyph(glyph);
          glyph.appliedOperations ||= [];
          glyph.appliedOperations.push(op.id);
        }
        else if (Object.hasOwn(handlers, op.type)) {
          const result = handlers[op.type]({ model: stagedModel, family: stagedFamily, glyph, operation: freezeData(clone(op)) });
          if (result && typeof result.then === 'function') throw new Error(`Operation handler ${op.type} must be synchronous.`);
        }
        else throw new Error(`Operation ${op.id} has unsupported executor type ${op.type}.`);
        const geometryErrors = validateGlyph({ ...glyph, advanceWidth: glyph.metrics.advanceWidth, rightSideBearing: glyph.metrics.rightSideBearing });
        if (geometryErrors.length) throw new Error(`Operation ${op.id} produced invalid glyph ${glyph.name}: ${geometryErrors.join(' ')}`);
      }
      op.resolution = { status: 'resolved', reason: null, selectedGlyphIds: [...ids] };
    }
    const beforeById = familyBefore.glyphs;
    const changedGlyphIds = stagedFamily.glyphOrder.filter(id => digest(glyphState(beforeById[id])) !== digest(glyphState(stagedFamily.glyphs[id])));
    const preservedGlyphIds = stagedFamily.glyphOrder.filter(id => !changedGlyphIds.includes(id));
    const targetedGlyphIds = [...targeted].sort();
    const operationIds = order.map(op => op.id);
    const revisionContent = {
      contract: 'lfcfoundry.universal-typeface-revision-content-v1',
      designId: stagedModel.designId,
      baseRevisionId: model.revisions.headRevisionId,
      glyphRegistryRevisionId: stagedModel.glyphRegistry.revisionId,
      operations: order.map(operation => operation),
      intent: stagedModel.intent,
      state: stagedModel.state,
      conflicts: stagedModel.conflicts ?? [],
      glyphRegistry: stagedModel.glyphRegistry,
      selectors: stagedModel.selectors,
      constructionIntegration: stagedModel.constructionIntegration ?? null,
      family: {
        glyphOrder: [...stagedFamily.glyphOrder],
        metrics: stagedFamily.metrics ?? null,
        design: stagedFamily.design ?? null,
        spacing: stagedFamily.spacing ?? null,
        glyphs: stagedFamily.glyphOrder.map(id => stagedFamily.glyphs[id])
      },
      changedGlyphIds
    };
    const newRevisionId = `rev:${contentDigest(revisionContent).slice(0, 16)}`;
    const baseRevisionId = model.revisions.headRevisionId;
    stagedModel.revisions.items.push({ id: newRevisionId, parentRevisionIds: [baseRevisionId], status: 'candidate',
      decisionIds: [...stagedModel.state.decisions], operationIds, deltaOperationIds: operationIds,
      changedGlyphIds, preservedGlyphIds, targetedGlyphIds, invalidated: [...new Set(order.flatMap(op => op.metricPolicy?.kerning === 'invalidate-for-review' ? ['kerning'] : []))] });
    stagedModel.revisions.headRevisionId = newRevisionId;
    stagedModel.geometry = { ...stagedModel.geometry, sourceRevisionId: newRevisionId,
      glyphOrder: [...stagedFamily.glyphOrder], glyphHashes: Object.fromEntries(stagedFamily.glyphOrder.map(id => [id, digest(glyphState(stagedFamily.glyphs[id]))])) };
    stagedModel.derived = { ...(stagedModel.derived || {}), latestDiff: { changedGlyphIds, preservedGlyphIds, targetedGlyphIds, operationIds,
      changedMetrics: changedGlyphIds.filter(id => digest(beforeById[id].metrics) !== digest(stagedFamily.glyphs[id].metrics)),
      invalidated: stagedModel.revisions.items.at(-1).invalidated } };
    if (JSON.stringify(model) !== JSON.stringify(modelBefore) || JSON.stringify(family) !== JSON.stringify(familyBefore)) throw new Error('Transaction mutated its accepted input.');
    return { status: 'committed-candidate', model: stagedModel, family: stagedFamily, revision: stagedModel.revisions.items.at(-1), order: operationIds };
  } catch (error) {
    return { status: 'rejected', error: error.message, model, family, revision: null };
  }
}

function resolveClass(glyph, value) { return glyph.classes.includes(value); }

/** Add the deliberately limited reflection grammar used by this experiment. */
export function addReflectionInstruction(model, brief) {
  const match = /\b(?:mirror|reflect)\s+(?:every|all)\s+(?:(lowercase|uppercase)\s+)?(letters?|glyphs?)\b(?:\s+except\s+([^.;!?]+))?/iu.exec(brief);
  if (!match) return { model, status: 'not-recognized', reason: 'No supported reflection construction was found.' };
  const next = clone(model), scope = match[1]?.toLowerCase() || match[2].toLowerCase();
  const domain = scope === 'lowercase' ? 'lowercase' : scope === 'uppercase' ? 'uppercase' : match[2].toLowerCase().startsWith('letter') ? 'letter' : 'glyph-universe';
  const registry = next.glyphRegistry.glyphs;
  const exclusions = [...(match[3]?.matchAll(/(?:^|\b)([\p{L}])(?:\b|$)/gu) || [])].map(item => item[1]);
  const excludedTargets = exclusions.map(ch => registry.filter(glyph => glyph.name === ch || glyph.character === ch));
  if (excludedTargets.some(items => items.length !== 1)) return { model: next, status: 'unresolved', reason: 'An exclusion does not map to exactly one registered glyph.' };
  const selectorId = `sel:reflect-${domain}-${match.index}`;
  const expression = domain === 'glyph-universe' ? { op: 'glyph-registry' } : { op: 'class', value: domain };
  const selector = { id: selectorId, universe: 'glyph-registry-at-revision', registryRevisionId: next.glyphRegistry.revisionId,
    expression, exclude: excludedTargets.map(items => ({ op: 'glyph-id', value: items[0].id })),
    resolution: { status: 'unresolved', includedGlyphIds: [], excludedGlyphIds: [], unclassifiedGlyphIds: [], reason: 'Membership is resolved at transaction time.' } };
  next.selectors.push(selector);
  const source = sourceRecord(brief, match.index, match.index + match[0].length);
  const intentId = `intent:reflect-${match.index}`;
  next.intent.statements.push({ id: intentId, kind: 'transformation', subject: { scope: domain === 'glyph-universe' ? 'family' : 'class', selectorId },
    predicate: 'outline.reflect', value: { axis: 'horizontal', domain, exclusions }, source, origin: 'explicit', confidence: 0.98,
    resolution: { status: 'resolved', capability: 'implemented', reason: null }, supersedes: [], conflicts: [] });
  const id = `op:reflect-${domain}-${match.index}`;
  const preceding = next.operations.filter(op => op.type !== 'glyph.preserve' && op.resolution.status === 'resolved');
  const dependsOn = /\bthen\b/iu.test(brief.slice(0, match.index)) ? preceding.filter(op => {
    const oldSelector = next.selectors.find(item => item.id === op.selectorId);
    return oldSelector?.resolution?.includedGlyphIds?.some(glyphId => !excludedTargets.some(items => items[0].id === glyphId));
  }).map(op => op.id) : [];
  next.operations.push({ id, type: 'geometry.reflect', selectorId, parameters: { axis: 'x', origin: { kind: 'advance-midpoint' } },
    phase: 'geometry', dependsOn, preconditions: ['outline-valid'], postconditions: ['outline-valid', 'contour-winding-normalized', 'bounds-recomputed', 'metrics-recomputed'],
    metricPolicy: { advance: 'preserve', bearings: 'recompute-from-bounds', kerning: 'invalidate-for-review', anchors: 'reflect-x' },
    provenance: { intentIds: [intentId], acceptedDecisionIds: [] }, capability: 'implemented', resolution: { status: 'resolved', reason: null }, conflicts: [], exceptions: excludedTargets.map(items => items[0].id) });
  if (validateV2Model(next).length) return { model: next, status: 'invalid', reason: validateV2Model(next).join(' ') };
  return { model: next, status: 'resolved', operationId: id };
}

export function augmentTestInventory(family) {
  const result = clone(family);
  if (!result.glyphOrder.some(id => result.glyphs[id].name === '.notdef')) {
    const id = 'fixture-notdef';
    result.glyphs[id] = { id, character: null, name: '.notdef', unicode: null, recipeId: 'integration-fixture-notdef',
      contours: [rectContour(`${id}.outer`, 35, 0, 565, 700, 'outer'), rectContour(`${id}.counter`, 95, 70, 505, 630, 'counter')],
      components: [], anchors: {}, bounds: { xMin: 35, yMin: 0, xMax: 565, yMax: 700 },
      metrics: { advanceWidth: 620, leftSideBearing: 35, rightSideBearing: 55 } };
    result.glyphOrder.unshift(id);
  }
  const makeAlias = (sourceId, character) => {
    const source = result.glyphs[sourceId];
    const id = `fixture-u${character.codePointAt(0).toString(16).padStart(4, '0')}`;
    const alias = clone(source), oldId = source.id;
    const replace = value => {
      if (typeof value === 'string') return value.replaceAll(oldId, id);
      if (Array.isArray(value)) return value.map(replace);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replace(child)]));
      return value;
    };
    const stable = replace(alias);
    stable.id = id; stable.character = character; stable.name = character; stable.unicode = character.codePointAt(0); stable.recipeId = 'integration-fixture-alias';
    result.glyphs[id] = stable; result.glyphOrder.push(id);
  };
  if (!result.glyphOrder.some(id => result.glyphs[id].character === 'b')) makeAlias('u0061', 'b');
  if (!result.glyphOrder.some(id => result.glyphs[id].character === 'd')) makeAlias('u0067', 'd');
  if (!result.glyphOrder.some(id => result.glyphs[id].character === ',')) {
    const id = 'fixture-u002c', contour = {
      ...clone(result.glyphs.u0065.contours[0]), id: `${id}.comma`, role: 'outer'
    };
    // A small, valid fixture mark: its design is irrelevant to operation scope.
    const x0 = 120, y0 = 0, x1 = 165, y1 = 95;
    contour.start = { x: x0, y: y0 };
    contour.segments = [
      { id: 'edge-1', type: 'line', from: { x: x0, y: y0 }, to: { x: x0, y: y1 } },
      { id: 'edge-2', type: 'line', from: { x: x0, y: y1 }, to: { x: x1, y: y1 } },
      { id: 'edge-3', type: 'line', from: { x: x1, y: y1 }, to: { x: x1, y: y0 } },
      { id: 'edge-4', type: 'line', from: { x: x1, y: y0 }, to: { x: x0, y: y0 } }
    ];
    contour.points = [{ id: `${id}.p0`, x: x0, y: y0, on: true }, { id: `${id}.p1`, x: x0, y: y1, on: true }, { id: `${id}.p2`, x: x1, y: y1, on: true }, { id: `${id}.p3`, x: x1, y: y0, on: true }];
    result.glyphs[id] = { id, character: ',', name: 'comma', unicode: 44, recipeId: 'integration-fixture-punctuation', contours: [contour], components: [], anchors: {}, bounds: { xMin: x0, yMin: y0, xMax: x1, yMax: y1 }, metrics: { advanceWidth: 240, leftSideBearing: x0, rightSideBearing: 75 } };
    result.glyphOrder.push(id);
  }
  if (!result.glyphOrder.some(id => result.glyphs[id].character === ' ')) {
    const id = 'fixture-u0020';
    result.glyphs[id] = { id, character: ' ', name: 'space', unicode: 32, recipeId: 'integration-fixture-space', contours: [], components: [], anchors: {}, bounds: { xMin: 0, yMin: 0, xMax: 0, yMax: 0 }, metrics: { advanceWidth: 300, leftSideBearing: 0, rightSideBearing: 300 } };
    result.glyphOrder.push(id);
  }
  result.spacing = { ...(result.spacing || {}), classes: { ...(result.spacing?.classes || {}), lowercase: [...new Set([...(result.spacing?.classes?.lowercase || []), 'b', 'd'])] } };
  return canonicalizeInitialGeometry(result);
}

export function geometryFingerprint(glyph) { return digest(glyphState(glyph)); }

export function resolveExplicitSelector(expression, registry, exclusions = []) {
  return resolveSelector({ id: 'sel:ad-hoc', universe: 'glyph-registry-at-revision', expression, exclude: exclusions, resolution: {} }, registry);
}

export function isClass(glyph, name) { return resolveClass(glyph, name); }

