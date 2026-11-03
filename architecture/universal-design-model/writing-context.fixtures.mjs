// Architecture-only examples for writingSupport v1 and layout request v1.
// They do not assert that the current application can shape or render them.
const glyphs = [
  { id: 'glyph:notdef', name: '.notdef', unicodes: [] },
  { id: 'glyph:a', name: 'a', unicodes: [0x0061] },
  { id: 'glyph:A', name: 'A', unicodes: [0x0041] },
  { id: 'glyph:f', name: 'f', unicodes: [0x0066] },
  { id: 'glyph:i', name: 'i', unicodes: [0x0069] },
  { id: 'glyph:fi', name: 'fi', unicodes: [] },
  { id: 'glyph:beh', name: 'arabic-beh', unicodes: [0x0628] },
  { id: 'glyph:beh.init', name: 'arabic-beh.init', unicodes: [] },
  { id: 'glyph:beh.medi', name: 'arabic-beh.medi', unicodes: [] },
  { id: 'glyph:beh.fina', name: 'arabic-beh.fina', unicodes: [] },
  { id: 'glyph:lam', name: 'arabic-lam', unicodes: [0x0644] },
  { id: 'glyph:alef', name: 'arabic-alef', unicodes: [0x0627] },
  { id: 'glyph:lam_alef', name: 'arabic-lam_alef', unicodes: [] },
  { id: 'glyph:uni65E5', name: 'uni65E5', unicodes: [0x65e5] },
  { id: 'glyph:comma', name: 'comma', unicodes: [0x002c] },
  { id: 'glyph:comma.vert', name: 'comma.vert', unicodes: [] },
  { id: 'glyph:uni3001', name: 'uni3001', unicodes: [0x3001] },
  { id: 'glyph:uni3001.vert', name: 'uni3001.vert', unicodes: [] },
  { id: 'glyph:uni1820', name: 'uni1820', unicodes: [0x1820] }
];

const baseSupport = (scripts = [], codePoints = []) => ({
  version: 1,
  unicodeDataVersion: '18.0.0',
  scripts,
  glyphs,
  characterMappings: glyphs.flatMap(glyph => glyph.unicodes.filter(codePoint => codePoints.includes(codePoint)).map(codePoint => ({ codePoint, glyphId: glyph.id }))),
  variationMappings: [],
  glyphForms: [],
  glyphMetrics: [],
  metricFallback: { vertical: 'unresolved-until-policy-selected' },
  shapingRules: { substitutions: [], positioning: [], ordering: [] }
});

const script = (scriptTag, languages, writingModes, supportedDirections, orientationProperty = false) => ({
  scriptTag, languages, writingModes, supportedDirections,
  ...(orientationProperty ? { orientationData: { property: 'Vertical_Orientation', version: '18.0.0' } } : {})
});

const context = ({ id, text, writingMode, blockProgression, baseDirection, runs, orientationPolicy = { mode: 'horizontal-default' } }) => ({
  version: 1, id, text,
  paragraph: { writingMode, blockProgression, baseDirection, bidiAlgorithm: { name: 'UAX9', unicodeVersion: '18.0.0' } },
  runs: runs.map((run, index) => ({
    id: run.id || `run:${index + 1}`,
    sourceRange: run.sourceRange,
    scriptTag: run.scriptTag,
    languageTag: run.languageTag,
    direction: run.direction,
    directionSource: run.directionSource || 'explicit',
    orientationPolicy: run.orientationPolicy || orientationPolicy,
    features: run.features || []
  }))
});

export const latinHorizontalLtr = {
  writingSupport: baseSupport([script('Latn', ['en'], ['horizontal'], ['ltr', 'rtl'])]),
  layoutContext: context({ id: 'context:latin-ltr', text: 'Typeface', writingMode: 'horizontal', blockProgression: 'top-to-bottom', baseDirection: 'ltr',
    runs: [{ sourceRange: { unit: 'utf16', start: 0, end: 8 }, scriptTag: 'Latn', languageTag: 'en', direction: 'ltr' }] })
};

export const arabicHorizontalRtl = {
  writingSupport: (() => {
    const support = baseSupport([script('Arab', ['ar'], ['horizontal'], ['rtl', 'ltr'])], [0x0628, 0x0644, 0x0627]);
    support.shapingRules.substitutions.push(
      { id: 'rule:arabic-beh-initial', kind: 'contextual-substitution', scriptTag: 'Arab', languageTags: ['ar'], featureTag: 'init', inputGlyphIds: ['glyph:beh'], backtrack: [], lookahead: [{ class: 'joining-right-or-dual' }], outputGlyphIds: ['glyph:beh.init'], lookupOrder: 10 },
      { id: 'rule:arabic-beh-medial', kind: 'contextual-substitution', scriptTag: 'Arab', languageTags: ['ar'], featureTag: 'medi', inputGlyphIds: ['glyph:beh'], backtrack: [{ class: 'joining-left-or-dual' }], lookahead: [{ class: 'joining-right-or-dual' }], outputGlyphIds: ['glyph:beh.medi'], lookupOrder: 20 },
      { id: 'rule:arabic-beh-final', kind: 'contextual-substitution', scriptTag: 'Arab', languageTags: ['ar'], featureTag: 'fina', inputGlyphIds: ['glyph:beh'], backtrack: [{ class: 'joining-left-or-dual' }], lookahead: [], outputGlyphIds: ['glyph:beh.fina'], lookupOrder: 30 },
      { id: 'rule:arabic-lam-alef', kind: 'ligature-substitution', scriptTag: 'Arab', languageTags: ['ar'], featureTag: 'rlig', inputGlyphIds: ['glyph:lam', 'glyph:alef'], backtrack: [], lookahead: [], outputGlyphIds: ['glyph:lam_alef'], lookupOrder: 40 }
    );
    return support;
  })(),
  layoutContext: context({ id: 'context:arabic-rtl', text: 'بلا', writingMode: 'horizontal', blockProgression: 'top-to-bottom', baseDirection: 'rtl',
    runs: [{ sourceRange: { unit: 'utf16', start: 0, end: 3 }, scriptTag: 'Arab', languageTag: 'ar', direction: 'rtl', directionSource: 'bidi-resolution', features: [{ tag: 'rlig', value: 1 }, { tag: 'calt', value: 1 }] }] })
};

export const japaneseVerticalMixedOrientation = {
  writingSupport: (() => {
    const support = baseSupport([
      script('Hani', ['ja'], ['horizontal', 'vertical'], ['ltr', 'ttb'], true),
      script('Hira', ['ja'], ['horizontal', 'vertical'], ['ltr', 'ttb'], true),
      script('Kana', ['ja'], ['horizontal', 'vertical'], ['ltr', 'ttb'], true),
      script('Latn', ['ja'], ['horizontal', 'vertical'], ['ltr', 'rtl'])
    ], [0x65e5, 0x0041, 0x3001]);
    support.glyphForms.push({ glyphId: 'glyph:uni3001.vert', formOfGlyphId: 'glyph:uni3001', semanticConstructionId: 'construction:ideographic-comma',
      presentation: { writingMode: 'vertical', orientation: 'upright', scriptTags: ['Hani'] } });
    support.shapingRules.substitutions.push({ id: 'rule:ideographic-comma-vertical', kind: 'single-substitution', scriptTag: 'Hani', languageTags: ['ja'], featureTag: 'vert',
      inputGlyphIds: ['glyph:uni3001'], backtrack: [], lookahead: [], outputGlyphIds: ['glyph:uni3001.vert'], lookupOrder: 10 });
    return support;
  })(),
  layoutContext: context({ id: 'context:japanese-vertical', text: '日A、', writingMode: 'vertical', blockProgression: 'right-to-left', baseDirection: 'auto',
    orientationPolicy: { mode: 'unicode-vertical-orientation', unicodeVersion: '18.0.0' },
    runs: [
      { sourceRange: { unit: 'utf16', start: 0, end: 1 }, scriptTag: 'Hani', languageTag: 'ja', direction: 'ttb', directionSource: 'script-layout-policy',
        orientationPolicy: { mode: 'unicode-vertical-orientation', unicodeVersion: '18.0.0', overrides: [{ sourceRange: { unit: 'utf16', start: 0, end: 1 }, result: 'upright' }] }, features: [{ tag: 'vert', value: 1 }] },
      { sourceRange: { unit: 'utf16', start: 1, end: 2 }, scriptTag: 'Latn', languageTag: 'ja', direction: 'ltr', directionSource: 'script-layout-policy',
        orientationPolicy: { mode: 'sideways-run', transform: 'rotate-clockwise-90', overrides: [{ sourceRange: { unit: 'utf16', start: 1, end: 2 }, result: 'sideways-clockwise' }] }, features: [{ tag: 'vrt2', value: 1 }] },
      { sourceRange: { unit: 'utf16', start: 2, end: 3 }, scriptTag: 'Hani', languageTag: 'ja', direction: 'ttb', directionSource: 'script-layout-policy',
        orientationPolicy: { mode: 'unicode-vertical-orientation', unicodeVersion: '18.0.0', overrides: [{ sourceRange: { unit: 'utf16', start: 2, end: 3 }, result: 'font-vertical-alternate' }] }, features: [{ tag: 'vert', value: 1 }] }
    ] })
};

export const mongolianVerticalLtrColumns = {
  writingSupport: baseSupport([script('Mong', ['mn'], ['vertical'], ['ttb', 'btt'])], [0x1820]),
  layoutContext: context({ id: 'context:mongolian-vertical', text: 'ᠠ', writingMode: 'vertical', blockProgression: 'left-to-right', baseDirection: 'auto',
    runs: [{ sourceRange: { unit: 'utf16', start: 0, end: 1 }, scriptTag: 'Mong', languageTag: 'mn', direction: 'ttb', directionSource: 'script-layout-policy',
      orientationPolicy: { mode: 'script-default', result: 'upright' }, features: [{ tag: 'rlig', value: 1 }, { tag: 'calt', value: 1 }] }] })
};

export const mixedDirectionParagraph = {
  writingSupport: baseSupport([script('Latn', ['en'], ['horizontal'], ['ltr', 'rtl']), script('Arab', ['ar'], ['horizontal'], ['rtl', 'ltr'])], [0x0041, 0x0061, 0x0066, 0x0069, 0x0628, 0x0644, 0x0627]),
  layoutContext: context({ id: 'context:mixed-ltr-rtl', text: 'Hello مرحبا', writingMode: 'horizontal', blockProgression: 'top-to-bottom', baseDirection: 'ltr',
    runs: [
      { sourceRange: { unit: 'utf16', start: 0, end: 6 }, scriptTag: 'Latn', languageTag: 'en', direction: 'ltr', directionSource: 'bidi-resolution' },
      { sourceRange: { unit: 'utf16', start: 6, end: 11 }, scriptTag: 'Arab', languageTag: 'ar', direction: 'rtl', directionSource: 'bidi-resolution' }
    ] })
};

export const sharedConstructionVerticalAlternate = {
  writingSupport: (() => {
    const support = baseSupport([script('Hani', ['ja'], ['horizontal', 'vertical'], ['ltr', 'ttb'], true)], [0x3001]);
    support.glyphForms.push({ glyphId: 'glyph:uni3001.vert', formOfGlyphId: 'glyph:uni3001', semanticConstructionId: 'construction:ideographic-comma',
      presentation: { writingMode: 'vertical', orientation: 'upright', scriptTags: ['Hani'] } });
    return support;
  })()
};

export const horizontalAndVerticalMetrics = {
  writingSupport: (() => {
    const support = baseSupport([script('Hani', ['ja'], ['horizontal', 'vertical'], ['ltr', 'ttb'], true)], [0x65e5]);
    support.glyphMetrics.push({ glyphId: 'glyph:uni65E5', horizontal: { advance: 1000, startSideBearing: 80, endSideBearing: 80 },
      vertical: { advanceHeight: 1000, topSideBearing: 70, origin: { x: 500, y: 880 } } });
    return support;
  })()
};

export const multiCodePointToSingleGlyphShaping = {
  writingSupport: (() => {
    const support = baseSupport([script('Latn', ['en'], ['horizontal'], ['ltr'])], [0x0066, 0x0069]);
    support.shapingRules.substitutions.push({ id: 'rule:fi-ligature', kind: 'ligature-substitution', scriptTag: 'Latn', languageTags: ['en'], featureTag: 'liga',
      inputGlyphIds: ['glyph:f', 'glyph:i'], backtrack: [], lookahead: [], outputGlyphIds: ['glyph:fi'], lookupOrder: 10 });
    return support;
  })(),
  shapingExample: { inputCodePoints: [0x0066, 0x0069], nominalGlyphIds: ['glyph:f', 'glyph:i'], outputGlyphIds: ['glyph:fi'], sourceRange: { unit: 'utf16', start: 0, end: 2 }, cluster: 0 }
};

export const writingContextExamples = [latinHorizontalLtr, arabicHorizontalRtl, japaneseVerticalMixedOrientation,
  mongolianVerticalLtrColumns, mixedDirectionParagraph, sharedConstructionVerticalAlternate,
  horizontalAndVerticalMetrics, multiCodePointToSingleGlyphShaping];
