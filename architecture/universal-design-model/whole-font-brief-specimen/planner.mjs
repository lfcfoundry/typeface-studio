import { H_GLYPH_ID, H_METHOD } from '../construction-experiment/lowercase-h-topology-slice/grammar.mjs';

const glyphIdentity = Object.freeze([
  { name: 'o', id: 'glyph:u006f', method: 'construction.ring-from-bowl-counter' },
  { name: 'n', id: 'glyph:u006e', method: 'construction.connected-stems-and-shoulder' },
  { name: 'H', id: 'glyph:u0048', method: 'construction.parallel-stems-and-crossbar' },
  { name: 'a', id: 'glyph:u0061', method: 'construction.bowl-with-attached-stem' },
  { name: 'h', id: H_GLYPH_ID, method: H_METHOD }
]);

const sharedBindings = Object.freeze({
  'decision:stroke-consistency': {
    decisionId: 'decision:shared-stem-width', value: 90,
    glyphs: { o: ['part:o-bowl', 'part:o-counter'], n: ['part:n-left-stem', 'part:n-right-stem'],
      H: ['part:H-left-stem', 'part:H-right-stem', 'part:H-crossbar'], a: ['part:a-stem', 'part:a-counter'],
      h: ['part:h-ascender-stem', 'part:h-shoulder'] }
  },
  'decision:tall-x-height': {
    decisionId: 'decision:x-height', value: 500,
    glyphs: { o: ['part:o-bowl'], n: ['part:n-shoulder'], a: ['part:a-bowl'], h: ['part:h-shoulder'] }
  }
});

export function planCoordinatedSpecimen(specification, acceptedModel) {
  if (!specification || !acceptedModel?.glyphRegistry?.glyphs) throw new Error('A resolved specification and accepted design are required.');
  if (acceptedModel.revisions?.acceptedRevisionId !== acceptedModel.revisions?.headRevisionId) throw new Error('Specimen planning requires the current accepted revision.');
  const registryById = new Map(acceptedModel.glyphRegistry.glyphs.map(item => [item.id, item]));
  const plans = glyphIdentity.map(item => {
    const existing = registryById.get(item.id);
    const topologyRequested = item.name === 'a' ? specification.glyphExceptions.find(value => value.id === 'decision:lowercase-a-topology') : null;
    if (item.name === 'a' && topologyRequested) return {
      glyphId: item.id, name: item.name, scope: 'glyph-specific-exception', requested: structuredClone(topologyRequested.value),
      acceptedConstructionMethod: existing?.construction?.method ?? null, plannedConstructionMethod: null,
      action: 'carry-forward-accepted-glyph-for-comparison-only', constructionCapability: 'blocked',
      reason: 'No construction is selected as a substitute for the requested conventional double-storey form.',
      familyDecisionIds: ['decision:stroke-consistency', 'decision:tall-x-height', 'decision:generous-counters']
    };
    const method = existing?.construction?.method || item.method;
    const needsAdd = !existing && item.name === 'h';
    if (!existing && !needsAdd) return { glyphId: item.id, name: item.name, plannedConstructionMethod: null,
      action: 'blocked', constructionCapability: 'missing', reason: 'No accepted source glyph or registered construction method is available.' };
    return { glyphId: item.id, name: item.name, acceptedConstructionMethod: existing?.construction?.method ?? null,
      plannedConstructionMethod: method, action: needsAdd ? 'add-default-specimen-glyph' : 'reuse-accepted-construction',
      constructionCapability: 'available-experimentally', familyDecisionIds: ['decision:stroke-consistency',
        ...(item.name === 'H' ? [] : ['decision:tall-x-height']), ...(item.name === 'o' || item.name === 'a' ? ['decision:generous-counters'] : [])],
      glyphSpecificDecisionIds: item.name === 'a' ? ['decision:lowercase-a-topology'] : [] };
  });
  const plannedIds = new Set(plans.map(item => item.glyphId));
  const excludedGlyphs = [
    ...acceptedModel.glyphRegistry.glyphs.filter(item => !plannedIds.has(item.id)).map(item => ({ glyphId: item.id,
      name: item.name, reason: 'Outside the deliberately small specimen; this is not font coverage.' })),
    { glyphId: null, name: 'remaining Latin and Unicode repertoire', reason: 'The brief is not expanded into a complete alphabet, digits, punctuation, marks, or script inventory.' }
  ];
  const dependencies = Object.entries(sharedBindings).flatMap(([decisionId, binding]) => Object.entries(binding.glyphs).map(([name, nodeIds]) => ({
    decisionId, parameterDecisionId: binding.decisionId, currentValue: binding.value,
    glyphId: glyphIdentity.find(item => item.name === name).id, glyphName: name, semanticNodeIds: nodeIds,
    relation: 'shared-family-decision-to-construction', status: name === 'a' && decisionId === 'decision:tall-x-height'
      ? 'inherited-but-topology-blocked-for-request' : 'declared-dependency'
  })));
  const specimenPlan = {
    version: 1, scope: 'coordinated-diagnostic-specimen', sourceRevisionId: acceptedModel.revisions.headRevisionId,
    glyphs: plans, excludedGlyphs, dependencies,
    capabilitySummary: {
      availableMethods: [...new Set(plans.filter(item => item.constructionCapability === 'available-experimentally').map(item => item.plannedConstructionMethod))],
      unsupportedRequirements: specification.unsupported.map(item => item.decisionId),
      unresolvedRequirements: specification.unresolved.map(item => item.decisionId),
      usesDoubleStoreyAExperiment: false,
      compliance: 'partial; preserve source a only for comparison and report the topology requirement as unsupported'
    },
    default: { origin: 'defaulted', inventory: ['o', 'n', 'H', 'a', 'h'], rationale: 'Select one round lowercase, connected lowercase, uppercase, requested-exception context, and existing ascender-shoulder construction. The extra h is a specimen choice, not an additional user request.' }
  };
  return specimenPlan;
}
