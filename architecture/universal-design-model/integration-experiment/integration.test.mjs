import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretBrief } from '../../../prototype/src/brief.js';
import { compileTypeface } from '../../../prototype/src/font.js';
import { auditSfnt } from '../../../prototype/src/sfnt-audit.js';
import { validateGlyph } from '../../../prototype/src/contours.js';
import { contourPathData, glyphSvg } from '../../../prototype/src/glyph-svg.js';
import {
  adaptV1Spec, addReflectionInstruction, augmentTestInventory, canonicalizeInitialGeometry, executeTransaction,
  geometryFingerprint, resolveExplicitSelector, validateV2Model
} from './engine.mjs';
import { generateContourFamily } from '../../../prototype/src/recipes.js';
import { generateInitialGeometry, prepareCompositionScenario, prepareHeartScenario, prepareReflectionScenario, prepareRollbackScenario } from './scenarios.mjs';

const glyphFor = (family, character) => Object.values(family.glyphs).find(glyph => glyph.character === character);
const parsedFor = (font, character) => font.parsed.glyphs[character === ',' ? 'comma' : character === ' ' ? 'space' : character];
const outline = glyph => JSON.stringify(glyph.contours.map(contour => contour.points.map(({ x, y, on }) => ({ x, y, on }))));
const ttfEquivalentPoints = points => {
  const output = [];
  for (let i = 0; i < points.length; i++) {
    const previous = points[(i + points.length - 1) % points.length], current = points[i], next = points[(i + 1) % points.length];
    const implied = current.on && previous.on === false && next.on === false && current.x === (previous.x + next.x) / 2 && current.y === (previous.y + next.y) / 2;
    if (!implied) output.push({ x: current.x, y: current.y, on: current.on });
  }
  return output;
};
const ttfComparableOutline = glyph => JSON.stringify(glyph.contours.map(contour => ttfEquivalentPoints(contour.points)));
function makeFamilyAndModel(brief, system = 'humanist') {
  const spec = interpretBrief(brief), generatorInput = structuredClone(spec);
  generatorInput.glyphInstructions = { version: spec.glyphInstructions.version, instructions: [], conflicts: [], unsupported: [], unresolved: [] };
  const initial = generateContourFamily(generatorInput, { system });
  const family = augmentTestInventory(canonicalizeInitialGeometry(initial));
  return { spec, family, model: adaptV1Spec(spec, family) };
}

function mapGlyphIndex(audit, unicode) { return audit.cmap.glyphIndex(unicode); }
function fontMetric(compiled, unicode) {
  const audit = auditSfnt(compiled.bytes), index = mapGlyphIndex(audit, unicode);
  return { index, ...audit.horizontalMetrics.metrics[index] };
}

test('v1 adapter is deterministic, read-only, and preserves heart semantics and source offsets', () => {
  const brief = 'A humanist sans-serif. Make lowercase o heart-shaped; keep uppercase O normal.';
  const spec = interpretBrief(brief), { family } = makeFamilyAndModel(brief);
  const before = JSON.stringify(spec), first = adaptV1Spec(spec, family), second = adaptV1Spec(spec, family);
  assert.equal(JSON.stringify(spec), before);
  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, 2);
  const heart = first.operations.find(op => op.type === 'substitute.glyph');
  const selector = first.selectors.find(item => item.id === heart.selectorId);
  assert.deepEqual(selector.resolution.includedGlyphIds, ['u006f']);
  assert.deepEqual(selector.expression.args, [{ op: 'glyph-id', value: 'u006f' }]);
  assert.ok(first.glyphRegistry.glyphs.find(glyph => glyph.id === 'u006f').unicodes.includes(0x006f));
  const intent = first.intent.statements.find(item => item.id === heart.provenance.intentIds[0]);
  assert.equal(intent.source.messageId, 'msg:1');
  assert.equal(brief.slice(intent.source.start, intent.source.end), 'Make lowercase o heart-shaped');
  assert.equal(intent.origin, 'explicit');
  assert.equal(intent.confidence, 0.99);
  assert.equal(heart.parameters.shape, 'heart');
  assert.deepEqual(validateV2Model(first), []);
});

test('adapter retains unresolved, unsupported, conflict, and unknown v1 records instead of dropping them', () => {
  const brief = 'A humanist sans-serif. Make lowercase o star-shaped.';
  const { spec, family } = makeFamilyAndModel(brief);
  const adapted = adaptV1Spec(spec, family);
  const star = adapted.operations.find(op => op.parameters.shape === 'star');
  assert.ok(star);
  assert.equal(star.capability, 'unsupported');
  assert.equal(star.resolution.status, 'unsupported');
  assert.ok(adapted.adapter.preservedUnknownRecords);
  const ambiguous = interpretBrief('A humanist sans-serif. Make the glyph heart-shaped.');
  const ambiguousFamily = makeFamilyAndModel('A humanist sans-serif.').family;
  const ambiguousModel = adaptV1Spec(ambiguous, ambiguousFamily);
  assert.equal(ambiguousModel.operations[0].resolution.status, 'ambiguous');
  assert.deepEqual(ambiguousModel.intent.statements.find(item => item.id === 'intent:glyph-instruction-1').value.target.candidates, ['O', 'o']);
  const conflictingBrief = 'A humanist sans-serif. Make lowercase o heart-shaped, then keep lowercase o normal.';
  const conflictingSpec = interpretBrief(conflictingBrief), conflictingFamily = makeFamilyAndModel('A humanist sans-serif.').family;
  const conflictingModel = adaptV1Spec(conflictingSpec, conflictingFamily);
  assert.ok(conflictingModel.operations.every(op => op.resolution.status === 'conflict'));
  assert.equal(conflictingModel.conflicts.length, 1);
});

test('selector resolver handles classes, the declared universe, IDs, Unicode, exclusions, empty and unknown targets', () => {
  const { family, model } = makeFamilyAndModel('A humanist sans-serif.');
  const registry = model.glyphRegistry.glyphs;
  const lower = resolveExplicitSelector({ op: 'class', value: 'lowercase' }, registry);
  assert.deepEqual(lower.includedGlyphIds.map(id => registry.find(g => g.id === id).character).sort(), ['a', 'b', 'd', 'e', 'g', 'n', 'o']);
  assert.ok(!lower.includedGlyphIds.some(id => ['space', ',', '.notdef'].includes(registry.find(g => g.id === id)?.name)));
  const withoutBD = resolveExplicitSelector({ op: 'class', value: 'lowercase' }, registry, [{ op: 'glyph-id', value: 'fixture-u0062' }, { op: 'glyph-id', value: 'fixture-u0064' }]);
  assert.ok(!withoutBD.includedGlyphIds.includes('fixture-u0062'));
  assert.deepEqual(withoutBD.excludedGlyphIds, ['fixture-u0062', 'fixture-u0064']);
  assert.equal(resolveExplicitSelector({ op: 'glyph-id', value: 'u006f' }, registry).includedGlyphIds[0], 'u006f');
  assert.equal(resolveExplicitSelector({ op: 'unicode', value: 0x006f }, registry).includedGlyphIds[0], 'u006f');
  assert.equal(resolveExplicitSelector({ op: 'glyph-registry' }, registry).includedGlyphIds.length, family.glyphOrder.length);
  assert.equal(resolveExplicitSelector({ op: 'class', value: 'uppercase' }, registry.filter(g => g.classes.includes('lowercase'))).status, 'empty');
  assert.equal(resolveExplicitSelector({ op: 'glyph-id', value: 'glyph:missing' }, registry).status, 'unresolved');
  assert.equal(resolveExplicitSelector({ op: 'class', value: 'unknown-font-class' }, registry).status, 'unresolved');
  assert.equal(resolveExplicitSelector({ op: 'class', value: 'lowercase' }, registry, [{ op: 'glyph-id', value: 'missing' }]).status, 'unresolved');
  const ambiguous = [...registry, { ...registry.find(g => g.id === 'u006f'), id: 'alternate:o', name: 'o.alt' }];
  assert.equal(resolveExplicitSelector({ op: 'unicode', value: 0x006f }, ambiguous).status, 'ambiguous');
});

test('reflection grammar builds class selectors with exclusions and preserves deterministic membership snapshots', () => {
  const { spec, family, model } = makeFamilyAndModel('A humanist sans-serif.');
  const brief = 'Mirror every lowercase letter except b and d; keep all other glyphs as they are.';
  const added = addReflectionInstruction(model, brief);
  assert.equal(added.status, 'resolved');
  const op = added.model.operations[0], selector = added.model.selectors.find(item => item.id === op.selectorId);
  assert.deepEqual(selector.exclude, [{ op: 'glyph-id', value: 'fixture-u0062' }, { op: 'glyph-id', value: 'fixture-u0064' }]);
  const first = executeTransaction(added.model, family);
  assert.equal(first.status, 'committed-candidate');
  assert.equal(first.model.revisions.acceptedRevisionId, added.model.revisions.acceptedRevisionId);
  assert.notEqual(first.model.revisions.headRevisionId, added.model.revisions.headRevisionId);
  assert.deepEqual(first.revision.targetedGlyphIds.map(id => first.family.glyphs[id].character).sort(), ['a', 'e', 'g', 'n', 'o']);
  const extended = structuredClone(family);
  const newLower = structuredClone(glyphFor(family, 'a'));
  newLower.id = 'fixture-u0063'; newLower.name = 'c'; newLower.character = 'c'; newLower.unicode = 0x63;
  extended.glyphs[newLower.id] = newLower; extended.glyphOrder.push(newLower.id);
  const replay = executeTransaction(first.model, extended);
  assert.equal(replay.status, 'committed-candidate');
  assert.ok(!replay.revision.targetedGlyphIds.includes('fixture-u0063'));
  assert.deepEqual(spec.source.brief, 'A humanist sans-serif.');
});

test('canonicalized contours derive ordered point records from the authoritative segment path', () => {
  const { family } = makeFamilyAndModel('A humanist sans-serif.');
  for (const glyph of Object.values(family.glyphs)) for (const contour of glyph.contours) {
    const points = new Map(contour.points.map(point => [point.id, point]));
    assert.ok(points.has(contour.startPointId), contour.id);
    for (const segment of contour.segments) {
      const from = points.get(segment.fromPointId), to = points.get(segment.toPointId);
      assert.deepEqual([from?.x, from?.y], [segment.from.x, segment.from.y], `${contour.id}:${segment.id}:from`);
      assert.deepEqual([to?.x, to?.y], [segment.to.x, segment.to.y], `${contour.id}:${segment.id}:to`);
      if (segment.type === 'quadratic') {
        const control = points.get(segment.controlPointId);
        assert.deepEqual([control?.x, control?.y, control?.on], [segment.control.x, segment.control.y, false], `${contour.id}:${segment.id}:control`);
      }
    }
  }
});

test('operation DAG orders composition, rejects cycles and detects non-commuting overlaps without dependencies', () => {
  const composition = prepareCompositionScenario();
  assert.equal(composition.execution.status, 'committed-candidate');
  assert.ok(composition.execution.order.indexOf('op:glyph-instruction-1') < composition.execution.order.findIndex(id => id.startsWith('op:reflect-')));
  const cyclic = structuredClone(composition.model);
  const heart = cyclic.operations.find(op => op.type === 'substitute.glyph'), reflection = cyclic.operations.find(op => op.type === 'geometry.reflect');
  heart.dependsOn = [reflection.id];
  assert.match(executeTransaction(cyclic, composition.family).error, /cycle/u);
  const unordered = structuredClone(composition.model);
  unordered.operations.find(op => op.type === 'geometry.reflect').dependsOn = [];
  assert.match(executeTransaction(unordered, composition.family).error, /non-commuting/u);
});

test('transaction rollback leaves accepted model and source geometry unchanged when a later operation fails', () => {
  const scenario = prepareRollbackScenario();
  const modelBefore = JSON.stringify(scenario.model), familyBefore = JSON.stringify(scenario.family);
  assert.equal(scenario.execution.status, 'rejected');
  assert.match(scenario.execution.error, /op:z-deliberately-unsupported/u);
  assert.match(scenario.execution.error, /unsupported executor type/u);
  assert.equal(scenario.execution.revision, null);
  assert.equal(JSON.stringify(scenario.model), modelBefore);
  assert.equal(JSON.stringify(scenario.family), familyBefore);
  assert.equal(scenario.model.revisions.headRevisionId, scenario.model.revisions.acceptedRevisionId);
});

test('Scenario 1: heart operation survives adaptation and compiles to Regular and Bold TTF', () => {
  for (const style of ['Regular', 'Bold']) {
    const scenario = prepareHeartScenario(style);
    assert.equal(scenario.execution.status, 'committed-candidate');
    const baseFont = compileTypeface(scenario.family, style);
    const resultFont = compileTypeface(scenario.execution.family, style);
    const audit = auditSfnt(resultFont.bytes);
    assert.equal(audit.valid, true);
    assert.equal(audit.metadata.weightClass, style === 'Bold' ? 700 : 400);
    assert.equal(audit.cmap.glyphIndex(0x006f), 10);
    assert.notEqual(outline(parsedFor(resultFont, 'o')), outline(parsedFor(baseFont, 'o')));
    assert.equal(outline(parsedFor(resultFont, 'O')), outline(parsedFor(baseFont, 'O')));
    for (const ch of ['A', 'B', 'E', 'H', 'a', 'e', 'n', 'g', 'b', 'd', ',', ' ']) assert.equal(outline(parsedFor(resultFont, ch)), outline(parsedFor(baseFont, ch)), ch);
    assert.deepEqual(parsedFor(resultFont, 'o').contours.map(c => c.points.map(p => [p.x, p.y, p.on])), scenario.execution.family.glyphs.u006f.contours.map(c => c.points.map(p => [p.x, p.y, p.on])));
    assert.equal(fontMetric(resultFont, 0x006f).advanceWidth, scenario.execution.family.glyphs.u006f.metrics.advanceWidth);
    assert.deepEqual(parsedFor(resultFont, '.notdef').contours, parsedFor(baseFont, '.notdef').contours);
  }
  const regular = prepareHeartScenario('Regular').execution.family.glyphs.u006f;
  const bold = prepareHeartScenario('Bold').execution.family.glyphs.u006f;
  assert.notEqual(geometryFingerprint(regular), geometryFingerprint(bold));
});

test('Scenario 2: lowercase reflection honors b/d exceptions and leaves uppercase, punctuation, space, and .notdef unchanged', () => {
  const scenario = prepareReflectionScenario();
  assert.equal(scenario.parseStatus, 'resolved');
  assert.equal(scenario.execution.status, 'committed-candidate');
  const { family: before, model } = scenario, after = scenario.execution.family;
  const reflectId = model.operations[0].id;
  for (const ch of ['a', 'e', 'g', 'n', 'o']) assert.ok(glyphFor(after, ch).appliedOperations.includes(reflectId), ch);
  for (const ch of ['b', 'd', 'A', 'B', 'E', 'H', 'O', ',', ' ']) assert.equal(geometryFingerprint(glyphFor(after, ch)), geometryFingerprint(glyphFor(before, ch)), ch);
  for (const ch of ['a', 'e', 'g', 'n', 'o']) {
    const oldGlyph = glyphFor(before, ch), newGlyph = glyphFor(after, ch);
    assert.deepEqual(validateGlyph({ ...newGlyph, advanceWidth: newGlyph.metrics.advanceWidth, rightSideBearing: newGlyph.metrics.rightSideBearing }), [], ch);
    assert.equal(newGlyph.metrics.advanceWidth, oldGlyph.metrics.advanceWidth, ch);
    assert.equal(newGlyph.metrics.leftSideBearing, oldGlyph.metrics.rightSideBearing, ch);
    assert.equal(newGlyph.metrics.rightSideBearing, oldGlyph.metrics.leftSideBearing, ch);
    assert.deepEqual(newGlyph.contours.map(c => c.id).sort(), oldGlyph.contours.map(c => c.id).sort(), ch);
    assert.deepEqual(newGlyph.contours.flatMap(c => c.points.map(p => p.id)).sort(), oldGlyph.contours.flatMap(c => c.points.map(p => p.id)).sort(), ch);
  }
  const oldFont = compileTypeface(before, 'Regular'), newFont = compileTypeface(after, 'Regular');
  const oldAudit = auditSfnt(oldFont.bytes), newAudit = auditSfnt(newFont.bytes);
  assert.equal(newAudit.valid, true);
  for (const ch of ['a', 'e', 'g', 'n', 'o']) {
    const unicode = ch.codePointAt(0);
    assert.notEqual(newAudit.cmap.glyphIndex(unicode), 0);
    assert.equal(ttfComparableOutline(parsedFor(newFont, ch)), ttfComparableOutline(after.glyphs[glyphFor(after, ch).id]), ch);
  }
  for (const ch of ['b', 'd', 'A', 'O', ',', ' ']) assert.equal(outline(parsedFor(newFont, ch)), outline(parsedFor(oldFont, ch)), ch);
  assert.deepEqual(parsedFor(newFont, '.notdef').contours, parsedFor(oldFont, '.notdef').contours);
  for (const ch of ['A', 'B', 'E', 'H', 'O', 'a', 'b', 'd', 'e', 'g', 'n', 'o', ',', ' '])
    assert.equal(newAudit.cmap.glyphIndex(ch.codePointAt(0)), oldAudit.cmap.glyphIndex(ch.codePointAt(0)), ch);
  for (const ch of ['a', 'e', 'g', 'n', 'o']) {
    const index = newAudit.cmap.glyphIndex(ch.codePointAt(0));
    assert.equal(newAudit.horizontalMetrics.metrics[index].advanceWidth, glyphFor(after, ch).metrics.advanceWidth);
    assert.equal(newAudit.horizontalMetrics.metrics[index].leftSideBearing, glyphFor(after, ch).metrics.leftSideBearing);
  }
});

test('entire-glyph-universe and uppercase selectors use the same operation executor across all three legacy seed designs', () => {
  for (const system of ['geometric', 'humanist', 'serif']) {
    const brief = 'Mirror every glyph.';
    const { spec, family } = makeFamilyAndModel(brief, system);
    const model = adaptV1Spec(spec, family), added = addReflectionInstruction(model, brief);
    const all = executeTransaction(added.model, family);
    assert.equal(all.status, 'committed-candidate', `${system}: ${all.error || ''}`);
    assert.deepEqual(all.revision.targetedGlyphIds.sort(), model.glyphRegistry.glyphs.map(g => g.id).sort());
    assert.notEqual(geometryFingerprint(all.family.glyphs['fixture-notdef']), geometryFingerprint(family.glyphs['fixture-notdef']));
    assert.ok(all.family.glyphs['fixture-u0020'].appliedOperations.includes(added.operationId));
    const font = compileTypeface(all.family, 'Regular'), baseline = compileTypeface(family, 'Regular');
    assert.equal(auditSfnt(font.bytes).valid, true);
    assert.notDeepEqual(parsedFor(font, '.notdef').contours, parsedFor(baseline, '.notdef').contours);
    assert.deepEqual(parsedFor(font, 'space').contours, parsedFor(baseline, 'space').contours);

    const upperBrief = 'Mirror every uppercase letter.';
    const upperBase = makeFamilyAndModel(upperBrief, system);
    const upperModel = addReflectionInstruction(upperBase.model, upperBrief);
    const upper = executeTransaction(upperModel.model, upperBase.family);
    assert.equal(upper.status, 'committed-candidate', `${system}: ${upper.error || ''}`);
    assert.deepEqual(upper.revision.targetedGlyphIds.map(id => upper.family.glyphs[id].character).sort(), ['A', 'B', 'E', 'H', 'O']);
    for (const ch of ['a', 'b', 'd', 'e', 'g', 'n', 'o']) assert.equal(geometryFingerprint(glyphFor(upper.family, ch)), geometryFingerprint(glyphFor(upperBase.family, ch)), `${system}:${ch}`);
  }
});

test('reflection normalizes multi-contour counter winding and reflects anchors and component transforms', () => {
  const { spec, family } = makeFamilyAndModel('A humanist sans-serif.');
  const o = glyphFor(family, 'O');
  assert.ok(o.contours.length > 1);
  o.anchors.topAnchor = { x: 140, y: 700 };
  o.components.push({ id: 'fixture-component', transform: { xx: 1, xy: 0, yx: 0, yy: 1, dx: 30, dy: 15 } });
  const model = adaptV1Spec(spec, family);
  const selector = { id: 'sel:O-only', universe: 'glyph-registry-at-revision', expression: { op: 'glyph-id', value: o.id }, exclude: [],
    resolution: { status: 'unresolved', includedGlyphIds: [], excludedGlyphIds: [], unclassifiedGlyphIds: [], reason: null } };
  model.selectors.push(selector);
  const intent = { id: 'intent:reflect-O', kind: 'transformation', subject: { scope: 'glyph', selectorId: selector.id }, predicate: 'outline.reflect', value: { axis: 'x' },
    source: { messageId: 'msg:1', start: 0, end: 0, text: '' }, origin: 'explicit', confidence: 1, resolution: { status: 'resolved', capability: 'implemented' }, supersedes: [], conflicts: [] };
  model.intent.statements.push(intent);
  model.operations.push({ id: 'op:reflect-O', type: 'geometry.reflect', selectorId: selector.id, parameters: { axis: 'x', origin: { kind: 'advance-midpoint' } }, phase: 'geometry', dependsOn: [],
    preconditions: [], postconditions: [], metricPolicy: { advance: 'preserve', bearings: 'recompute-from-bounds', kerning: 'invalidate-for-review' }, provenance: { intentIds: [intent.id], acceptedDecisionIds: [] },
    capability: 'implemented', resolution: { status: 'resolved' }, conflicts: [], exceptions: [] });
  const result = executeTransaction(model, family);
  assert.equal(result.status, 'committed-candidate');
  const mirrored = result.family.glyphs[o.id];
  assert.deepEqual(validateGlyph({ ...mirrored, advanceWidth: mirrored.metrics.advanceWidth, rightSideBearing: mirrored.metrics.rightSideBearing }), []);
  assert.ok(mirrored.contours.some(c => c.role === 'counter'));
  assert.deepEqual(mirrored.anchors.topAnchor, { x: o.metrics.advanceWidth - 140, y: 700 });
  assert.deepEqual(mirrored.components.at(-1).transform, { xx: -1, xy: 0, yx: 0, yy: 1, dx: o.metrics.advanceWidth - 30, dy: 15 });
});

test('Scenario 3: heart then lowercase reflection composes in dependency order and preserves exclusions', () => {
  const scenario = prepareCompositionScenario();
  assert.equal(scenario.execution.status, 'committed-candidate');
  const family = scenario.execution.family;
  const o = glyphFor(family, 'o');
  assert.deepEqual(o.appliedOperations, ['op:glyph-instruction-1', scenario.model.operations.find(op => op.type === 'geometry.reflect').id]);
  assert.equal(o.substitution.shape, 'heart');
  for (const ch of ['b', 'd', 'O', 'A', 'B', ',', ' ']) assert.equal(geometryFingerprint(glyphFor(family, ch)), geometryFingerprint(glyphFor(scenario.family, ch)), ch);
  const font = compileTypeface(family, 'Regular'), baseFont = compileTypeface(scenario.family, 'Regular');
  assert.equal(auditSfnt(font.bytes).valid, true);
  assert.ok(glyphSvg(o).includes(`d="${contourPathData(o.contours[0])}"`));
  assert.equal(ttfComparableOutline(parsedFor(font, 'o')), ttfComparableOutline(o));
  assert.deepEqual(parsedFor(font, 'O').contours, parsedFor(baseFont, 'O').contours);
});

test('transaction failure after an earlier staged edit creates no candidate revision', () => {
  const scenario = prepareRollbackScenario();
  assert.equal(scenario.execution.status, 'rejected');
  assert.equal(scenario.execution.model.revisions.headRevisionId, scenario.execution.model.revisions.acceptedRevisionId);
});

