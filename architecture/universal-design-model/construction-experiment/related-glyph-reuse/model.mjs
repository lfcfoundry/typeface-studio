import { createHash } from 'node:crypto';
import { buildLowercaseACandidate } from '../a-experiment.mjs';
import { deriveRelatedGlyph } from './geometry.mjs';

const clone = value => structuredClone(value);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export const COMPONENTS = Object.freeze([
  { id: 'component:round-bowl', kind: 'anatomy.bowl', profile: 'half-ellipse', widthRatio: 0.9, topAlignment: 'x-height', bottomAlignment: 'baseline' },
  { id: 'component:standard-counter', kind: 'anatomy.counter', horizontalInsetRatio: 1, verticalInsetRatio: 1 },
  { id: 'component:primary-stem', kind: 'anatomy.stem', widthDecisionId: 'decision:shared-stem-width' },
  { id: 'component:smooth-join', kind: 'anatomy.join', continuity: 'G1' },
  { id: 'component:flat-terminal', kind: 'anatomy.terminal', profile: 'flat' }
]);

const SPECIFICATIONS = [
  { name: 'a', unicode: 0x0061, stemSide: 'right', stemExtent: 'baseline-to-xHeight' },
  { name: 'b', unicode: 0x0062, stemSide: 'left', stemExtent: 'baseline-to-ascender' },
  { name: 'd', unicode: 0x0064, stemSide: 'right', stemExtent: 'baseline-to-ascender' },
  { name: 'p', unicode: 0x0070, stemSide: 'left', stemExtent: 'descender-to-xHeight' },
  { name: 'q', unicode: 0x0071, stemSide: 'right', stemExtent: 'descender-to-xHeight' }
];

function makeArrangement(spec, referenceA = null) {
  const prefix = referenceA ? 'part:a' : `part:${spec.name}`;
  const ids = referenceA ? {
    bowl: 'part:a-bowl', counter: 'part:a-counter', stem: 'part:a-stem', upperJoin: 'part:a-upper-join', lowerJoin: 'part:a-lower-join',
    upperTerminal: 'part:a-upper-terminal', lowerTerminal: 'part:a-lower-terminal'
  } : Object.fromEntries(['bowl', 'counter', 'stem', 'upperJoin', 'lowerJoin', 'upperTerminal', 'lowerTerminal']
    .map(role => [role, `${prefix}-${role.replace(/[A-Z]/gu, letter => `-${letter.toLowerCase()}`)}`]));
  const makePart = (role, id) => ({ id, role, componentId: ({ bowl: 'component:round-bowl', counter: 'component:standard-counter', stem: 'component:primary-stem',
    upperJoin: 'component:smooth-join', lowerJoin: 'component:smooth-join', upperTerminal: 'component:flat-terminal', lowerTerminal: 'component:flat-terminal' })[role] });
  const parts = Object.fromEntries(Object.entries(ids).map(([role, id]) => [role, makePart(role, id)]));
  return {
    id: `glyph:u${spec.unicode.toString(16).padStart(4, '0')}`, name: spec.name, character: spec.name, unicodes: [spec.unicode], classes: ['letter', 'lowercase'],
    metrics: { advanceWidth: 650, leftSideBearing: 55, rightSideBearing: 55 },
    construction: {
      version: 1, arrangement: 'single-storey-bowl-stem-counter',
      placement: { stemSide: spec.stemSide, stemExtent: spec.stemExtent, bowlTopAlignment: 'x-height', bowlBottomAlignment: 'baseline' },
      parts,
      relationships: [
        { type: 'bowl-attached-to-stem', bowl: 'bowl', stem: 'stem', upperJoin: 'upperJoin', lowerJoin: 'lowerJoin' },
        { type: 'counter-contained-in-bowl', counter: 'counter', bowl: 'bowl' },
        { type: 'counter-closed-by-stem', counter: 'counter', stem: 'stem' },
        { type: 'stem-ended-by-terminals', stem: 'stem', upper: 'upperTerminal', lower: 'lowerTerminal' }
      ]
    }
  };
}

export function createRelatedGlyphExperiment() {
  const reference = buildLowercaseACandidate();
  const referenceGlyph = reference.model.glyphRegistry.glyphs.find(glyph => glyph.id === 'glyph:u0061');
  const aGeometry = reference.model.derived.geometry.glyphs[referenceGlyph.id];
  const acceptedRevisionId = 'rev:related-glyph-a-reference';
  const aSpec = SPECIFICATIONS[0];
  const aArrangement = makeArrangement(aSpec, referenceGlyph);
  return {
    type: 'lfcfoundry.related-glyph-construction-experiment', schemaVersion: 1,
    designId: 'design:related-bowl-stem-glyphs', family: { name: 'LFCFoundry Related Glyph Reuse Experiment', unitsPerEm: 1000 },
    sourceReference: { designId: reference.model.designId, revisionId: reference.model.revisions.headRevisionId, glyphId: referenceGlyph.id },
    components: clone(COMPONENTS),
    sharedParameters: {
      'decision:shared-stem-width': { kind: 'font-units', value: 90 },
      'decision:baseline': { kind: 'font-units', value: 0 },
      'decision:x-height': { kind: 'font-units', value: 500 },
      'decision:ascender-height': { kind: 'font-units', value: 700 },
      'decision:descender-depth': { kind: 'font-units', value: -200 }
    },
    glyphs: [aArrangement],
    derived: { geometry: { sourceRevisionId: acceptedRevisionId, glyphs: { [referenceGlyph.id]: clone(aGeometry) } }, latestDiff: null },
    revisions: { acceptedRevisionId, headRevisionId: acceptedRevisionId, items: [
      { id: acceptedRevisionId, parentRevisionIds: [], status: 'accepted', changedGlyphIds: [referenceGlyph.id], preservedGlyphIds: [], operationIds: [] }
    ] },
    operations: [],
    referenceModel: reference.model
  };
}

export function buildRelatedGlyphCandidate(acceptedModel = createRelatedGlyphExperiment()) {
  const before = JSON.stringify(acceptedModel);
  if (acceptedModel.revisions.headRevisionId !== acceptedModel.revisions.acceptedRevisionId ||
      acceptedModel.revisions.items.find(item => item.id === acceptedModel.revisions.acceptedRevisionId)?.status !== 'accepted') {
    throw new Error('Related glyphs must branch from the accepted lowercase-a reference revision.');
  }
  const candidate = clone(acceptedModel);
  const additions = SPECIFICATIONS.slice(1).map(spec => makeArrangement(spec));
  const existingIds = new Set(candidate.glyphs.map(glyph => glyph.id));
  if (additions.some(glyph => existingIds.has(glyph.id) || candidate.glyphs.some(item => item.unicodes.includes(glyph.unicodes[0])))) {
    throw new Error('The accepted related-glyph registry already contains one of b, d, p, or q.');
  }
  const parentRevisionId = acceptedModel.revisions.acceptedRevisionId;
  const revisionId = `rev:${digest({ parentRevisionId, additions: additions.map(item => item.construction) }).slice(0, 16)}`;
  const operationIds = additions.map(glyph => `op:add-${glyph.name}`);
  const operations = additions.map((glyph, index) => ({
    id: operationIds[index], type: 'construct.glyph.add', glyphId: glyph.id,
    componentIds: Object.values(glyph.construction.parts).map(part => part.componentId),
    provenance: { sourceReferenceRevisionId: acceptedModel.sourceReference.revisionId, constructionModelVersion: 1 },
    status: 'resolved'
  }));
  candidate.glyphs.push(...additions);
  candidate.operations.push(...operations);
  for (const glyph of additions) candidate.derived.geometry.glyphs[glyph.id] = deriveRelatedGlyph(glyph, candidate);
  const changedGlyphIds = additions.map(glyph => glyph.id).sort();
  const preservedGlyphIds = acceptedModel.glyphs.map(glyph => glyph.id).sort();
  const revision = {
    id: revisionId, parentRevisionIds: [parentRevisionId], status: 'candidate',
    changedGlyphIds, preservedGlyphIds, operationIds,
    diff: { addedGlyphs: additions.map(glyph => ({ id: glyph.id, unicode: glyph.unicodes[0], stemSide: glyph.construction.placement.stemSide,
      stemExtent: glyph.construction.placement.stemExtent })) }
  };
  candidate.revisions.items.push(revision);
  candidate.revisions.headRevisionId = revisionId;
  candidate.derived.geometry.sourceRevisionId = revisionId;
  candidate.derived.latestDiff = revision.diff;
  const errors = validateRelatedDesign(candidate);
  if (errors.length) throw new Error(`Related glyph candidate failed validation: ${errors.join(' ')}`);
  if (JSON.stringify(acceptedModel) !== before) throw new Error('Related glyph candidate mutated its accepted input.');
  return { status: 'candidate', acceptedModel, model: candidate, revision, diff: revision.diff };
}

export function validateRelatedDesign(model) {
  const errors = [];
  if (model?.type !== 'lfcfoundry.related-glyph-construction-experiment' || model.schemaVersion !== 1) errors.push('Unsupported related-glyph experiment envelope.');
  const components = new Map((model.components || []).map(item => [item.id, item]));
  const glyphIds = new Set();
  const unicodes = new Set();
  for (const glyph of model.glyphs || []) {
    if (glyphIds.has(glyph.id)) errors.push(`Duplicate glyph ID ${glyph.id}.`);
    glyphIds.add(glyph.id);
    for (const codepoint of glyph.unicodes || []) {
      if (unicodes.has(codepoint)) errors.push(`Duplicate Unicode mapping U+${codepoint.toString(16).toUpperCase()}.`);
      unicodes.add(codepoint);
    }
    const construction = glyph.construction;
    if (construction?.arrangement !== 'single-storey-bowl-stem-counter') errors.push(`${glyph.id}: unsupported arrangement.`);
    if (!['left', 'right'].includes(construction?.placement?.stemSide)) errors.push(`${glyph.id}: stem side must be explicit.`);
    if (!['baseline-to-xHeight', 'baseline-to-ascender', 'descender-to-xHeight'].includes(construction?.placement?.stemExtent)) errors.push(`${glyph.id}: stem extent must be explicit.`);
    const parts = construction?.parts || {};
    for (const role of ['bowl', 'counter', 'stem', 'upperJoin', 'lowerJoin', 'upperTerminal', 'lowerTerminal']) {
      if (!parts[role] || !components.has(parts[role].componentId)) errors.push(`${glyph.id}: missing or unknown ${role} component.`);
    }
    for (const relation of construction?.relationships || []) {
      const refs = Object.entries(relation).filter(([key, value]) => key !== 'type' && typeof value === 'string').map(([, value]) => value);
      for (const ref of refs) if (!Object.hasOwn(parts, ref)) errors.push(`${glyph.id}: relationship ${relation.type} references unknown part ${ref}.`);
    }
  }
  const params = model.sharedParameters || {};
  for (const id of ['decision:shared-stem-width', 'decision:baseline', 'decision:x-height', 'decision:ascender-height', 'decision:descender-depth']) {
    if (!Number.isInteger(params[id]?.value)) errors.push(`Missing integer shared parameter ${id}.`);
  }
  if (params['decision:shared-stem-width']?.value <= 0) errors.push('Shared stem width must be positive.');
  return errors;
}

export { digest as relatedModelDigest };
