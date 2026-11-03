export const H_METHOD = 'construction.ascender-stem-shoulder-return';
export const H_CAPABILITY = 'capability:ascender-stem-shoulder-return-v1';
export const H_GLYPH_ID = 'glyph:u0068';
export const H_BOUNDARIES = Object.freeze({
  stemOuter: 'boundary:h:stem-outer-wall',
  stemTop: 'boundary:h:upper-stem-terminal',
  shoulderEntry: 'boundary:h:stem-shoulder-junction',
  shoulderOuter: 'boundary:h:shoulder-outer-arch',
  returnOuter: 'boundary:h:return-outer-wall',
  returnBottom: 'boundary:h:shoulder-return-terminal',
  returnInner: 'boundary:h:open-space-return-wall',
  shoulderInner: 'boundary:h:open-space-shoulder-wall',
  stemInner: 'boundary:h:open-space-stem-wall',
  stemBottom: 'boundary:h:lower-stem-terminal',
  opening: 'boundary:h:baseline-opening'
});

const clone = structuredClone;
const node = (id, kind, role, parameters = {}, relations = []) => ({ id, kind, role, parameters, relations });

/** Semantic record for one ascender stem joined to an arch with an integrated return leg. */
export function createHConstruction({ stemWidthDecisionId, xHeightDecisionId,
  ascenderDecisionId, baselineDecisionId, identityPrefix = 'h', provenance = null }) {
  const ids = {
    stem: `part:${identityPrefix}-ascender-stem`, shoulder: `part:${identityPrefix}-shoulder`,
    space: `part:${identityPrefix}-open-counter`, join: `part:${identityPrefix}-stem-shoulder-join`,
    top: `part:${identityPrefix}-upper-terminal`, bottom: `part:${identityPrefix}-lower-terminal`,
    return: `part:${identityPrefix}-return-terminal`
  };
  const boundaries = Object.fromEntries(Object.entries(H_BOUNDARIES).map(([key, id]) => [key,
    id.replace('boundary:h:', `boundary:${identityPrefix}:`)]));
  const nodes = [
    node(ids.stem, 'anatomy.stem', 'left-ascender-stem', {
      widthDecisionId: stemWidthDecisionId, ascenderDecisionId
    }, [
      { type: 'joins', targetId: ids.join },
      { type: 'terminates-at', targetId: ids.top },
      { type: 'terminates-at', targetId: ids.bottom },
      { type: 'owns-boundary', targetId: boundaries.stemOuter },
      { type: 'owns-boundary', targetId: boundaries.stemInner }
    ]),
    node(ids.shoulder, 'anatomy.shoulder', 'arched-return', {
      profile: 'quadratic-arch-with-return-leg', xHeightDecisionId, ascenderDecisionId,
      outerControlRiseRatio: 0.6, innerEndpointRatio: 0.76, innerControlRiseRatio: 0.2
    }, [
      { type: 'attaches-to', targetId: ids.stem },
      { type: 'joins', targetId: ids.join },
      { type: 'terminates-at', targetId: ids.return },
      { type: 'owns-boundary', targetId: boundaries.shoulderOuter },
      { type: 'owns-boundary', targetId: boundaries.returnOuter },
      { type: 'owns-boundary', targetId: boundaries.returnInner },
      { type: 'owns-boundary', targetId: boundaries.shoulderInner },
      { type: 'bounds', targetId: ids.space }
    ]),
    node(ids.space, 'anatomy.open-space', 'shoulder-open-counter', {
      boundaryIds: [boundaries.stemInner, boundaries.shoulderInner, boundaries.returnInner],
      openingBoundaryId: boundaries.opening
    }, [
      ...[boundaries.stemInner, boundaries.shoulderInner, boundaries.returnInner]
        .map(targetId => ({ type: 'bounded-by', targetId })),
      { type: 'opens-to', targetId: boundaries.opening },
      { type: 'owns-boundary', targetId: boundaries.opening }
    ]),
    node(ids.join, 'anatomy.join', 'stem-shoulder-attachment', {}, [
      { type: 'connects', targetId: ids.stem }, { type: 'connects', targetId: ids.shoulder },
      { type: 'owns-boundary', targetId: boundaries.shoulderEntry }
    ]),
    node(ids.top, 'anatomy.terminal', 'upper-stem-terminal', {
      profile: 'flat', alignmentDecisionId: ascenderDecisionId
    }, [
      { type: 'attaches-to', targetId: ids.stem }, { type: 'aligned-to', targetId: ascenderDecisionId },
      { type: 'owns-boundary', targetId: boundaries.stemTop }
    ]),
    node(ids.bottom, 'anatomy.terminal', 'lower-stem-terminal', {
      profile: 'flat', alignmentDecisionId: baselineDecisionId
    }, [
      { type: 'attaches-to', targetId: ids.stem }, { type: 'aligned-to', targetId: baselineDecisionId },
      { type: 'owns-boundary', targetId: boundaries.stemBottom }
    ]),
    node(ids.return, 'anatomy.terminal', 'lower-shoulder-return-terminal', {
      profile: 'flat', alignmentDecisionId: baselineDecisionId
    }, [
      { type: 'attaches-to', targetId: ids.shoulder }, { type: 'aligned-to', targetId: baselineDecisionId },
      { type: 'owns-boundary', targetId: boundaries.returnBottom }
    ]),
    ...[
      ['stemOuter', 'left-stem-outer-wall', ids.stem],
      ['stemTop', 'upper-stem-terminal-edge', ids.top],
      ['shoulderEntry', 'stem-shoulder-junction', ids.join],
      ['shoulderOuter', 'shoulder-outer-arch', ids.shoulder],
      ['returnOuter', 'shoulder-return-outer-wall', ids.shoulder],
      ['returnBottom', 'shoulder-return-terminal-edge', ids.return],
      ['returnInner', 'open-space-return-wall', ids.shoulder],
      ['shoulderInner', 'open-space-shoulder-wall', ids.shoulder],
      ['stemInner', 'open-space-stem-wall', ids.stem],
      ['stemBottom', 'lower-stem-terminal-edge', ids.bottom],
      ['opening', 'baseline-opening', ids.space]
    ].map(([key, role, ownerId]) => node(boundaries[key], 'anatomy.boundary', role, { ownerId }, [
      { type: 'owned-by', targetId: ownerId }
    ]))
  ];
  const constraints = [
    { id: `constraint:${identityPrefix}-stem-shoulder-join`, type: 'attached-components', nodes: [ids.stem, ids.join, ids.shoulder] },
    { id: `constraint:${identityPrefix}-open-counter`, type: 'open-space-boundaries', node: ids.space,
      boundaryIds: [boundaries.stemInner, boundaries.shoulderInner, boundaries.returnInner], openingBoundaryId: boundaries.opening },
    { id: `constraint:${identityPrefix}-ascender-terminal`, type: 'terminal-alignment', node: ids.top, decisionId: ascenderDecisionId }
  ];
  return {
    version: 1, method: H_METHOD,
    parameters: { topology: 'ascender-stem-shoulder-return-open-counter', stemSide: 'left',
      shoulderProfile: 'quadratic-arch-with-return-leg' },
    rootNodeIds: nodes.map(item => item.id), nodes, constraints,
    identity: { stableNodeIds: nodes.map(item => item.id), boundaryIds: Object.values(boundaries),
      topologyComparedWithN: 'one ascender stem; shoulder owns the return leg; open space and its exterior opening are explicit' },
    provenance: provenance ? structuredClone(provenance) : null
  };
}

function fail(messages) { if (messages.length) throw new Error(messages.join(' ')); }
function exactKeys(value, keys, label, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) errors.push(`${label} has unknown or missing fields.`);
}
function hasRelation(item, type, targetId) {
  return item?.relations?.some(relation => relation.type === type && relation.targetId === targetId);
}
function relationTargets(item, type) { return (item?.relations || []).filter(relation => relation.type === type).map(relation => relation.targetId).sort(); }
function sameTargets(item, type, expected) { return relationTargets(item, type).join('|') === [...expected].sort().join('|'); }

/** Validates the bounded h grammar; no contour coordinates are accepted in semantic parameters. */
export function validateHConstruction(glyph, model) {
  const errors = [];
  const construction = glyph?.construction;
  exactKeys(construction, ['version', 'method', 'parameters', 'rootNodeIds', 'nodes', 'constraints', 'identity', 'provenance'], 'construction record', errors);
  if (construction?.version !== 1) errors.push('Unsupported semantic construction record version.');
  exactKeys(construction?.parameters, ['topology', 'stemSide', 'shoulderProfile'], 'construction parameters', errors);
  if (construction?.method !== H_METHOD || construction.parameters?.topology !== 'ascender-stem-shoulder-return-open-counter' ||
      construction.parameters?.stemSide !== 'left' || construction.parameters?.shoulderProfile !== 'quadratic-arch-with-return-leg') {
    errors.push('Unsupported lowercase-h construction topology.');
  }
  const ids = new Set((construction?.nodes || []).map(item => item.id));
  if (ids.size !== construction?.nodes?.length) errors.push('Construction node identities must be unique.');
  if (construction?.nodes?.length !== 18) errors.push('This bounded grammar requires seven anatomy components and eleven boundary identities.');
  const exact = (kind, role = null) => construction?.nodes?.filter(item => item.kind === kind && (role === null || item.role === role)) || [];
  for (const [kind, count] of [['anatomy.stem', 1], ['anatomy.shoulder', 1], ['anatomy.open-space', 1],
    ['anatomy.join', 1], ['anatomy.terminal', 3], ['anatomy.boundary', 11]]) {
    if (exact(kind).length !== count) errors.push(`Construction requires exactly ${count} ${kind} node(s).`);
  }
  const one = (kind, role, label) => {
    const matches = exact(kind, role);
    if (matches.length !== 1) errors.push(`Construction requires exactly one ${label}.`);
    return matches[0];
  };
  const stem = one('anatomy.stem', 'left-ascender-stem', 'left ascender stem');
  const shoulder = one('anatomy.shoulder', 'arched-return', 'arched return shoulder');
  const space = one('anatomy.open-space', 'shoulder-open-counter', 'explicit open counter');
  const join = one('anatomy.join', 'stem-shoulder-attachment', 'stem-to-shoulder join');
  const top = one('anatomy.terminal', 'upper-stem-terminal', 'upper stem terminal');
  const bottom = one('anatomy.terminal', 'lower-stem-terminal', 'lower stem terminal');
  const returnTerminal = one('anatomy.terminal', 'lower-shoulder-return-terminal', 'shoulder return terminal');
  if (exact('anatomy.stem').length !== 1) errors.push('This topology has one semantic stem; its return leg is part of the shoulder component.');
  const boundaries = construction?.nodes?.filter(item => item.kind === 'anatomy.boundary') || [];
  const componentByBoundaryRole = {
    'left-stem-outer-wall': ['anatomy.stem', 'left-ascender-stem'],
    'upper-stem-terminal-edge': ['anatomy.terminal', 'upper-stem-terminal'],
    'stem-shoulder-junction': ['anatomy.join', 'stem-shoulder-attachment'],
    'shoulder-outer-arch': ['anatomy.shoulder', 'arched-return'],
    'shoulder-return-outer-wall': ['anatomy.shoulder', 'arched-return'],
    'shoulder-return-terminal-edge': ['anatomy.terminal', 'lower-shoulder-return-terminal'],
    'open-space-return-wall': ['anatomy.shoulder', 'arched-return'],
    'open-space-shoulder-wall': ['anatomy.shoulder', 'arched-return'],
    'open-space-stem-wall': ['anatomy.stem', 'left-ascender-stem'],
    'lower-stem-terminal-edge': ['anatomy.terminal', 'lower-stem-terminal'],
    'baseline-opening': ['anatomy.open-space', 'shoulder-open-counter']
  };
  if (boundaries.length !== 11) errors.push('Construction requires ten contour boundaries and one baseline opening identity.');
  for (const boundary of boundaries) {
    exactKeys(boundary.parameters, ['ownerId'], `${boundary.id} parameters`, errors);
    const owner = construction?.nodes?.find(item => item.id === boundary.parameters?.ownerId);
    const expectedOwner = componentByBoundaryRole[boundary.role];
    if (!ids.has(boundary.parameters?.ownerId) || !hasRelation(boundary, 'owned-by', boundary.parameters?.ownerId) ||
        !hasRelation(owner, 'owns-boundary', boundary.id) || !expectedOwner ||
        owner?.kind !== expectedOwner[0] || owner?.role !== expectedOwner[1]) {
      errors.push(`${boundary.id}: boundary ownership is missing or contradictory.`);
    }
  }
  const boundaryIds = new Set(boundaries.map(item => item.id));
  if (!stem || !shoulder || !space || !join || !top || !bottom || !returnTerminal) return errors;
  exactKeys(stem.parameters, ['widthDecisionId', 'ascenderDecisionId'], 'stem parameters', errors);
  exactKeys(shoulder.parameters, ['profile', 'xHeightDecisionId', 'ascenderDecisionId', 'outerControlRiseRatio', 'innerEndpointRatio', 'innerControlRiseRatio'], 'shoulder parameters', errors);
  exactKeys(space.parameters, ['boundaryIds', 'openingBoundaryId'], 'open-space parameters', errors);
  for (const terminal of [top, bottom, returnTerminal]) exactKeys(terminal.parameters, ['profile', 'alignmentDecisionId'], `${terminal.id} parameters`, errors);
  if (shoulder.parameters.profile !== 'quadratic-arch-with-return-leg') errors.push('Unsupported shoulder profile.');
  for (const [key, min, max] of [['outerControlRiseRatio', 0.2, 0.8], ['innerEndpointRatio', 0.6, 0.9], ['innerControlRiseRatio', 0.05, 0.4]]) {
    const value = shoulder.parameters[key];
    if (!Number.isFinite(value) || value < min || value > max) errors.push(`Shoulder ${key} is outside the supported range ${min}..${max}.`);
  }
  const decisions = new Map((model?.state?.characteristics || []).map(item => [item.id, item]));
  for (const decisionId of [stem.parameters.widthDecisionId, stem.parameters.ascenderDecisionId,
    shoulder.parameters.xHeightDecisionId, shoulder.parameters.ascenderDecisionId,
    top.parameters.alignmentDecisionId, bottom.parameters.alignmentDecisionId, returnTerminal.parameters.alignmentDecisionId]) {
    if (!decisions.has(decisionId)) errors.push(`Missing construction decision ${decisionId}.`);
  }
  const sharedValue = decisionId => decisions.get(decisionId)?.value?.value;
  if (stem.parameters.widthDecisionId !== 'decision:shared-stem-width') errors.push('The h stem must use the accepted shared stem-width decision.');
  if (shoulder.parameters.xHeightDecisionId !== 'decision:x-height') errors.push('The shoulder must use the accepted shared x-height decision.');
  if (sharedValue(stem.parameters.widthDecisionId) !== 90 || sharedValue(shoulder.parameters.xHeightDecisionId) !== 500 ||
      !Number.isInteger(sharedValue(stem.parameters.ascenderDecisionId)) || sharedValue(stem.parameters.ascenderDecisionId) <= 500) {
    errors.push('Stem, x-height, and ascender dimensions are not valid for this supported construction.');
  }
  if (top.parameters.profile !== 'flat' || bottom.parameters.profile !== 'flat' || returnTerminal.parameters.profile !== 'flat' ||
      top.parameters.alignmentDecisionId !== stem.parameters.ascenderDecisionId ||
      bottom.parameters.alignmentDecisionId !== 'decision:baseline' || returnTerminal.parameters.alignmentDecisionId !== 'decision:baseline') {
    errors.push('The stem and shoulder terminals must use their declared flat ascender/baseline alignment.');
  }
  if (!hasRelation(shoulder, 'attaches-to', stem.id) || !hasRelation(shoulder, 'terminates-at', returnTerminal.id) ||
      !hasRelation(join, 'connects', stem.id) || !hasRelation(join, 'connects', shoulder.id) ||
      !hasRelation(top, 'attaches-to', stem.id) || !hasRelation(bottom, 'attaches-to', stem.id) ||
      !hasRelation(returnTerminal, 'attaches-to', shoulder.id)) errors.push('Stem, shoulder, join, and terminal attachments are incomplete.');
  if (!sameTargets(stem, 'joins', [join.id]) || !sameTargets(stem, 'terminates-at', [top.id, bottom.id]) ||
      !sameTargets(shoulder, 'attaches-to', [stem.id]) || !sameTargets(shoulder, 'joins', [join.id]) ||
      !sameTargets(shoulder, 'terminates-at', [returnTerminal.id]) || !sameTargets(join, 'connects', [stem.id, shoulder.id]) ||
      !sameTargets(top, 'attaches-to', [stem.id]) || !sameTargets(bottom, 'attaches-to', [stem.id]) ||
      !sameTargets(returnTerminal, 'attaches-to', [shoulder.id]) ||
      !sameTargets(top, 'aligned-to', [stem.parameters.ascenderDecisionId]) ||
      !sameTargets(bottom, 'aligned-to', ['decision:baseline']) ||
      !sameTargets(returnTerminal, 'aligned-to', ['decision:baseline'])) {
    errors.push('Stem, shoulder, terminal, and join relationships contain contradictory or duplicate targets.');
  }
  if (shoulder.parameters.ascenderDecisionId !== stem.parameters.ascenderDecisionId ||
      !hasRelation(stem, 'joins', join.id) || !hasRelation(shoulder, 'joins', join.id)) {
    errors.push('Stem/shoulder join relationships or shared ascender dimensions are inconsistent.');
  }
  const referenced = [...(space.parameters.boundaryIds || []), space.parameters.openingBoundaryId];
  const expectedSpaceBoundaryIds = ['open-space-stem-wall', 'open-space-shoulder-wall', 'open-space-return-wall']
    .map(role => boundaries.find(item => item.role === role)?.id);
  if (referenced.length !== 4 || referenced.some(id => !boundaryIds.has(id)) ||
      [...(space.parameters.boundaryIds || [])].sort().join('|') !== expectedSpaceBoundaryIds.sort().join('|') ||
      !sameTargets(space, 'bounded-by', expectedSpaceBoundaryIds) || !sameTargets(space, 'opens-to', [space.parameters.openingBoundaryId]) ||
      !hasRelation(space, 'opens-to', space.parameters.openingBoundaryId) ||
      (space.parameters.boundaryIds || []).some(id => !hasRelation(space, 'bounded-by', id))) {
    errors.push('Open counter boundary ownership or baseline opening is invalid.');
  }
  const opening = boundaries.find(item => item.id === space.parameters.openingBoundaryId);
  if (opening && opening.parameters?.ownerId !== space.id) errors.push('The baseline opening must be owned by the explicit open-space component.');
  const namespace = stem.id.match(/^part:(.+)-ascender-stem$/u)?.[1] || 'h';
  const expectedConstraints = [
    `constraint:${namespace}-stem-shoulder-join`,
    `constraint:${namespace}-open-counter`,
    `constraint:${namespace}-ascender-terminal`
  ];
  if (!Array.isArray(construction.constraints) || construction.constraints.length !== expectedConstraints.length ||
      expectedConstraints.some(id => !construction.constraints.some(item => item.id === id))) errors.push('Required stem/shoulder, open-counter, and terminal constraints are missing.');
  const constraintKinds = new Map((construction.constraints || []).map(item => [item.id, item.type]));
  if (constraintKinds.get(expectedConstraints[0]) !== 'attached-components' ||
      constraintKinds.get(expectedConstraints[1]) !== 'open-space-boundaries' ||
      constraintKinds.get(expectedConstraints[2]) !== 'terminal-alignment') errors.push('Construction constraints do not match the bounded topology contract.');
  if (!construction.identity || construction.identity.stableNodeIds?.length !== construction.nodes.length ||
      construction.identity.boundaryIds?.length !== 11 ||
      construction.identity.stableNodeIds.some(id => !ids.has(id)) ||
      construction.identity.boundaryIds.some(id => !boundaryIds.has(id))) errors.push('Stable semantic identity declarations do not match this construction.');
  if (!construction.provenance || construction.provenance.glyphId !== glyph.id || !construction.provenance.operationId ||
      !construction.provenance.sourceRevisionId || !Array.isArray(construction.provenance.intentIds) || !construction.provenance.intentIds.length) {
    errors.push('Construction provenance must identify its glyph, operation, source revision, and source intents.');
  }
  if (!construction.rootNodeIds?.length || construction.rootNodeIds.some(id => !ids.has(id)) ||
      construction.rootNodeIds.length !== construction.nodes.length) errors.push('Every semantic h component and boundary must have one construction root.');
  const expectedIds = new Set([H_BOUNDARIES.stemOuter, H_BOUNDARIES.stemTop, H_BOUNDARIES.shoulderEntry,
    H_BOUNDARIES.shoulderOuter, H_BOUNDARIES.returnOuter, H_BOUNDARIES.returnBottom,
    H_BOUNDARIES.returnInner, H_BOUNDARIES.shoulderInner, H_BOUNDARIES.stemInner,
    H_BOUNDARIES.stemBottom, H_BOUNDARIES.opening]);
  const suffixIds = new Set([...boundaryIds].map(id => id.replace(/^boundary:[^:]+:/u, 'boundary:h:')));
  if (expectedIds.size !== suffixIds.size || [...expectedIds].some(id => !suffixIds.has(id))) errors.push('Stable semantic boundary identities are missing or unexpected.');
  return errors;
}

export function assertValidHConstruction(glyph, model) {
  const errors = validateHConstruction(glyph, model);
  fail(errors);
  return true;
}

export function cloneConstruction(construction) { return clone(construction); }
