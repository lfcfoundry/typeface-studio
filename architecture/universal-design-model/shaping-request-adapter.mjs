/**
 * Build version-1 requests for an external shaper from an accepted design
 * snapshot and an already-resolved layout context. This module does not run
 * bidi resolution, shaping, line/column layout, orientation transforms, or
 * rendering.
 */

const DIRECTIONS = new Set(['ltr', 'rtl', 'ttb', 'btt']);
const WRITING_MODES = new Set(['horizontal', 'vertical']);
const PROGRESSIONS = new Set(['top-to-bottom', 'bottom-to-top', 'right-to-left', 'left-to-right']);
const ORIENTATIONS = new Set(['upright', 'sideways-clockwise', 'sideways-counterclockwise', 'font-vertical-alternate', 'context-dependent', 'user-override']);
const VERTICAL_FEATURES = new Set(['vert', 'vrt2', 'vrtr']);

function diagnostic(code, message, path = null, status = 'unresolved') {
  return { code, message, ...(path ? { path } : {}), status };
}

function supportedFeature(profile, tag) {
  const record = (profile.features || []).find(feature => feature.tag === tag);
  return record?.status || 'unknown';
}

function scalarRecords(text, sourceRange) {
  const slice = text.slice(sourceRange.start, sourceRange.end);
  const records = [];
  let offset = sourceRange.start;
  for (const value of slice) {
    const codePoint = value.codePointAt(0);
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) return { error: 'Text contains an unpaired UTF-16 surrogate.' };
    records.push({ codePoint, sourceRange: { unit: 'utf16', start: offset, end: offset + value.length } });
    offset += value.length;
  }
  return { records };
}

function validateFeatureSettings(features, path, diagnostics) {
  const seen = new Set();
  for (const [index, feature] of features.entries()) {
    if (!feature || !/^[a-zA-Z0-9]{4}$/u.test(feature.tag || '') || ![0, 1].includes(feature.value)) {
      diagnostics.push(diagnostic('invalid-feature-setting', 'Feature settings require a four-character tag and value 0 or 1.', `${path}[${index}]`, 'invalid'));
      continue;
    }
    if (seen.has(feature.tag)) diagnostics.push(diagnostic('duplicate-feature-setting', `Feature ${feature.tag} is specified more than once.`, `${path}[${index}]`, 'invalid'));
    seen.add(feature.tag);
  }
  if (seen.has('vert') && seen.has('vrt2')) diagnostics.push(diagnostic('vertical-feature-strategy-conflict', '`vert` and `vrt2` are alternative vertical substitution strategies for an overlapping run.', path));
}

function resolveNominalMapping(writingSupport, codePoint) {
  const matches = (writingSupport.characterMappings || []).filter(mapping => mapping.codePoint === codePoint);
  if (matches.length !== 1) return { status: matches.length ? 'ambiguous' : 'missing' };
  if (!(writingSupport.glyphs || []).some(glyph => glyph.id === matches[0].glyphId)) return { status: 'dangling' };
  return { status: 'resolved', glyphId: matches[0].glyphId };
}

function hasAlternateRule(writingSupport, featureTag, glyphId) {
  return (writingSupport.shapingRules?.substitutions || []).some(rule =>
    rule.featureTag === featureTag && (rule.inputGlyphIds || []).includes(glyphId) &&
    (rule.outputGlyphIds || []).length > 0 && (rule.outputGlyphIds || []).every(id => (writingSupport.glyphs || []).some(glyph => glyph.id === id)));
}

function variationSettings(settings, designSnapshot, path, diagnostics) {
  if (!Array.isArray(settings)) {
    diagnostics.push(diagnostic('invalid-variation-settings', 'Variation settings must be an array.', path, 'invalid'));
    return [];
  }
  const seen = new Set();
  for (const [index, setting] of settings.entries()) {
    const axis = (designSnapshot.variationAxes || []).find(item => item.tag === setting.tag);
    if (!axis || !Number.isFinite(setting.value) || setting.value < axis.min || setting.value > axis.max) {
      diagnostics.push(diagnostic('unsupported-variation-setting', `Variation setting ${setting.tag || '(missing)'} is not declared or is outside its design-space bounds.`, `${path}[${index}]`));
    }
    if (seen.has(setting.tag)) diagnostics.push(diagnostic('duplicate-variation-setting', `Variation axis ${setting.tag} is specified more than once.`, `${path}[${index}]`, 'invalid'));
    seen.add(setting.tag);
  }
  return settings.map(({ tag, value }) => ({ tag, value }));
}

function rangeContains(outer, inner) {
  return inner.start >= outer.start && inner.end <= outer.end;
}

function validateSourceClusters(clusters, runRange, path, diagnostics) {
  if (clusters === undefined) return null;
  if (!Array.isArray(clusters)) {
    diagnostics.push(diagnostic('invalid-source-clusters', 'Source clusters must be an array supplied by an upstream segmenter.', path, 'invalid'));
    return null;
  }
  let previousEnd = runRange.start;
  const ids = new Set();
  for (const [index, cluster] of clusters.entries()) {
    const range = cluster?.sourceRange;
    if (!cluster?.clusterId || ids.has(cluster.clusterId) || !range || range.unit !== 'utf16' || !Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < previousEnd || range.end <= range.start || !rangeContains(runRange, range)) {
      diagnostics.push(diagnostic('invalid-source-cluster', 'Source clusters require unique IDs and ordered UTF-16 ranges contained in the run.', `${path}[${index}]`, 'invalid'));
      continue;
    }
    ids.add(cluster.clusterId);
    previousEnd = range.end;
  }
  return structuredClone(clusters);
}

function validateDesignSnapshot(designSnapshot, diagnostics) {
  if (!designSnapshot || typeof designSnapshot !== 'object') {
    diagnostics.push(diagnostic('missing-design-snapshot', 'A validated design snapshot is required.', 'designSnapshot', 'invalid'));
    return null;
  }
  if (!designSnapshot.designId || !designSnapshot.revisionId || !designSnapshot.writingSupport) {
    diagnostics.push(diagnostic('incomplete-design-snapshot', 'Design ID, revision ID, and writingSupport are required.', 'designSnapshot', 'invalid'));
    return null;
  }
  if (designSnapshot.status !== 'accepted' || designSnapshot.validationStatus !== 'valid') {
    diagnostics.push(diagnostic('design-snapshot-not-accepted', 'Only an accepted, validated design revision can be used to build a shaping request.', 'designSnapshot'));
  }
  if (designSnapshot.writingSupport.version !== 1 || !Array.isArray(designSnapshot.writingSupport.scripts)) {
    diagnostics.push(diagnostic('unsupported-writing-support-version', 'The adapter requires writingSupport version 1 with a script registry.', 'designSnapshot.writingSupport', 'invalid'));
    return null;
  }
  return designSnapshot.writingSupport;
}

/**
 * @param {{designSnapshot: object, layoutContext: object, sourceEncoding: 'UTF-16'}} input
 * @returns {{status: 'ready'|'unresolved'|'invalid', request: object|null, diagnostics: object[]}}
 */
export function buildShapingRequest({ designSnapshot, layoutContext, sourceEncoding } = {}) {
  const diagnostics = [];
  const writingSupport = validateDesignSnapshot(designSnapshot, diagnostics);

  if (sourceEncoding !== 'UTF-16') diagnostics.push(diagnostic('unsupported-source-encoding', 'This adapter accepts explicit UTF-16 source text and UTF-16 code-unit ranges only.', 'sourceEncoding', 'invalid'));
  if (!layoutContext || layoutContext.version !== 1 || typeof layoutContext.text !== 'string' || !layoutContext.paragraph || !Array.isArray(layoutContext.runs)) {
    diagnostics.push(diagnostic('invalid-layout-context', 'A version-1 layout context with text, paragraph, and runs is required.', 'layoutContext', 'invalid'));
  }

  if (diagnostics.some(item => item.status === 'invalid')) return { status: 'invalid', request: null, diagnostics };

  const paragraph = layoutContext.paragraph;
  if (!WRITING_MODES.has(paragraph.writingMode)) diagnostics.push(diagnostic('invalid-writing-mode', 'Writing mode must be horizontal or vertical.', 'layoutContext.paragraph.writingMode', 'invalid'));
  if (!PROGRESSIONS.has(paragraph.blockProgression)) diagnostics.push(diagnostic('invalid-block-progression', 'Block progression must name a cardinal progression.', 'layoutContext.paragraph.blockProgression', 'invalid'));
  if (paragraph.writingMode === 'horizontal' && ['right-to-left', 'left-to-right'].includes(paragraph.blockProgression)) diagnostics.push(diagnostic('contradictory-block-progression', 'Horizontal writing requires perpendicular top-to-bottom or bottom-to-top block progression.', 'layoutContext.paragraph.blockProgression', 'invalid'));
  if (paragraph.writingMode === 'vertical' && ['top-to-bottom', 'bottom-to-top'].includes(paragraph.blockProgression)) diagnostics.push(diagnostic('contradictory-block-progression', 'Vertical writing requires perpendicular left-to-right or right-to-left column progression.', 'layoutContext.paragraph.blockProgression', 'invalid'));
  if (!['ltr', 'rtl', 'auto'].includes(paragraph.baseDirection)) diagnostics.push(diagnostic('invalid-base-direction', 'Paragraph base direction must be ltr, rtl, or auto.', 'layoutContext.paragraph.baseDirection', 'invalid'));
  if (paragraph.baseDirection === 'auto' && layoutContext.runs.some(run => run.directionSource === 'bidi-resolution')) {
    diagnostics.push(diagnostic('unresolved-paragraph-direction', 'Mixed or bidi-resolved runs require an explicit resolved paragraph base direction.', 'layoutContext.paragraph.baseDirection'));
  }

  const textLength = layoutContext.text.length;
  let priorEnd = 0;
  const requestRuns = [];
  const seenRunIds = new Set();
  let needsBidiProvenance = false;

  for (const [index, run] of layoutContext.runs.entries()) {
    const path = `layoutContext.runs[${index}]`;
    if (!run || !run.id || seenRunIds.has(run.id)) {
      diagnostics.push(diagnostic('invalid-run-identity', 'Each shaping run requires a unique stable ID.', `${path}.id`, 'invalid'));
      continue;
    }
    seenRunIds.add(run.id);
    const range = run.sourceRange;
    if (!range || range.unit !== 'utf16' || !Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < 0 || range.end <= range.start || range.end > textLength) {
      diagnostics.push(diagnostic('invalid-source-range', 'Runs require non-empty, in-bounds UTF-16 source ranges.', `${path}.sourceRange`, 'invalid'));
      continue;
    }
    if (range.start !== priorEnd) diagnostics.push(diagnostic('uncovered-or-overlapping-source', 'Runs must cover the complete source text in logical order without gaps or overlaps.', `${path}.sourceRange`));
    priorEnd = range.end;
    if (range.start > 0 && range.start < textLength && /[\uDC00-\uDFFF]/u.test(layoutContext.text[range.start])) {
      diagnostics.push(diagnostic('split-surrogate-pair', 'A run boundary may not split a Unicode scalar encoded as a surrogate pair.', `${path}.sourceRange`, 'invalid'));
    }
    if (range.end > 0 && range.end < textLength && /[\uDC00-\uDFFF]/u.test(layoutContext.text[range.end])) {
      diagnostics.push(diagnostic('split-surrogate-pair', 'A run boundary may not split a Unicode scalar encoded as a surrogate pair.', `${path}.sourceRange`, 'invalid'));
    }

    if (!run.scriptTag) diagnostics.push(diagnostic('script-unresolved', 'Script must be supplied by an upstream itemizer; the adapter does not infer it.', `${path}.scriptTag`));
    if (!run.languageTag) diagnostics.push(diagnostic('language-unresolved', 'Language must be supplied explicitly; the adapter does not infer it from script.', `${path}.languageTag`));
    if (!DIRECTIONS.has(run.direction) || run.directionSource === 'unresolved') diagnostics.push(diagnostic('direction-unresolved', 'A resolved ltr, rtl, ttb, or btt direction from an upstream stage is required.', `${path}.direction`));
    if (run.directionSource === 'bidi-resolution') needsBidiProvenance = true;
    if (!run.orientationPolicy) diagnostics.push(diagnostic('orientation-policy-missing', 'The run must carry an explicit orientation policy, including a horizontal default.', `${path}.orientationPolicy`));
    if (!Array.isArray(run.features || [])) diagnostics.push(diagnostic('invalid-feature-settings', 'Feature settings must be an array.', `${path}.features`, 'invalid'));
    if (!Array.isArray(run.variations || [])) diagnostics.push(diagnostic('invalid-variation-settings', 'Variation settings must be an array.', `${path}.variations`, 'invalid'));

    const scalars = scalarRecords(layoutContext.text, range);
    if (scalars.error) diagnostics.push(diagnostic('invalid-source-text', scalars.error, `${path}.sourceRange`, 'invalid'));
    const sourceClusters = validateSourceClusters(run.sourceClusters, range, `${path}.sourceClusters`, diagnostics);

    const profile = writingSupport?.scripts.find(item => item.scriptTag === run.scriptTag);
    if (!profile) diagnostics.push(diagnostic('script-not-registered', `Script ${run.scriptTag || '(missing)'} is not registered by this design.`, `${path}.scriptTag`));
    else {
      if (!profile.languages?.includes(run.languageTag)) diagnostics.push(diagnostic('language-not-registered', `Language ${run.languageTag || '(missing)'} is not registered for script ${run.scriptTag}.`, `${path}.languageTag`));
      if (!profile.writingModes?.includes(paragraph.writingMode)) diagnostics.push(diagnostic('writing-mode-unsupported', `Design does not declare ${paragraph.writingMode} support for ${run.scriptTag}.`, `${path}.writingMode`));
      if (!profile.supportedDirections?.includes(run.direction)) diagnostics.push(diagnostic('direction-unsupported', `Design does not declare ${run.direction} support for ${run.scriptTag}.`, `${path}.direction`));
      for (const capability of run.requiredShapingCapabilities || []) {
        if (!profile.shapingCapabilities?.includes(capability)) diagnostics.push(diagnostic('shaping-capability-unavailable', `Design does not declare ${capability} for ${run.scriptTag}.`, `${path}.requiredShapingCapabilities`));
      }
      for (const [featureIndex, feature] of (run.features || []).entries()) {
        const status = supportedFeature(profile, feature.tag);
        if (status !== 'supported') diagnostics.push(diagnostic(status === 'unsupported' ? 'feature-unsupported' : 'feature-capability-unknown', `Feature ${feature.tag} is ${status} for ${run.scriptTag}.`, `${path}.features[${featureIndex}]`));
      }
    }

    const features = run.features || [];
    validateFeatureSettings(features, `${path}.features`, diagnostics);
    const variations = variationSettings(run.variations || [], designSnapshot, `${path}.variations`, diagnostics);
    const nominalMappings = [];
    for (const scalar of scalars.records || []) {
      const mapping = resolveNominalMapping(writingSupport, scalar.codePoint);
      if (mapping.status !== 'resolved') {
        const code = mapping.status === 'ambiguous' ? 'ambiguous-character-mapping' : mapping.status === 'dangling' ? 'character-mapping-dangling' : 'character-mapping-missing';
        const message = mapping.status === 'ambiguous' ? `U+${scalar.codePoint.toString(16).toUpperCase()} maps to multiple glyph identities.`
          : mapping.status === 'dangling' ? `The nominal mapping for U+${scalar.codePoint.toString(16).toUpperCase()} references an unregistered glyph.`
            : `No nominal glyph mapping is registered for U+${scalar.codePoint.toString(16).toUpperCase()}.`;
        diagnostics.push(diagnostic(code, message, `${path}.sourceRange`));
        continue;
      }
      nominalMappings.push({ codePoint: scalar.codePoint, glyphId: mapping.glyphId, sourceRange: scalar.sourceRange });
      const metrics = writingSupport.glyphMetrics?.find(item => item.glyphId === mapping.glyphId);
      const metricSet = paragraph.writingMode === 'vertical' ? metrics?.vertical : metrics?.horizontal;
      const metricValid = paragraph.writingMode === 'vertical'
        ? Number.isFinite(metricSet?.advanceHeight) && Number.isFinite(metricSet?.topSideBearing)
        : Number.isFinite(metricSet?.advance) && Number.isFinite(metricSet?.startSideBearing) && Number.isFinite(metricSet?.endSideBearing);
      if (!metricValid) diagnostics.push(diagnostic(paragraph.writingMode === 'vertical' ? 'vertical-metrics-unavailable' : 'horizontal-metrics-unavailable',
        `Required ${paragraph.writingMode} metrics are not available for glyph ${mapping.glyphId}.`, `${path}.sourceRange`));

      const override = (run.orientationPolicy?.overrides || []).find(item => scalar.sourceRange.start >= item.sourceRange?.start && scalar.sourceRange.end <= item.sourceRange?.end);
      if (override && !ORIENTATIONS.has(override.result)) diagnostics.push(diagnostic('invalid-glyph-orientation', `Unsupported orientation result ${override.result}.`, `${path}.orientationPolicy` , 'invalid'));
      const needsFontAlternate = override?.result === 'font-vertical-alternate' ||
        (override?.result === 'sideways-clockwise' && features.some(item => ['vrt2', 'vrtr'].includes(item.tag)));
      if (paragraph.writingMode === 'vertical' && needsFontAlternate) {
        const alternateFeature = override.result === 'font-vertical-alternate' ? 'vert' : features.find(item => ['vrt2', 'vrtr'].includes(item.tag))?.tag;
        if (!alternateFeature || !hasAlternateRule(writingSupport, alternateFeature, mapping.glyphId)) {
          diagnostics.push(diagnostic('vertical-alternate-unavailable', `No ${alternateFeature || 'vertical'} alternate is registered for glyph ${mapping.glyphId}.`, `${path}.orientationPolicy`));
        }
      }
    }

    requestRuns.push({
      id: run.id,
      source: { text: layoutContext.text.slice(range.start, range.end), sourceRange: { ...range }, encoding: sourceEncoding, codePoints: (scalars.records || []).map(item => item.codePoint) },
      sourceClusters,
      scriptTag: run.scriptTag || null,
      languageTag: run.languageTag || null,
      direction: { value: DIRECTIONS.has(run.direction) ? run.direction : null, source: run.directionSource || 'unresolved' },
      writingMode: paragraph.writingMode,
      blockProgression: paragraph.blockProgression,
      orientationPolicy: run.orientationPolicy || null,
      features: features.map(item => ({ tag: item.tag, value: item.value })),
      variations,
      requiredMetricCapabilities: [paragraph.writingMode === 'vertical' ? 'vertical-metrics' : 'horizontal-metrics'],
      requiredShapingCapabilities: [...(run.requiredShapingCapabilities || [])],
      nominalMappingPreflight: nominalMappings
    });
  }

  if (priorEnd !== textLength) diagnostics.push(diagnostic('uncovered-source-text', 'The runs do not cover the complete source text.', 'layoutContext.runs'));
  if (needsBidiProvenance && paragraph.bidiResolution?.status !== 'resolved') diagnostics.push(diagnostic('bidi-resolution-required', 'Runs marked as bidi-resolved require an explicit upstream bidi-resolution record.', 'layoutContext.paragraph.bidiResolution'));
  if (needsBidiProvenance && (!paragraph.bidiResolution?.algorithm || !paragraph.bidiResolution?.unicodeVersion)) diagnostics.push(diagnostic('bidi-provenance-incomplete', 'Record the upstream bidi algorithm and Unicode version.', 'layoutContext.paragraph.bidiResolution'));

  const invalid = diagnostics.some(item => item.status === 'invalid');
  if (diagnostics.length) return { status: invalid ? 'invalid' : 'unresolved', request: null, diagnostics };

  const vertical = paragraph.writingMode === 'vertical';
  const requiredExternalCapabilities = [
    { capability: 'compiled-font-artifact', status: designSnapshot.fontArtifactId ? 'referenced' : 'not-provided', requiredFor: 'dispatch' },
    { capability: 'font-shaping-engine', status: 'required-not-invoked', requiredFor: 'shaping' },
    { capability: 'line-column-layout-engine', status: 'required-not-invoked', requiredFor: 'layout' },
    { capability: 'renderer', status: 'required-not-invoked', requiredFor: 'display' },
    ...(vertical ? [{ capability: 'vertical-orientation-and-placement-policy', status: 'forwarded-not-applied', requiredFor: 'layout' }] : []),
    ...(needsBidiProvenance ? [{ capability: 'paragraph-bidi-resolver', status: 'resolved-upstream-not-run-here', requiredFor: 'bidi' }] : [])
  ];

  return {
    status: 'ready',
    diagnostics: [],
    request: {
      type: 'lfcfoundry.shaping-request',
      version: 1,
      font: {
        designId: designSnapshot.designId,
        revisionId: designSnapshot.revisionId,
        familyName: designSnapshot.familyName || null,
        artifactId: designSnapshot.fontArtifactId || null
      },
      source: { text: layoutContext.text, encoding: sourceEncoding, indexUnit: 'utf16' },
      paragraph: {
        baseDirection: paragraph.baseDirection,
        writingMode: paragraph.writingMode,
        blockProgression: paragraph.blockProgression,
        bidiResolution: paragraph.bidiResolution ? structuredClone(paragraph.bidiResolution) : null
      },
      runs: requestRuns,
      execution: { status: 'not-performed', shapedGlyphs: null, requiredExternalCapabilities }
    }
  };
}
