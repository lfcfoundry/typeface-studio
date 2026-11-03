import {
  arabicHorizontalRtl, japaneseVerticalMixedOrientation, latinHorizontalLtr,
  mixedDirectionParagraph, mongolianVerticalLtrColumns
} from './writing-context.fixtures.mjs';

const glyphDefinitions = [
  ['glyph:f', 'f', [0x0066]], ['glyph:i', 'i', [0x0069]], ['glyph:fi', 'fi', []],
  ['glyph:A', 'A', [0x0041]], ['glyph:A.vrt', 'A.vrt', []],
  ['glyph:beh', 'beh', [0x0628]], ['glyph:beh.init', 'beh.init', []], ['glyph:beh.medi', 'beh.medi', []], ['glyph:beh.fina', 'beh.fina', []],
  ['glyph:lam', 'lam', [0x0644]], ['glyph:alef', 'alef', [0x0627]], ['glyph:lam_alef', 'lam_alef', []],
  ['glyph:uni65E5', 'uni65E5', [0x65e5]], ['glyph:uni3001', 'uni3001', [0x3001]], ['glyph:uni3001.vert', 'uni3001.vert', []],
  ['glyph:uni1820', 'uni1820', [0x1820]]
].map(([id, name, unicodes]) => ({ id, name, unicodes }));

const feature = (tag, status = 'supported') => ({ tag, status });
const script = (scriptTag, languages, writingModes, supportedDirections, features, shapingCapabilities = []) => ({
  scriptTag, languages, writingModes, supportedDirections, features, shapingCapabilities
});
const hMetric = (glyphId, advance = 600) => ({ glyphId, horizontal: { advance, startSideBearing: 40, endSideBearing: 40 } });
const vMetric = (glyphId, advanceHeight = 1000) => ({ glyphId, vertical: { advanceHeight, topSideBearing: 70, origin: { x: 500, y: 880 } } });
const combineMetrics = records => [...records.reduce((byGlyph, record) => {
  byGlyph.set(record.glyphId, { ...byGlyph.get(record.glyphId), ...record });
  return byGlyph;
}, new Map()).values()];
const mapping = codePoint => {
  const glyph = glyphDefinitions.find(item => item.unicodes.includes(codePoint));
  return glyph ? { codePoint, glyphId: glyph.id } : null;
};
const rule = (id, featureTag, inputGlyphIds, outputGlyphIds, scriptTag) => ({
  id, kind: 'single-substitution', scriptTag, languageTags: ['ja'], featureTag, inputGlyphIds, backtrack: [], lookahead: [], outputGlyphIds, lookupOrder: 10
});

const commonRules = [
  { id: 'rule:fi-liga', kind: 'ligature-substitution', scriptTag: 'Latn', languageTags: ['en'], featureTag: 'liga', inputGlyphIds: ['glyph:f', 'glyph:i'], backtrack: [], lookahead: [], outputGlyphIds: ['glyph:fi'], lookupOrder: 10 },
  { id: 'rule:arabic-beh-init', kind: 'contextual-substitution', scriptTag: 'Arab', languageTags: ['ar'], featureTag: 'init', inputGlyphIds: ['glyph:beh'], backtrack: [], lookahead: [{ class: 'joining-neighbor' }], outputGlyphIds: ['glyph:beh.init'], lookupOrder: 10 },
  { id: 'rule:arabic-beh-medi', kind: 'contextual-substitution', scriptTag: 'Arab', languageTags: ['ar'], featureTag: 'medi', inputGlyphIds: ['glyph:beh'], backtrack: [{ class: 'joining-neighbor' }], lookahead: [{ class: 'joining-neighbor' }], outputGlyphIds: ['glyph:beh.medi'], lookupOrder: 20 },
  { id: 'rule:arabic-beh-fina', kind: 'contextual-substitution', scriptTag: 'Arab', languageTags: ['ar'], featureTag: 'fina', inputGlyphIds: ['glyph:beh'], backtrack: [{ class: 'joining-neighbor' }], lookahead: [], outputGlyphIds: ['glyph:beh.fina'], lookupOrder: 30 },
  { id: 'rule:arabic-lam-alef', kind: 'ligature-substitution', scriptTag: 'Arab', languageTags: ['ar'], featureTag: 'rlig', inputGlyphIds: ['glyph:lam', 'glyph:alef'], backtrack: [], lookahead: [], outputGlyphIds: ['glyph:lam_alef'], lookupOrder: 40 },
  rule('rule:uni3001-vert', 'vert', ['glyph:uni3001'], ['glyph:uni3001.vert'], 'Hani'),
  rule('rule:A-vrt2', 'vrt2', ['glyph:A'], ['glyph:A.vrt'], 'Latn')
];

export const acceptedDesignSnapshot = {
  designId: 'design:shaping-adapter-fixture',
  revisionId: 'rev:accepted-1',
  status: 'accepted',
  validationStatus: 'valid',
  familyName: 'Shaping Adapter Fixture',
  fontArtifactId: null,
  variationAxes: [],
  writingSupport: {
    version: 1,
    unicodeDataVersion: '18.0.0',
    scripts: [
      script('Latn', ['en', 'ja'], ['horizontal', 'vertical'], ['ltr', 'rtl'], [feature('liga'), feature('vrt2')]),
      script('Arab', ['ar'], ['horizontal'], ['rtl', 'ltr'], [feature('init'), feature('medi'), feature('fina'), feature('rlig'), feature('calt')], ['contextual-joining']),
      script('Hani', ['ja'], ['horizontal', 'vertical'], ['ltr', 'ttb'], [feature('vert')]),
      script('Mong', ['mn'], ['vertical'], ['ttb', 'btt'], [feature('rlig'), feature('calt')], ['contextual-joining'])
    ],
    glyphs: glyphDefinitions,
    characterMappings: [0x0066, 0x0069, 0x0041, 0x0628, 0x0644, 0x0627, 0x65e5, 0x3001, 0x1820].map(mapping),
    variationMappings: [],
    glyphForms: [
      { glyphId: 'glyph:A.vrt', formOfGlyphId: 'glyph:A', semanticConstructionId: 'construction:A', presentation: { writingMode: 'vertical', orientation: 'sideways-clockwise', scriptTags: ['Latn'] } },
      { glyphId: 'glyph:uni3001.vert', formOfGlyphId: 'glyph:uni3001', semanticConstructionId: 'construction:uni3001', presentation: { writingMode: 'vertical', orientation: 'upright', scriptTags: ['Hani'] } }
    ],
    glyphMetrics: combineMetrics([
      hMetric('glyph:f'), hMetric('glyph:i'), hMetric('glyph:fi'), hMetric('glyph:A'), hMetric('glyph:beh'), hMetric('glyph:lam'), hMetric('glyph:alef'),
      hMetric('glyph:uni65E5'), hMetric('glyph:uni3001'),
      vMetric('glyph:A'), vMetric('glyph:A.vrt'), vMetric('glyph:uni65E5'), vMetric('glyph:uni3001'), vMetric('glyph:uni3001.vert'), vMetric('glyph:uni1820')
    ]),
    shapingRules: { substitutions: commonRules, positioning: [], ordering: [] }
  }
};

export const latinRequestContext = structuredClone(latinHorizontalLtr.layoutContext);
latinRequestContext.text = 'fi';
latinRequestContext.runs = [{ id: 'run:latin-fi', sourceRange: { unit: 'utf16', start: 0, end: 2 }, sourceClusters: [
  { clusterId: 'source:f', sourceRange: { unit: 'utf16', start: 0, end: 1 } }, { clusterId: 'source:i', sourceRange: { unit: 'utf16', start: 1, end: 2 } }
], scriptTag: 'Latn', languageTag: 'en', direction: 'ltr', directionSource: 'explicit', orientationPolicy: { mode: 'horizontal-default' }, features: [{ tag: 'liga', value: 1 }], variations: [] }];

export const arabicRequestContext = structuredClone(arabicHorizontalRtl.layoutContext);
arabicRequestContext.runs[0].directionSource = 'explicit';
arabicRequestContext.runs[0].sourceClusters = [
  { clusterId: 'source:beh', sourceRange: { unit: 'utf16', start: 0, end: 1 } },
  { clusterId: 'source:lam', sourceRange: { unit: 'utf16', start: 1, end: 2 } },
  { clusterId: 'source:alef', sourceRange: { unit: 'utf16', start: 2, end: 3 } }
];
arabicRequestContext.runs[0].features = [{ tag: 'init', value: 1 }, { tag: 'medi', value: 1 }, { tag: 'fina', value: 1 }, { tag: 'rlig', value: 1 }, { tag: 'calt', value: 1 }];
arabicRequestContext.runs[0].requiredShapingCapabilities = ['contextual-joining'];

export const mixedResolvedContext = structuredClone(mixedDirectionParagraph.layoutContext);
mixedResolvedContext.text = 'Aب';
mixedResolvedContext.paragraph.bidiResolution = { status: 'resolved', algorithm: 'UAX9', unicodeVersion: '18.0.0', resolverId: 'fixture:upstream-bidi' };
mixedResolvedContext.runs = [
  { id: 'run:mixed-latin', sourceRange: { unit: 'utf16', start: 0, end: 1 }, sourceClusters: [{ clusterId: 'source:mixed-A', sourceRange: { unit: 'utf16', start: 0, end: 1 } }], scriptTag: 'Latn', languageTag: 'en', direction: 'ltr', directionSource: 'bidi-resolution', orientationPolicy: { mode: 'horizontal-default' }, features: [], variations: [] },
  { id: 'run:mixed-arabic', sourceRange: { unit: 'utf16', start: 1, end: 2 }, sourceClusters: [{ clusterId: 'source:mixed-beh', sourceRange: { unit: 'utf16', start: 1, end: 2 } }], scriptTag: 'Arab', languageTag: 'ar', direction: 'rtl', directionSource: 'bidi-resolution', orientationPolicy: { mode: 'horizontal-default' }, features: [{ tag: 'init', value: 1 }, { tag: 'medi', value: 1 }, { tag: 'fina', value: 1 }, { tag: 'rlig', value: 1 }, { tag: 'calt', value: 1 }], variations: [], requiredShapingCapabilities: ['contextual-joining'] }
];

export const japaneseRequestContext = structuredClone(japaneseVerticalMixedOrientation.layoutContext);
japaneseRequestContext.runs[0].features = [{ tag: 'vert', value: 1 }];
japaneseRequestContext.runs[0].variations = [];
japaneseRequestContext.runs[0].sourceClusters = [{ clusterId: 'source:japan-1', sourceRange: { unit: 'utf16', start: 0, end: 1 } }];
japaneseRequestContext.runs[1].features = [{ tag: 'vrt2', value: 1 }];
japaneseRequestContext.runs[1].variations = [];
japaneseRequestContext.runs[1].sourceClusters = [{ clusterId: 'source:japan-A', sourceRange: { unit: 'utf16', start: 1, end: 2 } }];
japaneseRequestContext.runs[2].features = [{ tag: 'vert', value: 1 }];
japaneseRequestContext.runs[2].variations = [];
japaneseRequestContext.runs[2].sourceClusters = [{ clusterId: 'source:japan-comma', sourceRange: { unit: 'utf16', start: 2, end: 3 } }];

export const mongolianRequestContext = structuredClone(mongolianVerticalLtrColumns.layoutContext);
mongolianRequestContext.runs[0].variations = [];
mongolianRequestContext.runs[0].sourceClusters = [{ clusterId: 'source:mongolian-a', sourceRange: { unit: 'utf16', start: 0, end: 1 } }];
mongolianRequestContext.runs[0].requiredShapingCapabilities = ['contextual-joining'];

export const unresolvedMixedContext = structuredClone(mixedResolvedContext);
delete unresolvedMixedContext.paragraph.bidiResolution;
unresolvedMixedContext.runs[1].direction = 'auto';
unresolvedMixedContext.runs[1].directionSource = 'unresolved';

export const horizontalJapaneseContext = {
  version: 1,
  id: 'context:japanese-horizontal',
  text: '日、',
  paragraph: { baseDirection: 'ltr', writingMode: 'horizontal', blockProgression: 'top-to-bottom' },
  runs: [{ id: 'run:japanese-horizontal', sourceRange: { unit: 'utf16', start: 0, end: 2 }, scriptTag: 'Hani', languageTag: 'ja', direction: 'ltr', directionSource: 'explicit', orientationPolicy: { mode: 'horizontal-default' }, features: [], variations: [] }]
};

export const contextFixtures = { latinRequestContext, arabicRequestContext, mixedResolvedContext, japaneseRequestContext, mongolianRequestContext };
