import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateGlyph } from '../../../../prototype/src/contours.js';
import {
  buildLowercaseACandidate,
  compileSemanticDesign,
  deriveGlyph,
  validateSemanticDesign
} from '../index.mjs';
import { validateTerminalProfileRecord } from '../terminal-profile-record.mjs';

const target = 'part:a-upper-terminal';

test('shared terminal-profile record validation covers only common fields deterministically and without mutation', () => {
  const validRecords = [
    { profile: 'flat' },
    { profile: 'flat', alignmentDecisionId: 'decision:x-height' },
    { profile: 'chamfered', orientation: 'outer-right', cutRatio: 0.2 }
  ];
  for (const record of validRecords) {
    const before = structuredClone(record);
    assert.deepEqual(validateTerminalProfileRecord(record), []);
    assert.deepEqual(record, before);
  }

  const invalidRecords = [
    null,
    [],
    {},
    { profile: null },
    { profile: 'rounded' },
    { profile: 'flat', orientation: 'outer-right' },
    { profile: 'flat', cutRatio: 0.2 },
    { profile: 'chamfered', cutRatio: 0.2 },
    { profile: 'chamfered', orientation: 'outer-left', cutRatio: 0.2 },
    { profile: 'chamfered', orientation: null, cutRatio: 0.2 },
    { profile: 'chamfered', orientation: 'outer-right' },
    { profile: 'chamfered', orientation: 'outer-right', cutRatio: '0.2' },
    { profile: 'chamfered', orientation: 'outer-right', cutRatio: NaN },
    { profile: 'chamfered', orientation: 'outer-right', cutRatio: Infinity },
    { profile: 'chamfered', orientation: 'outer-right', cutRatio: 0 },
    { profile: 'chamfered', orientation: 'outer-right', cutRatio: -0.1 },
    { profile: 'chamfered', orientation: 'outer-right', cutRatio: 0.2501 }
  ];
  for (const record of invalidRecords) {
    const before = record && typeof record === 'object' ? structuredClone(record) : record;
    const first = validateTerminalProfileRecord(record);
    assert.ok(first.length > 0);
    assert.deepEqual(validateTerminalProfileRecord(record), first, 'diagnostics are stable');
    if (before && typeof before === 'object') assert.deepEqual(record, before, 'validation does not mutate input');
  }
  assert.deepEqual(validateTerminalProfileRecord({ profile: 'chamfered', orientation: 'outer-right', cutRatio: 0 }), [
    'Terminal cutRatio must be greater than zero and at most 0.25 stem widths.'
  ]);
});

function changedDesign(mutate = () => {}) {
  const candidate = buildLowercaseACandidate();
  const model = structuredClone(candidate.model);
  const glyph = model.glyphRegistry.glyphs.find(item => item.id === 'glyph:u0061');
  const terminal = glyph.construction.nodes.find(item => item.id === target);
  terminal.parameters = { ...terminal.parameters, profile: 'chamfered', orientation: 'outer-right', cutRatio: 0.2 };
  mutate(terminal, glyph, model);
  return { candidate, model, glyph, terminal };
}

test('flat upper terminal retains the existing derived geometry and saved font bytes', () => {
  const candidate = buildLowercaseACandidate();
  const saved = readFileSync(new URL('../artifacts/LFCFoundry-Semantic-Construction-Lowercase-A-Experiment.ttf', import.meta.url));
  assert.deepEqual(Buffer.from(compileSemanticDesign(candidate.model).bytes), saved);
  assert.deepEqual(candidate.glyph.bounds, { xMin: 55, yMin: 0, xMax: 595, yMax: 500 });
  assert.deepEqual(candidate.glyph.metrics, { advanceWidth: 650, leftSideBearing: 55, rightSideBearing: 55 });
  assert.ok(candidate.glyph.contours[0].segments.some(segment => segment.id === `${target}.flat-edge`));
  assert.ok(!candidate.glyph.contours[0].segments.some(segment => segment.id === `${target}.bevel-edge`));
});

test('upper outer-corner chamfer derives from semantic parameters and preserves terminal identity and attachments', () => {
  const { candidate, model, glyph, terminal } = changedDesign();
  const before = candidate.model.glyphRegistry.glyphs.find(item => item.id === glyph.id);
  const beforeTerminal = before.construction.nodes.find(item => item.id === target);
  const unrelatedBefore = before.construction.nodes.filter(item => item.id !== target);
  assert.deepEqual(validateSemanticDesign(model), []);

  const derived = deriveGlyph(glyph, model);
  assert.equal(terminal.id, target);
  assert.equal(terminal.role, 'upper-stem-terminal');
  assert.deepEqual(terminal.relations, beforeTerminal.relations);
  assert.deepEqual(glyph.construction.nodes.filter(item => item.id !== target), unrelatedBefore);
  assert.equal(terminal.parameters.profile, 'chamfered');
  assert.equal(terminal.parameters.orientation, 'outer-right');
  assert.equal(terminal.parameters.cutRatio, 0.2);
  assert.deepEqual(derived.contours[1], candidate.glyph.contours[1], 'the bowl counter is unaffected');
  assert.ok(derived.contours[0].segments.some(segment => segment.id === `${target}.bevel-edge`));
  assert.notDeepEqual(derived.contours[0], candidate.glyph.contours[0]);
  assert.deepEqual(derived.bounds, { xMin: 55, yMin: 0, xMax: 595, yMax: 500 });
  assert.deepEqual(derived.metrics, { advanceWidth: 650, leftSideBearing: 55, rightSideBearing: 55 });
  assert.deepEqual(validateGlyph({ ...derived, advanceWidth: derived.metrics.advanceWidth, rightSideBearing: derived.metrics.rightSideBearing }), []);
  assert.deepEqual(deriveGlyph(glyph, model), derived, 'identical semantic input derives identical geometry');
});

test('unsupported profiles, orientations, and dimensions reject', () => {
  const invalidProfiles = [
    terminal => { terminal.parameters.profile = 'rounded'; },
    terminal => { terminal.parameters.orientation = 'outer-left'; },
    terminal => { terminal.parameters.cutRatio = 0; },
    terminal => { terminal.parameters.cutRatio = 0.26; },
    terminal => { terminal.parameters.cutRatio = 0.001; },
    terminal => { terminal.parameters.unexpected = true; }
  ];
  for (const mutate of invalidProfiles) {
    const { model, glyph, terminal } = changedDesign(mutate);
    assert.ok(validateSemanticDesign(model).length > 0);
    assert.throws(() => deriveGlyph(glyph, model));
  }

  const invalidRelationships = [
    (terminal) => { terminal.relations.find(relation => relation.type === 'attaches-to').targetId = 'part:a-counter'; },
    (terminal, glyph) => { glyph.construction.nodes.find(item => item.role === 'upper-bowl-stem').relations.find(relation => relation.type === 'attaches-to').targetId = 'part:a-counter'; }
  ];
  for (const mutate of invalidRelationships) {
    const { model } = changedDesign(mutate);
    assert.ok(validateSemanticDesign(model).length > 0, 'semantic relationship validation rejects the malformed attachment');
  }

  const unsupportedLower = changedDesign((terminal, glyph) => {
    const lower = glyph.construction.nodes.find(item => item.role === 'lower-stem-terminal');
    lower.parameters = { ...lower.parameters, profile: 'chamfered', orientation: 'outer-right', cutRatio: 0.2 };
  });
  assert.ok(validateSemanticDesign(unsupportedLower.model).length > 0);
  assert.throws(() => deriveGlyph(unsupportedLower.glyph, unsupportedLower.model));
});
