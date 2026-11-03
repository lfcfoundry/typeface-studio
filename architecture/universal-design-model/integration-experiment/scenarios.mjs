import { interpretBrief } from '../../../prototype/src/brief.js';
import { generateContourFamily } from '../../../prototype/src/recipes.js';
import { adaptV1Spec, addReflectionInstruction, augmentTestInventory, canonicalizeInitialGeometry, executeTransaction } from './engine.mjs';

const emptyGlyphInstructions = model => ({ ...model, glyphInstructions: { version: model.glyphInstructions.version, instructions: [], conflicts: [], unsupported: [], unresolved: [] } });

export function generateInitialGeometry(brief, { system = null, style = 'Regular' } = {}) {
  const specV1 = interpretBrief(brief);
  const generatorInput = emptyGlyphInstructions(structuredClone(specV1));
  const initial = generateContourFamily(generatorInput, { system: system || specV1.resolvedParameters.system, style });
  return { specV1, family: augmentTestInventory(canonicalizeInitialGeometry(initial)) };
}

export function prepareHeartScenario(style = 'Regular') {
  const brief = 'Make lowercase o heart-shaped; keep uppercase O normal.';
  const { specV1, family } = generateInitialGeometry(brief, { system: 'humanist', style });
  const model = adaptV1Spec(specV1, family);
  return { brief, specV1, family, model, execution: executeTransaction(model, family) };
}

export function prepareReflectionScenario() {
  const brief = 'Mirror every lowercase letter except b and d; keep all other glyphs as they are.';
  const { specV1, family } = generateInitialGeometry(brief, { system: 'humanist' });
  const model = adaptV1Spec(specV1, family);
  const added = addReflectionInstruction(model, brief);
  return { brief, specV1, family, model: added.model, parseStatus: added.status, execution: executeTransaction(added.model, family) };
}

export function prepareCompositionScenario() {
  const brief = 'Make lowercase o heart-shaped, then mirror every lowercase letter except b and d; keep all other glyphs as they are.';
  const { specV1, family } = generateInitialGeometry(brief, { system: 'humanist' });
  const model = adaptV1Spec(specV1, family);
  const added = addReflectionInstruction(model, brief);
  return { brief, specV1, family, model: added.model, parseStatus: added.status, execution: executeTransaction(added.model, family) };
}

export function prepareRollbackScenario() {
  const brief = 'Mirror every lowercase letter except b and d; keep all other glyphs as they are.';
  const { specV1, family } = generateInitialGeometry(brief, { system: 'humanist' });
  const model = adaptV1Spec(specV1, family);
  const added = addReflectionInstruction(model, brief);
  const broken = structuredClone(added.model);
  const uppercase = { id: 'sel:invalid-test-target', universe: 'glyph-registry-at-revision', expression: { op: 'class', value: 'uppercase' }, exclude: [],
    resolution: { status: 'unresolved', includedGlyphIds: [], excludedGlyphIds: [], unclassifiedGlyphIds: [], reason: 'Will be resolved by the transaction.' } };
  broken.selectors.push(uppercase);
  broken.intent.statements.push({ id: 'intent:deliberately-unsupported', kind: 'construction', subject: { scope: 'class', selectorId: uppercase.id },
    predicate: 'geometry.unsupported-test', value: {}, source: { messageId: 'msg:1', start: 0, end: 0, text: '' }, origin: 'explicit', confidence: 1,
    resolution: { status: 'resolved', capability: 'implemented', reason: null }, supersedes: [], conflicts: [] });
  broken.operations.push({ id: 'op:z-deliberately-unsupported', type: 'geometry.unsupported-test', selectorId: uppercase.id, parameters: {}, phase: 'geometry', dependsOn: [],
    preconditions: [], postconditions: [], metricPolicy: { advance: 'preserve', bearings: 'preserve', kerning: 'preserve' },
    provenance: { intentIds: ['intent:deliberately-unsupported'], acceptedDecisionIds: [] }, capability: 'implemented', resolution: { status: 'resolved', reason: null }, conflicts: [], exceptions: [] });
  return { brief, specV1, family, model: broken, execution: executeTransaction(broken, family) };
}

