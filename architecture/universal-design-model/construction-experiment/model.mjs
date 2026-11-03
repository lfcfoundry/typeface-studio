import { createHash } from 'node:crypto';
import { validateTerminalProfileRecord } from './terminal-profile-record.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const decision = (id, property, value, selectorId = 'sel:family') => ({
  id, property, value: { kind: 'font-units', value }, selectorId, origin: 'explicit', certainty: 1,
  acceptance: 'accepted', capability: 'implemented', sourceIntentIds: [], dependencyIds: []
});

function node(id, kind, role, parameters = {}, relations = []) {
  return { id, kind, role, parameters, relations };
}

function glyph(id, name, unicode, classes, method, nodes, roots, metrics) {
  return {
    id, name, character: name, unicodes: [unicode], classes,
    construction: { version: 1, method, rootNodeIds: roots, nodes, constraints: [] },
    metrics: { advanceWidth: metrics.advanceWidth, leftSideBearing: metrics.leftSideBearing, rightSideBearing: metrics.rightSideBearing }
  };
}

export function createSemanticDesign() {
  const stemDecisionId = 'decision:shared-stem-width';
  const xHeightDecisionId = 'decision:x-height';
  const capHeightDecisionId = 'decision:cap-height';
  const glyphs = [
    glyph('glyph:u006f', 'o', 0x006f, ['letter', 'lowercase', 'round'], 'construction.ring-from-bowl-counter', [
      node('part:o-bowl', 'anatomy.bowl', 'positive-form', { profile: 'ellipse', overshoot: 8, xHeightDecisionId }, [
        { type: 'aligned-to', targetId: xHeightDecisionId }, { type: 'uses-parameter', targetId: stemDecisionId }
      ]),
      node('part:o-counter', 'anatomy.counter', 'negative-space', { scale: 0.78 }, [
        { type: 'contained-by', targetId: 'part:o-bowl' }, { type: 'concentric-with', targetId: 'part:o-bowl' }, { type: 'uses-parameter', targetId: stemDecisionId }
      ])
    ], ['part:o-bowl', 'part:o-counter'], { advanceWidth: 620, leftSideBearing: 55, rightSideBearing: 55 }),
    glyph('glyph:u006e', 'n', 0x006e, ['letter', 'lowercase'], 'construction.connected-stems-and-shoulder', [
      node('part:n-left-stem', 'anatomy.stem', 'left-vertical', { widthDecisionId: stemDecisionId }, [
        { type: 'joins', targetId: 'part:n-left-join' }
      ]),
      node('part:n-right-stem', 'anatomy.stem', 'right-vertical', { widthDecisionId: stemDecisionId }, [
        { type: 'joins', targetId: 'part:n-right-join' }
      ]),
      node('part:n-shoulder', 'anatomy.shoulder', 'arched-bridge', { xHeightDecisionId, riseRatio: 0.44, innerApertureRatio: 0.58 }, [
        { type: 'connects', targetId: 'part:n-left-stem' }, { type: 'connects', targetId: 'part:n-right-stem' }
      ]),
      node('part:n-left-join', 'anatomy.join', 'left-shoulder-join', {}, [{ type: 'attaches-to', targetId: 'part:n-shoulder' }]),
      node('part:n-right-join', 'anatomy.join', 'right-shoulder-join', {}, [{ type: 'attaches-to', targetId: 'part:n-shoulder' }])
    ], ['part:n-left-stem', 'part:n-right-stem', 'part:n-shoulder'], { advanceWidth: 650, leftSideBearing: 55, rightSideBearing: 55 }),
    glyph('glyph:u0048', 'H', 0x0048, ['letter', 'uppercase'], 'construction.parallel-stems-and-crossbar', [
      node('part:H-left-stem', 'anatomy.stem', 'left-vertical', { widthDecisionId: stemDecisionId, capHeightDecisionId }, [
        { type: 'aligned-to', targetId: capHeightDecisionId }, { type: 'joins', targetId: 'part:H-crossbar' }
      ]),
      node('part:H-right-stem', 'anatomy.stem', 'right-vertical', { widthDecisionId: stemDecisionId, capHeightDecisionId }, [
        { type: 'aligned-to', targetId: capHeightDecisionId }, { type: 'joins', targetId: 'part:H-crossbar' }
      ]),
      node('part:H-crossbar', 'anatomy.crossbar', 'horizontal-middle', { thicknessDecisionId: stemDecisionId, centerRatio: 367 / 700 }, [
        { type: 'connects', targetId: 'part:H-left-stem' }, { type: 'connects', targetId: 'part:H-right-stem' }
      ])
    ], ['part:H-left-stem', 'part:H-right-stem', 'part:H-crossbar'], { advanceWidth: 650, leftSideBearing: 55, rightSideBearing: 55 })
  ];

  const model = {
    type: 'lfcfoundry.universal-typeface-design', schemaVersion: 2, designId: 'design:semantic-latin-vertical-slice',
    family: { name: 'LFCFoundry Semantic Construction Experiment', unitsPerEm: 1000 },
    input: { brief: 'A compact semantic construction experiment for o, n, and H.', language: 'en', messages: [] },
    intent: { statements: [] },
    state: { characteristics: [
      decision(stemDecisionId, 'stroke.primary-width', 90),
      decision(xHeightDecisionId, 'proportion.x-height', 500),
      decision(capHeightDecisionId, 'proportion.cap-height', 700)
    ], constraints: [], decisions: [stemDecisionId, xHeightDecisionId, capHeightDecisionId] },
    glyphRegistry: { revisionId: 'rev:semantic-base', glyphs },
    selectors: [], operations: [],
    revisions: { acceptedRevisionId: 'rev:semantic-base', headRevisionId: 'rev:semantic-base', items: [
      { id: 'rev:semantic-base', parentRevisionIds: [], status: 'accepted', decisionIds: [stemDecisionId, xHeightDecisionId, capHeightDecisionId], operationIds: [], changedGlyphIds: glyphs.map(item => item.id), preservedDecisionIds: [] }
    ] },
    derived: { geometry: null, fontArtifacts: [], validation: [] },
    constructionEngine: { version: 1, coordinateUnit: 'font-units', supportedMethods: [
      'construction.ring-from-bowl-counter', 'construction.connected-stems-and-shoulder', 'construction.parallel-stems-and-crossbar',
      'construction.bowl-with-attached-stem'
    ] }
  };
  model.derived.geometry = { representation: 'quadratic-contours', sourceRevisionId: model.glyphRegistry.revisionId, generatorVersion: 'semantic-construction-v1', glyphs: {} };
  return model;
}

export function constructionHash(construction) { return hash(construction); }

export function validateSemanticDesign(model) {
  const errors = [];
  if (model?.type !== 'lfcfoundry.universal-typeface-design' || model.schemaVersion !== 2) errors.push('Expected the universal design model v2 envelope.');
  if (!Number.isInteger(model?.family?.unitsPerEm) || model.family.unitsPerEm <= 0) errors.push('Family unitsPerEm must be a positive integer.');
  const decisionIds = new Set((model?.state?.characteristics || []).map(item => item.id));
  const glyphs = model?.glyphRegistry?.glyphs || [];
  const glyphIds = new Set(glyphs.map(item => item.id));
  if (glyphIds.size !== glyphs.length) errors.push('Glyph IDs must be unique.');
  for (const item of glyphs) {
    const construction = item.construction;
    const nodes = construction?.nodes || [];
    const nodeIds = new Set(nodes.map(part => part.id));
    if (construction?.version !== 1 || !model.constructionEngine?.supportedMethods?.includes(construction.method)) errors.push(`${item.id}: unsupported or missing construction method.`);
    if (!construction?.rootNodeIds?.length || construction.rootNodeIds.some(id => !nodeIds.has(id))) errors.push(`${item.id}: construction roots must reference anatomy nodes.`);
    if (nodeIds.size !== nodes.length) errors.push(`${item.id}: anatomy node IDs must be unique.`);
    for (const part of nodes) for (const relation of part.relations || []) {
      const parameterRelation = ['uses-parameter', 'aligned-to'].includes(relation.type) && decisionIds.has(relation.targetId);
      const nodeRelation = nodeIds.has(relation.targetId);
      if (!parameterRelation && !nodeRelation) errors.push(`${item.id}/${part.id}: dangling ${relation.type} relation to ${relation.targetId}.`);
    }
    for (const part of nodes) for (const key of ['widthDecisionId', 'xHeightDecisionId', 'capHeightDecisionId', 'thicknessDecisionId']) {
      if (part.parameters?.[key] && !decisionIds.has(part.parameters[key])) errors.push(`${item.id}/${part.id}: missing parameter decision ${part.parameters[key]}.`);
    }
    for (const part of nodes) if (part.kind === 'anatomy.crossbar' && (!Number.isFinite(part.parameters?.centerRatio) || part.parameters.centerRatio < 0.45 || part.parameters.centerRatio > 0.55)) {
      errors.push(`${item.id}/${part.id}: crossbar center ratio must be within the supported 0.45–0.55 range.`);
    }
    if (construction?.method === 'construction.bowl-with-attached-stem') {
      const topology = construction.parameters?.topology;
      const bowl = nodes.find(part => part.kind === 'anatomy.bowl' && part.role === 'attached-bowl');
      const counter = nodes.find(part => part.kind === 'anatomy.counter' && part.role === 'bowl-counter');
      const stem = nodes.find(part => part.kind === 'anatomy.stem' && part.role === 'attached-vertical');
      const joins = nodes.filter(part => part.kind === 'anatomy.join');
      const terminals = nodes.filter(part => part.kind === 'anatomy.terminal');
      const upperTerminal = terminals.find(part => part.role === 'upper-stem-terminal');
      const lowerTerminal = terminals.find(part => part.role === 'lower-stem-terminal');
      if (topology !== 'single-storey') errors.push(`${item.id}: bowl-with-attached-stem requires an explicit single-storey topology decision.`);
      if (construction.parameters?.stemSide !== 'right') errors.push(`${item.id}: bowl-with-attached-stem requires an explicit right-side stem in this experiment.`);
      if (!bowl || !counter || !stem || joins.length !== 2 || terminals.length !== 2) errors.push(`${item.id}: bowl-with-attached-stem requires a bowl, counter, attached stem, two joins, and two terminals.`);
      if (bowl && (bowl.parameters?.profile !== 'left-half-ellipse' || !decisionIds.has(bowl.parameters?.xHeightDecisionId) ||
          !Number.isFinite(bowl.parameters?.widthRatio) || bowl.parameters.widthRatio <= 0 || bowl.parameters.widthRatio > 1.2)) {
        errors.push(`${item.id}: attached bowl requires a valid x-height decision and positive width ratio.`);
      }
      if (stem && !decisionIds.has(stem.parameters?.widthDecisionId)) errors.push(`${item.id}: attached stem must reference a shared width decision.`);
      if (counter && (!Number.isFinite(counter.parameters?.horizontalInsetRatio) || counter.parameters.horizontalInsetRatio <= 0 ||
        !Number.isFinite(counter.parameters?.verticalInsetRatio) || counter.parameters.verticalInsetRatio <= 0)) {
        errors.push(`${item.id}: bowl counter requires positive horizontal and vertical inset ratios.`);
      }
      if (!upperTerminal || !lowerTerminal) errors.push(`${item.id}: the construction requires one upper and one lower stem terminal.`);
      for (const terminal of [upperTerminal, lowerTerminal].filter(Boolean)) {
        const profile = terminal.parameters?.profile;
        const profileErrors = validateTerminalProfileRecord(terminal.parameters);
        const allowedKeys = profile === 'flat'
          ? ['profile', 'alignmentDecisionId']
          : profile === 'chamfered' && terminal.role === 'upper-stem-terminal'
            ? ['profile', 'alignmentDecisionId', 'orientation', 'cutRatio']
            : [];
        if (!allowedKeys.length || Object.keys(terminal.parameters || {}).some(key => !allowedKeys.includes(key))) {
          errors.push(`${item.id}/${terminal.id}: unsupported terminal profile or parameter.`);
          for (const message of profileErrors) errors.push(`${item.id}/${terminal.id}: ${message}`);
          continue;
        }
        for (const message of profileErrors) errors.push(`${item.id}/${terminal.id}: ${message}`);
        const alignmentId = terminal.parameters.alignmentDecisionId;
        if (!decisionIds.has(alignmentId) || !terminal.relations?.some(relation => relation.type === 'aligned-to' && relation.targetId === alignmentId)) {
          errors.push(`${item.id}/${terminal.id}: terminal alignment must reference its declared design decision.`);
        }
        if (stem && !terminal.relations?.some(relation => relation.type === 'attaches-to' && relation.targetId === stem.id)) {
          errors.push(`${item.id}/${terminal.id}: terminal must remain attached to the construction stem.`);
        }
        if (profile === 'chamfered' && profileErrors.length === 0) {
          const cutRatio = terminal.parameters.cutRatio;
          const stemWidth = stem && model.state.characteristics.find(value => value.id === stem.parameters.widthDecisionId)?.value?.value;
          const cut = Number.isFinite(stemWidth) && Number.isFinite(cutRatio) ? Math.floor(stemWidth * cutRatio) : 0;
          if (cut < 1) {
            errors.push(`${item.id}/${terminal.id}: chamfered upper terminals require a cutRatio yielding at least one font unit for this stem width.`);
          }
        }
      }
      for (const [join, terminal] of [[joins.find(part => part.role === 'upper-bowl-stem'), upperTerminal], [joins.find(part => part.role === 'lower-bowl-stem'), lowerTerminal]]) {
        if (join && terminal && !join.relations?.some(relation => relation.type === 'attaches-to' && relation.targetId === terminal.id)) {
          errors.push(`${item.id}/${join.id}: stem join must retain its terminal attachment.`);
        }
      }
    }
    const metric = item.metrics;
    if (!Number.isInteger(item.unicodes?.[0]) || !metric || !Number.isInteger(metric.advanceWidth) || !Number.isInteger(metric.leftSideBearing) || !Number.isInteger(metric.rightSideBearing)) errors.push(`${item.id}: Unicode identity and integer horizontal metrics are required.`);
  }
  if (!model.revisions?.items?.some(item => item.id === model.revisions.acceptedRevisionId && item.status === 'accepted')) errors.push('An accepted base revision is required.');
  return errors;
}
