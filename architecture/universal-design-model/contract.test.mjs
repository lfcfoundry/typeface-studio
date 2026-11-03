import test from 'node:test';
import assert from 'node:assert/strict';
import { examples, referenceAndReflection, lowercaseHeartUppercasePreserved, independentCharacteristicCombination, lowercaseReflectionWithExceptions, followupCandidate } from './fixtures.mjs';

const statuses = new Set(['resolved', 'deferred', 'needs-clarification', 'needs-user-decision', 'conflict', 'unsupported']);

function uniqueBy(items, field, label, errors) {
  const seen = new Set();
  for (const item of items) {
    if (!item?.[field] || seen.has(item[field])) errors.push(`${label} has a missing or duplicate ${field}.`);
    seen.add(item?.[field]);
  }
}

function validateDesign(model) {
  const errors = [];
  if (model?.type !== 'lfcfoundry.universal-typeface-design' || model.schemaVersion !== 2) errors.push('Unsupported model envelope.');
  if (!model.designId || typeof model.input?.brief !== 'string' || !Number.isInteger(model.family?.unitsPerEm)) errors.push('Missing design identity, original brief, or units per em.');
  const glyphs = model.glyphRegistry?.glyphs || [];
  const glyphIds = new Set(glyphs.map(item => item.id));
  uniqueBy(glyphs, 'id', 'Glyph registry', errors);
  uniqueBy(model.intent?.statements || [], 'id', 'Intent', errors);
  uniqueBy(model.selectors || [], 'id', 'Selector registry', errors);
  uniqueBy(model.operations || [], 'id', 'Operation graph', errors);
  for (const statement of model.intent?.statements || []) {
    const { source, resolution } = statement;
    const message = model.input.messages?.find(item => item.id === source?.messageId);
    if (!source || !message || !Number.isInteger(source.start) || !Number.isInteger(source.end) || source.start < 0 || source.end < source.start || message.text.slice(source.start, source.end) !== source.text) errors.push(`Invalid source span on ${statement.id}.`);
    if (!statement.kind || !statement.predicate || !['explicit', 'inferred'].includes(statement.origin) || !(statement.confidence >= 0 && statement.confidence <= 1)) errors.push(`Malformed intent ${statement.id}.`);
    if (!statuses.has(resolution?.status) || !resolution?.capability) errors.push(`Missing resolution/capability on ${statement.id}.`);
  }
  const selectors = new Map((model.selectors || []).map(item => [item.id, item]));
  for (const item of selectors.values()) {
    if (!item.universe || !item.expression || !statuses.has(item.resolution?.status)) errors.push(`Malformed selector ${item.id}.`);
    const included = item.resolution?.includedGlyphIds || [], excluded = item.resolution?.excludedGlyphIds || [];
    if (item.resolution?.status === 'resolved' && [...included, ...excluded].some(id => !glyphIds.has(id))) errors.push(`Resolved selector ${item.id} references a glyph outside its registry.`);
    if (included.some(id => excluded.includes(id))) errors.push(`Selector ${item.id} both includes and excludes a glyph.`);
  }
  const ops = new Map((model.operations || []).map(item => [item.id, item]));
  for (const item of ops.values()) {
    if (!item.type || !selectors.has(item.selectorId) || !Array.isArray(item.dependsOn) || !statuses.has(item.resolution?.status) || !item.provenance?.intentIds?.length) errors.push(`Malformed operation ${item.id}.`);
    if (item.resolution?.status === 'resolved' && selectors.get(item.selectorId)?.resolution?.status !== 'resolved') errors.push(`Resolved operation ${item.id} has an unresolved selector.`);
    for (const id of item.dependsOn || []) if (!ops.has(id) && !model.revisions.items.some(rev => rev.operationIds?.includes(id))) errors.push(`Operation ${item.id} has missing dependency ${id}.`);
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visiting.has(id)) { errors.push(`Operation dependency cycle at ${id}.`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of ops.get(id)?.dependsOn || []) if (ops.has(dependency)) visit(dependency);
    visiting.delete(id); visited.add(id);
  }
  for (const id of ops.keys()) visit(id);
  const revisions = model.revisions?.items || [];
  uniqueBy(revisions, 'id', 'Revision history', errors);
  const revisionIds = new Set(revisions.map(item => item.id));
  if (!revisionIds.has(model.revisions?.acceptedRevisionId) || !revisionIds.has(model.revisions?.headRevisionId)) errors.push('Accepted or head revision is missing.');
  for (const revision of revisions) {
    if (!['accepted', 'candidate', 'superseded'].includes(revision.status)) errors.push(`Invalid revision status on ${revision.id}.`);
    for (const parent of revision.parentRevisionIds || []) if (!revisionIds.has(parent)) errors.push(`Revision ${revision.id} has missing parent ${parent}.`);
  }
  return errors;
}

test('all five schema-v2 examples are structurally valid and reference-consistent', () => {
  for (const example of examples) assert.deepEqual(validateDesign(example), [], example.designId);
});

test('reference style, resolved characteristic, and global reflection are distinct records', () => {
  const [reference, serif, transform] = referenceAndReflection.intent.statements;
  assert.equal(reference.kind, 'style-reference');
  assert.equal(reference.value.useAsOutlineTemplate, false);
  assert.equal(serif.kind, 'characteristic');
  assert.equal(transform.kind, 'transformation');
  assert.equal(referenceAndReflection.operations[0].selectorId, 'sel:all-glyphs');
  assert.deepEqual(referenceAndReflection.selectors[0].resolution.includedGlyphIds, referenceAndReflection.glyphRegistry.glyphs.map(g => g.id));
  assert.equal(referenceAndReflection.operations[0].metricPolicy.advance, 'preserve');
  assert.equal(referenceAndReflection.operations[0].metricPolicy.kerning, 'invalidate-for-review');
});

test('lowercase heart substitution preserves uppercase O and unrelated glyph scope', () => {
  const sub = lowercaseHeartUppercasePreserved.operations[0];
  assert.equal(sub.type, 'substitute.glyph');
  assert.deepEqual(lowercaseHeartUppercasePreserved.selectors[0].resolution.includedGlyphIds, ['glyph:o']);
  assert.deepEqual(lowercaseHeartUppercasePreserved.selectors[1].resolution.includedGlyphIds, ['glyph:O']);
  assert.deepEqual(sub.parameters, { operation: 'replace-outline', shape: 'heart', preserveUnicode: true });
  assert.ok(lowercaseHeartUppercasePreserved.glyphRegistry.glyphs.some(g => g.id === 'glyph:o' && g.unicodes.includes(0x006f)));
});

test('independent design traits do not require a mutually exclusive family selector', () => {
  const properties = new Set(independentCharacteristicCombination.state.characteristics.map(item => item.property));
  for (const property of ['construction.humanist', 'construction.serif', 'serif.form', 'spacing.model', 'counter.topology', 'terminal.connectivity']) assert.ok(properties.has(property), property);
  assert.equal(independentCharacteristicCombination.state.characteristics.find(item => item.property === 'spacing.model').capability, 'implemented');
  assert.ok(independentCharacteristicCombination.operations.some(item => item.resolution.status === 'deferred'));
  assert.equal(independentCharacteristicCombination.state.characteristics.find(item => item.property === 'counter.topology').acceptance, 'candidate');
});

test('lowercase selector exclusions are stable and operation dependencies are explicit', () => {
  const selected = lowercaseReflectionWithExceptions.selectors[0].resolution;
  assert.deepEqual(selected.includedGlyphIds, ['glyph:a', 'glyph:o']);
  assert.deepEqual(selected.excludedGlyphIds, ['glyph:b', 'glyph:d']);
  assert.deepEqual(lowercaseReflectionWithExceptions.operations[0].exceptions, ['glyph:b', 'glyph:d']);
  assert.deepEqual(lowercaseReflectionWithExceptions.derived.latestDiff.changedGlyphIds, ['glyph:a', 'glyph:o']);
  for (const id of ['glyph:b', 'glyph:d', 'glyph:A', 'glyph:space']) assert.ok(lowercaseReflectionWithExceptions.derived.latestDiff.unchangedGlyphIds.includes(id));
});

test('follow-up candidate branches from accepted state and records preserved decisions and narrow diff', () => {
  const [accepted, candidate] = followupCandidate.revisions.items;
  assert.equal(followupCandidate.revisions.acceptedRevisionId, accepted.id);
  assert.equal(candidate.status, 'candidate');
  assert.deepEqual(candidate.parentRevisionIds, [accepted.id]);
  assert.deepEqual(candidate.preservedDecisionIds, ['decision:heart-o', 'decision:spacing', 'decision:weight']);
  assert.deepEqual(followupCandidate.derived.latestDiff.changedGlyphIds, ['glyph:A', 'glyph:O']);
  assert.ok(followupCandidate.derived.latestDiff.unchangedGlyphIds.includes('glyph:o'));
});

test('contract validation rejects ambiguous resolved selectors and cyclic operation dependencies', () => {
  const bad = structuredClone(lowercaseHeartUppercasePreserved);
  bad.selectors[0].resolution.includedGlyphIds.push('glyph:missing');
  assert.ok(validateDesign(bad).some(message => /outside its registry/u.test(message)));

  const cyclic = structuredClone(followupCandidate);
  cyclic.operations[0].dependsOn = ['op:narrow-caps'];
  cyclic.operations[1].dependsOn.push('op:heart-o');
  assert.ok(validateDesign(cyclic).some(message => /cycle/u.test(message)));
});

