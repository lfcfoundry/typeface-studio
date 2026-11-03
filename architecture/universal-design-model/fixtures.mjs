const span = (text, whole, startAt = 0, messageId = 'msg:1') => {
  const start = whole.indexOf(text, startAt);
  if (start < 0) throw new Error(`Fixture span not found: ${text}`);
  return { messageId, start, end: start + text.length, text };
};

const glyph = (id, name, unicode, classes = []) => ({ id, name, unicodes: unicode === null ? [] : [unicode], classes });

const registry = [
  glyph('glyph:notdef', '.notdef', null, ['notdef']), glyph('glyph:space', 'space', 32, ['spacing']),
  glyph('glyph:A', 'A', 65, ['letter', 'uppercase']), glyph('glyph:O', 'O', 79, ['letter', 'uppercase', 'round']),
  glyph('glyph:a', 'a', 97, ['letter', 'lowercase']), glyph('glyph:b', 'b', 98, ['letter', 'lowercase']),
  glyph('glyph:d', 'd', 100, ['letter', 'lowercase']), glyph('glyph:o', 'o', 111, ['letter', 'lowercase', 'round']),
  glyph('glyph:acutecomb', 'acutecomb', 769, ['mark', 'combining'])
];

function makeDesign({ id, brief, messages = [{ id: 'msg:1', text: brief }], glyphs = registry, intents, characteristics = [], constraints = [], selectors = [], operations = [], revisions, diff = null }) {
  return {
    type: 'lfcfoundry.universal-typeface-design', schemaVersion: 2, designId: id,
    family: { name: 'Model Fixture', unitsPerEm: 1000 },
    input: { brief, language: 'en', messages },
    intent: { statements: intents },
    state: { characteristics, constraints, decisions: characteristics.filter(item => item.acceptance === 'accepted').map(item => item.id) },
    glyphRegistry: { revisionId: revisions.headRevisionId, glyphs },
    selectors, operations, revisions, derived: { geometry: null, fontArtifacts: [], validation: [], latestDiff: diff }
  };
}

function intent(id, kind, predicate, value, whole, text, selectorId = 'sel:family', origin = 'explicit', messageId = 'msg:1') {
  return { id, kind, subject: { scope: selectorId === 'sel:family' ? 'family' : 'glyph-set', selectorId }, predicate, value,
    source: span(text, whole, 0, messageId), origin, confidence: origin === 'explicit' ? 1 : 0.78,
    resolution: { status: 'resolved', capability: 'implemented', reason: null }, supersedes: [], conflicts: [] };
}

function selector(id, expression, includedGlyphIds, { exclude = [], excludedGlyphIds = [], universe = 'glyph-registry-at-revision', status = 'resolved', reason = null } = {}) {
  return { id, universe, expression, exclude, resolution: { status, includedGlyphIds, excludedGlyphIds, unclassifiedGlyphIds: [], reason } };
}

function operation(id, type, selectorId, parameters, intentIds, extra = {}) {
  return { id, type, selectorId, parameters, phase: extra.phase || 'geometry', dependsOn: extra.dependsOn || [],
    preconditions: extra.preconditions || [], postconditions: extra.postconditions || [],
    metricPolicy: extra.metricPolicy || { advance: 'preserve', bearings: 'recompute-from-bounds', kerning: 'invalidate-for-review' },
    provenance: { intentIds, acceptedDecisionIds: extra.acceptedDecisionIds || [] },
    capability: extra.capability || 'implemented', resolution: { status: extra.status || 'resolved', reason: extra.reason || null },
    conflicts: [], exceptions: extra.exceptions || [] };
}

function revisionSet(acceptedRevisionId, headRevisionId, items) { return { acceptedRevisionId, headRevisionId, items }; }

const allGlyphSelector = selector('sel:all-glyphs', { op: 'all', args: [{ op: 'glyph-registry' }] }, registry.map(item => item.id));
const lowercaseSelector = selector('sel:lowercase', { op: 'class', value: 'lowercase' }, ['glyph:a', 'glyph:b', 'glyph:d', 'glyph:o']);
const uppercaseSelector = selector('sel:uppercase', { op: 'class', value: 'uppercase' }, ['glyph:A', 'glyph:O']);

const brief1 = 'A serif font in the vein of Times New Roman, but horizontally flip every glyph.';
export const referenceAndReflection = makeDesign({
  id: 'design:reference-reflect', brief: brief1,
  intents: [
    intent('intent:reference', 'style-reference', 'reference.style', { name: 'Times New Roman', useAsOutlineTemplate: false }, brief1, 'in the vein of Times New Roman'),
    intent('intent:serif', 'characteristic', 'construction.serif', { value: true }, brief1, 'serif font'),
    intent('intent:reflect', 'transformation', 'outline.reflect', { axis: 'horizontal' }, brief1, 'horizontally flip every glyph')
  ],
  characteristics: [
    { id: 'decision:serif', property: 'construction.serif', value: { kind: 'boolean', value: true }, selectorId: 'sel:family', origin: 'explicit', certainty: 1, acceptance: 'accepted', capability: 'implemented', sourceIntentIds: ['intent:serif'], dependencyIds: [] },
    { id: 'decision:reference-profile', property: 'reference.profile', value: { kind: 'profile-id', value: 'reference:times-new-roman' }, selectorId: 'sel:family', origin: 'inferred', certainty: 0.7, acceptance: 'candidate', capability: 'approximate', sourceIntentIds: ['intent:reference'], dependencyIds: ['constraint:reference-profile-qualified'] }
  ],
  constraints: [{ id: 'constraint:reference-profile-qualified', expression: { op: 'profile-is-qualified', profileId: 'reference:times-new-roman' }, status: 'requires-curated-profile', sourceIntentIds: ['intent:reference'] }],
  selectors: [allGlyphSelector],
  operations: [operation('op:reflect-all', 'geometry.reflect', 'sel:all-glyphs', { axis: 'x', origin: { kind: 'advance-midpoint' }, scope: 'all-records-in-snapshotted-registry' }, ['intent:reflect'], {
    postconditions: ['bounds-recomputed', 'contour-winding-normalized', 'counter-containment-valid', 'anchors-transformed'],
    metricPolicy: { advance: 'preserve', bearings: 'recompute-from-bounds', kerning: 'invalidate-for-review', markAttachment: 'invalidate-for-review' }
  })],
  revisions: revisionSet('rev:1', 'rev:1', [{ id: 'rev:1', parentRevisionIds: [], status: 'accepted', decisionIds: ['decision:serif'], operationIds: [], deltaOperationIds: [] }])
});

const brief2 = 'Make lowercase o heart-shaped; keep uppercase O normal.';
export const lowercaseHeartUppercasePreserved = makeDesign({
  id: 'design:heart-o-case', brief: brief2,
  intents: [
    intent('intent:heart', 'substitution', 'glyph.replace', { target: 'o', shape: 'heart', caseScope: 'lowercase' }, brief2, 'lowercase o heart-shaped', 'sel:lowercase-o'),
    intent('intent:keep-O', 'preservation', 'glyph.preserve-outline', { target: 'O' }, brief2, 'keep uppercase O normal', 'sel:uppercase-O')
  ],
  characteristics: [
    { id: 'decision:heart-o', property: 'glyph.outline-shape', value: { kind: 'named-construction', value: 'shape.heart' }, selectorId: 'sel:lowercase-o', origin: 'explicit', certainty: 1, acceptance: 'accepted', capability: 'implemented', sourceIntentIds: ['intent:heart'], dependencyIds: [] },
    { id: 'decision:preserve-O', property: 'glyph.outline', value: { kind: 'preserve-base' }, selectorId: 'sel:uppercase-O', origin: 'explicit', certainty: 1, acceptance: 'accepted', capability: 'implemented', sourceIntentIds: ['intent:keep-O'], dependencyIds: [] }
  ],
  selectors: [
    selector('sel:lowercase-o', { op: 'glyph-id', value: 'glyph:o' }, ['glyph:o']),
    selector('sel:uppercase-O', { op: 'glyph-id', value: 'glyph:O' }, ['glyph:O'])
  ],
  operations: [operation('op:heart-o', 'substitute.glyph', 'sel:lowercase-o', { operation: 'replace-outline', shape: 'heart', preserveUnicode: true }, ['intent:heart'], {
    postconditions: ['unicode-mapping-preserved', 'outline-valid', 'metrics-valid']
  })],
  revisions: revisionSet('rev:heart-1', 'rev:heart-1', [{ id: 'rev:heart-1', parentRevisionIds: [], status: 'accepted', decisionIds: ['decision:heart-o', 'decision:preserve-O'], operationIds: ['op:heart-o'], deltaOperationIds: ['op:heart-o'] }])
});

const brief3 = 'A humanist serif with slab serifs, monospaced spacing, triangular counters, and disconnected terminals.';
export const independentCharacteristicCombination = makeDesign({
  id: 'design:combined-traits', brief: brief3,
  intents: [
    intent('intent:humanist', 'characteristic', 'construction.humanist', { value: true }, brief3, 'humanist'),
    intent('intent:serif', 'characteristic', 'construction.serif', { value: true }, brief3, 'serif'),
    intent('intent:slab', 'construction', 'serif.form', { value: 'slab' }, brief3, 'slab serifs'),
    intent('intent:mono', 'characteristic', 'spacing.model', { value: 'monospaced' }, brief3, 'monospaced spacing'),
    intent('intent:triangles', 'construction', 'counter.topology', { value: 'triangular' }, brief3, 'triangular counters'),
    intent('intent:disconnected', 'construction', 'terminal.connectivity', { value: 'disconnected' }, brief3, 'disconnected terminals')
  ],
  characteristics: [
    ['humanist', 'construction.humanist', { value: true }, 'intent:humanist'],
    ['serif', 'construction.serif', { value: true }, 'intent:serif'],
    ['slab', 'serif.form', { value: 'slab' }, 'intent:slab'],
    ['mono', 'spacing.model', { value: 'monospaced' }, 'intent:mono'],
    ['triangle', 'counter.topology', { value: 'triangular' }, 'intent:triangles'],
    ['disconnected', 'terminal.connectivity', { value: 'disconnected' }, 'intent:disconnected']
  ].map(([id, property, value, intentId]) => ({ id: `decision:${id}`, property, value: { kind: 'enum', ...value }, selectorId: 'sel:family', origin: 'explicit', certainty: 1, acceptance: 'candidate', capability: property === 'spacing.model' ? 'implemented' : 'unknown', sourceIntentIds: [intentId], dependencyIds: [] })),
  selectors: [
    selector('sel:family', { op: 'all', args: [{ op: 'glyph-registry' }] }, registry.map(item => item.id)),
    selector('sel:counters', { op: 'anatomy-kind', value: 'anatomy.counter' }, [], { status: 'deferred', reason: 'Resolve after candidate construction graphs identify counter-bearing glyphs.' }),
    selector('sel:terminals', { op: 'anatomy-kind', value: 'anatomy.terminal' }, [], { status: 'deferred', reason: 'Resolve after candidate construction graphs identify terminal-bearing glyphs.' })
  ],
  operations: [
    operation('op:monospacing', 'metric.adjust', 'sel:family', { model: 'monospaced', cellWidth: { kind: 'derive-from-family' } }, ['intent:mono'], { phase: 'metrics' }),
    operation('op:triangular-counters', 'structure.modify', 'sel:counters', { property: 'counter.topology', value: 'triangular' }, ['intent:triangles'], { status: 'deferred', reason: 'Target glyphs depend on the generated semantic anatomy graph.' }),
    operation('op:disconnected-terminals', 'structure.modify', 'sel:terminals', { property: 'terminal.connectivity', value: 'disconnected' }, ['intent:disconnected'], { status: 'deferred', reason: 'Affected glyphs and valid joins require construction-level resolution.' }),
    operation('op:slab-serifs', 'construct.serif', 'sel:family', { form: 'slab', bracket: 'unresolved' }, ['intent:serif', 'intent:slab'], { status: 'needs-user-decision', reason: 'Slab profile and bracket transition are under-specified.' })
  ],
  constraints: [{ id: 'constraint:feature-compatibility', expression: { op: 'check-feature-interactions', featureIds: ['decision:humanist', 'decision:slab', 'decision:triangle', 'decision:disconnected'] }, status: 'needs-construction-solver', sourceIntentIds: ['intent:humanist', 'intent:slab', 'intent:triangles', 'intent:disconnected'] }],
  revisions: revisionSet('rev:traits-1', 'rev:traits-1', [{ id: 'rev:traits-1', parentRevisionIds: [], status: 'candidate', decisionIds: ['decision:humanist', 'decision:serif', 'decision:slab', 'decision:mono', 'decision:triangle', 'decision:disconnected'], operationIds: ['op:monospacing', 'op:triangular-counters', 'op:disconnected-terminals', 'op:slab-serifs'], deltaOperationIds: ['op:monospacing', 'op:triangular-counters', 'op:disconnected-terminals', 'op:slab-serifs'] }])
});

const brief4 = 'Mirror every lowercase letter except b and d; keep all other glyphs as they are.';
export const lowercaseReflectionWithExceptions = makeDesign({
  id: 'design:lowercase-mirror-exceptions', brief: brief4,
  intents: [
    intent('intent:mirror-lower', 'transformation', 'outline.reflect', { axis: 'horizontal', targetClass: 'lowercase' }, brief4, 'Mirror every lowercase letter except b and d'),
    intent('intent:except-bd', 'exclusion', 'selector.exclude', { glyphs: ['b', 'd'] }, brief4, 'except b and d'),
    intent('intent:preserve-rest', 'preservation', 'glyph.preserve', { scope: 'non-lowercase' }, brief4, 'keep all other glyphs as they are')
  ],
  selectors: [selector('sel:lowercase-minus-bd', { op: 'class', value: 'lowercase' }, ['glyph:a', 'glyph:o'], {
    exclude: [{ op: 'glyph-id', value: 'glyph:b' }, { op: 'glyph-id', value: 'glyph:d' }], excludedGlyphIds: ['glyph:b', 'glyph:d']
  })],
  operations: [operation('op:mirror-lowercase', 'geometry.reflect', 'sel:lowercase-minus-bd', { axis: 'x', origin: { kind: 'advance-midpoint' } }, ['intent:mirror-lower', 'intent:except-bd'], {
    postconditions: ['bounds-recomputed', 'contour-winding-normalized', 'metrics-recomputed'], exceptions: ['glyph:b', 'glyph:d']
  })],
  revisions: revisionSet('rev:mirror-1', 'rev:mirror-1', [{ id: 'rev:mirror-1', parentRevisionIds: [], status: 'candidate', decisionIds: [], operationIds: ['op:mirror-lowercase'], deltaOperationIds: ['op:mirror-lowercase'] }]),
  diff: { changedGlyphIds: ['glyph:a', 'glyph:o'], unchangedGlyphIds: ['glyph:notdef', 'glyph:space', 'glyph:A', 'glyph:O', 'glyph:b', 'glyph:d', 'glyph:acutecomb'], reason: 'Selector expansion and explicit exclusions define the complete affected set.' }
});

const brief5 = 'Make the capitals narrower, but keep the heart-shaped o, spacing, weight, and all other choices.';
export const followupCandidate = makeDesign({
  id: 'design:followup-narrow-caps', brief: brief5,
  messages: [
    { id: 'msg:0', text: 'A humanist sans-serif with generous spacing and regular weight; make lowercase o heart-shaped.' },
    { id: 'msg:1', text: brief5 }
  ],
  intents: [
    intent('intent:prior-heart', 'substitution', 'glyph.replace', { target: 'o', shape: 'heart', caseScope: 'lowercase' }, 'A humanist sans-serif with generous spacing and regular weight; make lowercase o heart-shaped.', 'lowercase o heart-shaped', 'sel:lowercase-o', 'explicit', 'msg:0'),
    intent('intent:prior-spacing', 'characteristic', 'spacing.model', { value: 'generous' }, 'A humanist sans-serif with generous spacing and regular weight; make lowercase o heart-shaped.', 'generous spacing', 'sel:family', 'explicit', 'msg:0'),
    intent('intent:prior-weight', 'characteristic', 'stroke.weight', { value: 400 }, 'A humanist sans-serif with generous spacing and regular weight; make lowercase o heart-shaped.', 'regular weight', 'sel:family', 'explicit', 'msg:0'),
    intent('intent:narrow-caps', 'characteristic', 'proportion.width', { value: 'narrower' }, brief5, 'Make the capitals narrower')
  ],
  characteristics: [
    { id: 'decision:heart-o', property: 'glyph.outline-shape', value: { kind: 'named-construction', value: 'shape.heart' }, selectorId: 'sel:lowercase-o', origin: 'explicit', certainty: 1, acceptance: 'accepted', capability: 'implemented', sourceIntentIds: ['intent:prior-heart'], dependencyIds: [] },
    { id: 'decision:spacing', property: 'spacing.model', value: { kind: 'relative', amount: 1.1, unit: 'factor' }, selectorId: 'sel:family', origin: 'explicit', certainty: 1, acceptance: 'accepted', capability: 'implemented', sourceIntentIds: ['intent:prior-spacing'], dependencyIds: [] },
    { id: 'decision:weight', property: 'stroke.weight', value: { kind: 'font-weight-class', value: 400 }, selectorId: 'sel:family', origin: 'explicit', certainty: 1, acceptance: 'accepted', capability: 'implemented', sourceIntentIds: ['intent:prior-weight'], dependencyIds: [] }
  ],
  selectors: [selector('sel:uppercase', { op: 'class', value: 'uppercase' }, ['glyph:A', 'glyph:O']), selector('sel:lowercase-o', { op: 'glyph-id', value: 'glyph:o' }, ['glyph:o'])],
  operations: [
    operation('op:heart-o', 'substitute.glyph', 'sel:lowercase-o', { operation: 'replace-outline', shape: 'heart', preserveUnicode: true }, ['intent:prior-heart']),
    operation('op:narrow-caps', 'geometry.scale', 'sel:uppercase', { xFactor: 0.92, yFactor: 1, origin: { kind: 'glyph-advance-midpoint' }, advance: 'recompute' }, ['intent:narrow-caps'], {
      preconditions: ['base-geometry-available'], acceptedDecisionIds: ['decision:heart-o', 'decision:spacing', 'decision:weight'],
      metricPolicy: { advance: 'recompute-for-targets', bearings: 'recompute-from-bounds', kerning: 'invalidate-targeted-pairs' }
    })
  ],
  revisions: revisionSet('rev:accepted-base', 'rev:candidate-narrow-caps', [
    { id: 'rev:accepted-base', parentRevisionIds: [], status: 'accepted', decisionIds: ['decision:heart-o', 'decision:spacing', 'decision:weight'], operationIds: ['op:heart-o'], deltaOperationIds: ['op:heart-o'] },
    { id: 'rev:candidate-narrow-caps', parentRevisionIds: ['rev:accepted-base'], status: 'candidate', decisionIds: ['decision:heart-o', 'decision:spacing', 'decision:weight'], operationIds: ['op:heart-o', 'op:narrow-caps'], deltaOperationIds: ['op:narrow-caps'], preservedDecisionIds: ['decision:heart-o', 'decision:spacing', 'decision:weight'] }
  ]),
  diff: { changedCharacteristicIds: ['decision:cap-width'], changedGlyphIds: ['glyph:A', 'glyph:O'], invalidatedMetricGlyphIds: ['glyph:A', 'glyph:O'], preservedDecisionIds: ['decision:heart-o', 'decision:spacing', 'decision:weight'], unchangedGlyphIds: ['glyph:o', 'glyph:a', 'glyph:b', 'glyph:d', 'glyph:space', 'glyph:acutecomb'] }
});

export const examples = [referenceAndReflection, lowercaseHeartUppercasePreserved, independentCharacteristicCombination, lowercaseReflectionWithExceptions, followupCandidate];

