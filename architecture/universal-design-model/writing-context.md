# Writing Context and Shaping Extension

Status: architecture proposal, `writingSupport.version: 1`, compatible with the schema-v2 design envelope. This is a model contract and fixture set only. It does not add RTL, vertical layout, font metrics, or shaping to the application.

## Purpose and model boundary

Glyph construction describes font design. Writing context describes how a text object is laid out and shaped. Those are related by explicit references but are not the same state. A glyph is not a Unicode character, and neither a glyph record nor a design brief carries a universal writing direction.

The v2 design envelope may add an optional, independently versioned `writingSupport` subdocument. A layout/shaping request is a separate object, because one font can be used in many text contexts. A saved specimen may persist such a request by reference, but it must not make that request a property of the font family itself.

```text
Typeface design                         Layout / shaping request
writingSupport                          layoutContext
  script and language support             text and paragraphs
  Unicode mappings                         paragraph base direction
  glyph presentation forms                 writing mode and block progression
  horizontal / vertical metrics            script/language/direction per run
  GSUB/GPOS intent                          orientation policy and overrides
       \                                       /
        +---- shaping/layout adapter -------+
                      |
               shaped glyph runs
```

The writing-support extension is not a new top-level schema version. Its own version allows its records to evolve without changing intent, construction, operations, revisions, or existing v2 fixtures. The five original fixtures and v1-to-v2 adapter remain valid and unchanged.

## Independent dimensions

### Script and language

Use ISO 15924 four-letter script tags (`Latn`, `Arab`, `Hani`, `Mong`) and BCP 47 language tags (`en`, `ar`, `ja`, `mn`) in separate fields. A language may use more than one script, and a script may serve multiple languages. Script selection is not language detection.

Unicode `Script` partitions code points, but `Common`, `Inherited`, and `Unknown` are meaningful values; `Script_Extensions` can list a bounded set of scripts and can change between Unicode versions. Script itemization must therefore record the Unicode data version and the resolution evidence. Marks and join controls can inherit script context. Do not turn a single code point's `Script` value into an immutable glyph property.

### Text direction

Direction belongs to paragraph resolution and shaped-run requests, not to the glyph or family. A paragraph carries `baseDirection: ltr | rtl | auto` for bidirectional resolution. Each resulting shaping run records `direction: ltr | rtl | ttb | btt`, the resolved value passed to the shaper, and its source (`explicit`, `bidi-resolution`, `script-layout-policy`, or `user-override`). `auto` is valid only before run resolution, not as a resolved shaper direction.

The paragraph base direction and run shaping direction solve different problems. UAX #9 resolves bidirectional levels and visual ordering for paragraph content; a shaping engine such as HarfBuzz shapes an itemized run with direction, script, and language. Typeface Studio must not implement the Unicode Bidirectional Algorithm by reversing glyph arrays or assume that the font performs paragraph reordering.

### Writing mode and line/column progression

`writingMode` independently selects the inline layout axis: `horizontal` or `vertical`. `blockProgression` records the progression of lines or columns on the perpendicular axis. For a vertical context, that is the column progression (`right-to-left` or `left-to-right`); for horizontal context it is line progression (`top-to-bottom` or `bottom-to-top`). The contract permits future named writing modes and progression policies, but an implementation must not infer one dimension from a `direction` field.

Examples:

| Context | Writing mode | Shaping direction | Block / column progression |
|---|---|---|---|
| English paragraph | horizontal | ltr | top-to-bottom |
| Arabic paragraph | horizontal | rtl | top-to-bottom |
| Japanese vertical page | vertical | ttb for upright Japanese; local ltr/rtl for sideways runs | right-to-left |
| Traditional Mongolian | vertical | ttb | left-to-right |

For sideways scripts inside a vertical context, a shaping run may first be shaped on its script's local horizontal axis and then receive a presentation transform. This is not equivalent to changing the writing mode of the containing layout.

### Glyph orientation

Orientation is a presentation decision for a glyph occurrence in a layout context. The default policy can consult a pinned Unicode Vertical_Orientation data version and then apply font alternates or explicit higher-level overrides. Record the resolved orientation separately from shaping direction:

- `upright`
- `sideways-clockwise`
- `sideways-counterclockwise`
- `font-vertical-alternate`
- `context-dependent`
- `user-override`

UAX #50 values `U`, `R`, `Tu`, and `Tr` are source property values, not final layout instructions. `Tu`/`Tr` allow fallback behavior and a layout protocol may override Unicode's informative default. Store the source property value, data version, selected policy, override, and resolved result when reproducibility matters.

Orientation can be resolved for an input character sequence and refined for the resulting glyph occurrence. This matters when one sequence substitutes to another glyph, a contextual form is selected, or the same glyph ID appears in mixed-orientation text. A glyph's construction remains reusable; a vertical alternate is a distinct glyph form with a relation to shared semantic construction, not a mutation of the horizontal glyph.

### Character, glyph, cluster, and shaped-run identities

Keep these identities separate:

1. Unicode code point and (where applicable) variation sequence.
2. Grapheme-cluster/source range used by editing and caret navigation.
3. Nominal glyph identity selected by character mapping.
4. Alternate or contextual glyph identity in the font.
5. Shaped output glyph occurrence, including source cluster, advances, offsets, orientation, and applied substitutions.

`cmap`-like scalar mappings are explicit records from Unicode scalar values to stable glyph IDs; glyphs may have no Unicode mapping and a code point may be represented by different glyphs in different font/context mechanisms. Variation-sequence mappings are separate. GSUB/GPOS or a shaping adapter may consume a sequence of nominal glyphs and output a different number of glyphs. Do not model the pipeline as `character -> glyph` only.

UAX #29 extended grapheme clusters are useful default editing boundaries, but are not a guarantee of shaping-cluster boundaries and do not replace script-specific shaping segmentation. Shaped output records must retain source cluster/range information supplied by the shaper.

## `writingSupport.version: 1`

The following shape is normative for this draft extension; optional records may be omitted when the font does not support them.

```json
{
  "version": 1,
  "unicodeDataVersion": "18.0.0",
  "scripts": [{
    "scriptTag": "Hani",
    "languages": ["ja"],
    "writingModes": ["horizontal", "vertical"],
    "supportedDirections": ["ltr", "ttb"],
    "features": [{ "tag": "vert", "status": "supported" }],
    "shapingCapabilities": [],
    "orientationData": { "property": "Vertical_Orientation", "version": "18.0.0" }
  }],
  "characterMappings": [{ "codePoint": 26085, "glyphId": "glyph:uni65E5" }],
  "variationMappings": [],
  "glyphForms": [{
    "glyphId": "glyph:uni3001.vert", "formOfGlyphId": "glyph:uni3001",
    "semanticConstructionId": "construction:ideographic-comma",
    "presentation": { "writingMode": "vertical", "orientation": "upright", "scriptTags": ["Hani"] }
  }],
  "glyphMetrics": [{
    "glyphId": "glyph:uni65E5",
    "horizontal": { "advance": 1000, "startSideBearing": 70, "endSideBearing": 70 },
    "vertical": { "advanceHeight": 1000, "topSideBearing": 80, "origin": { "x": 500, "y": 880 } }
  }],
  "metricFallback": { "vertical": "unresolved-until-policy-selected" },
  "shapingRules": {
    "substitutions": [],
    "positioning": [],
    "ordering": []
  }
}
```

`characterMappings` represent nominal scalar mappings, not a promise that a text sequence yields one glyph per code point. `glyphForms` have distinct glyph IDs and may share `semanticConstructionId`; they may share components or construction parameters while having different outlines/metrics. `glyphMetrics.horizontal` and `.vertical` coexist. A `vertical.origin` is optional in the model because TrueType/OpenType can derive the vertical origin from the glyph bounds and top side bearing; CFF/OpenType may use `VORG`. Never manufacture vertical metrics by silently relabeling horizontal metrics. When missing, a named fallback policy must identify whether the result is derived, synthesized by a layout engine, unsupported, or unresolved.

Each shaping rule has a stable ID, rule kind, source glyph sequence or glyph-class selector, before/after context, script tags, language tags, presentation/writing-mode conditions as applicable, feature tag, lookup order/dependencies, output glyph sequence and positioning data, provenance, and capability status. Conditions can refer to multiple input/output glyphs. Rule ordering must be deterministic and cycles or mutually exclusive feature conditions must be rejected or left unresolved. OpenType feature tags are serialization/interoperability data; they do not replace the higher-level semantic rule or its applicability conditions.

## Layout request and shaped output

An input layout request is separate from `writingSupport`:

```json
{
  "version": 1,
  "text": "Hello مرحبا",
  "paragraph": {
    "baseDirection": "ltr",
    "writingMode": "horizontal",
    "blockProgression": "top-to-bottom",
    "bidiAlgorithm": { "name": "UAX9", "unicodeVersion": "18.0.0" }
  },
  "runs": [{
    "id": "run:arabic",
    "sourceRange": { "unit": "utf16", "start": 6, "end": 11 },
    "scriptTag": "Arab", "languageTag": "ar",
    "direction": "rtl", "directionSource": "bidi-resolution",
    "orientationPolicy": { "mode": "horizontal-default" },
    "features": [{ "tag": "rlig", "value": 1 }]
  }]
}
```

Offsets use the declared source indexing convention and remain tied to original text, not reordered visual positions. A real implementation must itemize text into runs using Unicode properties and higher-level language/layout context, resolve bidi separately, then pass run direction, script, language, and features to a shaper. A layout adapter may split or merge runs while retaining source ranges.

The shaper output is a sequence of glyph *occurrences*, not registry entries:

```json
{
  "runId": "run:latin",
  "glyphs": [{
    "glyphId": "glyph:fi",
    "sourceRange": { "unit": "utf16", "start": 0, "end": 2 },
    "cluster": 0,
    "advance": { "x": 620, "y": 0 },
    "offset": { "x": 0, "y": 0 },
    "orientation": "upright",
    "appliedRules": ["rule:fi-ligature"]
  }]
}
```

The source range may cover multiple code points and one input sequence may yield zero, one, or several output glyphs; conversely, multiple input glyphs may become one ligature. Marks may have zero advances and nonzero positioning offsets. Reordering can change output order while cluster/source order remains traceable. Advances and offsets are run-level shaped results; they must not be written back as intrinsic glyph metrics.

## Non-rendering shaping-request adapter v1

`shaping-request-adapter.mjs` is a pure architecture adapter. It accepts:

- `designSnapshot`: `{ designId, revisionId, status: "accepted", validationStatus: "valid", familyName?, fontArtifactId?, variationAxes, writingSupport }`. The caller certifies that the snapshot passed the design model's validation; the adapter checks the acceptance/version boundary and referenced per-run capabilities.
- `layoutContext`: version 1 paragraph/run structure described above. Script, language, direction, writing mode, feature settings, and orientation policy must be supplied or resolved by the caller.
- `sourceEncoding: "UTF-16"`: required explicitly because source ranges use UTF-16 code-unit offsets in this implementation.

For each run the adapter checks registration of script/language, writing mode and direction, requested OpenType feature support, nominal mappings for the source scalars, the required horizontal or vertical metrics, and any specifically requested vertical alternate. Optional `sourceClusters` are copied from an upstream segmenter with their source ranges; the adapter does not compute UAX #29 clusters. Requested feature settings and variation-axis values are preserved. Empty feature and variation arrays mean the caller requested none; the adapter does not invent defaults.

The result is `{ status: "ready", request, diagnostics: [] }`, `{ status: "unresolved", request: null, diagnostics }`, or `{ status: "invalid", request: null, diagnostics }`. `ready` means the request contract is complete. The request carries font design/revision identity, source text and encoding, paragraph fields, per-run source text/ranges/code points/clusters, script, language, resolved direction and provenance, writing mode, block progression, orientation policy, feature/variation settings, and required metric/shaping capabilities. `nominalMappingPreflight` is only a check of the design's existing cmap-like records; it is not shaped output.

Every ready request explicitly contains `execution.status: "not-performed"` and `shapedGlyphs: null`. It lists the compiled font artifact, external font shaper, line/column layout engine, renderer, and—when relevant—vertical placement/orientation processing as external requirements. The adapter does not implement UAX #9, script itemization, shaping, line breaking, column placement, orientation transforms, or rendering. A `directionSource: "bidi-resolution"` run is accepted only when its paragraph has an upstream resolved bidi record with algorithm and Unicode version; the adapter verifies that provenance is present, not that UAX #9 was run correctly.

The adapter returns `unresolved` rather than guessing when run direction, script, language, source coverage, a required metric, requested feature, variation axis, or needed glyph alternate is missing. It does not mutate the design snapshot, its operations, accepted decisions, or revision history. Tests are in `shaping-request-adapter.test.mjs`; deterministic representative inputs are in `shaping-request.fixtures.mjs`.

## Font metrics and OpenType boundary

Store horizontal and vertical metrics independently per glyph form. Horizontal metrics align with `hhea`/`hmtx`; vertical metrics align with `vhea`/`vmtx`. OpenType vertical fonts require both vertical tables. In TrueType outlines, vertical origin Y is derived from the glyph's top bound and `vmtx` top side bearing; `VORG` is optional for CFF and ignored for TrueType. The model may store an explicit origin for stable design/editor semantics but the exporter must serialize only according to the chosen outline format's rules.

`vert` selects forms appropriate for upright presentation in vertical writing. `vrt2` supplies rotated alternates and is a superset of `vert` in the relevant feature model. `vrtr` selects forms that the layout engine will rotate for sideways presentation. These strategies are not interchangeable and must not be simultaneously activated for the same glyph occurrence. The shaping/layout adapter records which strategy was selected. GPOS vertical placement/kerning, anchors, mark attachment, and horizontal kerning are separate positioning behavior; changing an outline does not automatically preserve their correctness.

Missing vertical metrics are a font capability gap, not a reason to turn a horizontal design into a vertical font by rotation. The first Latin MVP may publish horizontal-only support. Any vertical shaping request against it should report the explicit selected fallback or unsupported status.

## Operation model compatibility

The existing operation DAG remains suitable for operation order and transactions. Add optional operation applicability/effect metadata only where relevant:

```json
{
  "applicability": {
    "scriptTags": ["Arab"], "languageTags": ["ar"],
    "writingModes": ["horizontal"], "directions": ["rtl"]
  },
  "effects": ["semantic-construction", "outline-geometry", "vertical-metrics", "shaping"],
  "presentationTarget": "shared-construction | horizontal-form | vertical-form | shaped-run | context-specific"
}
```

These fields are optional and should be omitted for genuinely context-independent operations. A counter-shape edit can target shared construction and derive across presentation forms; if a vertical form has a user-approved override, the resolver must surface the override conflict or preserve it. A joining-form or vertical-alternate edit targets a script/context-specific form or shaping rule. A metric change declares horizontal/vertical metric effects separately. The executor filters applicability against a resolved context and must never silently treat an inapplicable operation as successful.

## Required validation

Validate the extension at document boundaries:

- Version, Unicode data version, ISO 15924 tags, BCP 47 tags, and enum values are explicit.
- Script and language are separate; `Common`/`Inherited` and script extensions are not rewritten as a guessed primary script without provenance.
- `writingMode`, block/column progression, run direction, and glyph orientation remain separate records.
- A resolved run direction is one of `ltr`, `rtl`, `ttb`, `btt`; `auto` belongs to paragraph-level resolution only.
- Block progression is perpendicular to the writing mode's inline axis; contradictory axis/progression combinations are rejected or marked unresolved.
- `characterMappings` reference known glyph IDs and valid Unicode scalar values. Alternate glyph forms retain separate IDs.
- Shaping rules reference known glyphs/classes/features; sequence input and output cardinalities may differ. Context/lookup dependencies are acyclic and deterministic.
- Horizontal and vertical metrics may coexist; absent values invoke a named fallback or remain unresolved. Metrics are not inferred from text direction.
- Competing orientation overrides over the same glyph/run/context require explicit precedence; otherwise the result is ambiguous.
- `vert`, `vrt2`, and `vrtr` strategy conflicts are rejected for overlapping occurrences.
- Shaped glyph occurrences retain source cluster ranges even after substitution/reordering.

## Specification findings and implementation evidence

| Primary source | Verified point | Model consequence |
|---|---|---|
| [UAX #9, Unicode Bidirectional Algorithm](https://www.unicode.org/reports/tr9/) | UBA separates paragraphs, resolves embedding levels, and reorders at line level; it defines isolates and operates on text, while shaping has separate effects. | Store paragraph base direction and resolved directional runs; do not encode UBA in font glyphs or reverse the source text. |
| [UAX #24, Unicode Script Property](https://www.unicode.org/reports/tr24/) | `Script` and `Script_Extensions` differ; Common/Inherited code points and marks/Join Controls need contextual handling. | Script tag is run metadata with Unicode-version provenance; language stays separate. |
| [UAX #29, Unicode Text Segmentation](https://www.unicode.org/reports/tr29/) | Extended grapheme clusters are a recommended default text-segmentation unit, not a glyph mapping rule. | Preserve source ranges and distinguish grapheme clusters from shaped clusters and glyph IDs. |
| [UAX #50, Unicode Vertical Text Layout](https://www.unicode.org/reports/tr50/) | Vertical_Orientation defines U/R/Tu/Tr; it is informative, has fallback semantics, and can be overridden by higher-level protocols. | Store the Unicode value/data version and a separately resolved orientation policy/override. |
| [CSS Writing Modes Level 3](https://www.w3.org/TR/css-writing-modes-3/) and [W3C vertical-text guidance](https://www.w3.org/International/articles/vertical-text/) | Writing modes combine inline ordering and block progression, but vertical-rl CJK and vertical-lr Mongolian differ in column progression; text orientation is separately controlled. | Store writing mode, per-run shaping direction, and line/column progression as independent axes. |
| [OpenType `vhea`](https://learn.microsoft.com/en-us/typography/opentype/spec/vhea) and [`vmtx`](https://learn.microsoft.com/en-us/typography/opentype/spec/vmtx) | Vertical font-level and per-glyph metrics are separate from horizontal metrics; vertical origin is computed from bounds + top side bearing for TrueType. | Allow paired independent metric sets and a named fallback, not a single `advance` field. |
| [OpenType `VORG`](https://learn.microsoft.com/en-us/typography/opentype/spec/vorg) | VORG is optional for CFF; ignored for TrueType; it does not replace `vhea`/`vmtx`. | Keep origin model-level but serialize format-specifically. |
| [OpenType `vert`, `vrt2`, `vrtr`](https://learn.microsoft.com/en-us/typography/opentype/spec/features_uz) | `vert` supplies upright alternates, `vrt2` supplies pre-rotated alternates, and `vrtr` supplies glyphs later rotated by layout. | Model orientation strategy and GSUB feature separately; reject overlapping incompatible strategies. |
| [HarfBuzz buffer API](https://harfbuzz.github.io/harfbuzz-hb-buffer.html), [shaping flow](https://harfbuzz.github.io/shaping-and-shape-plans.html), and [script-specific shaping](https://harfbuzz.github.io/script-specific-shaping.html) | A shaping buffer carries direction/script/language; shaping may substitute, reorder, join, stack, position, and alter glyph count. | Store shaped-run output with glyph IDs, clusters, advances, offsets, and applied rules, not a one-character/one-glyph map. |
| [HarfBuzz Arabic shaper source](https://github.com/harfbuzz/harfbuzz/blob/main/src/hb-ot-shaper-arabic.cc) and [shaper selection](https://github.com/harfbuzz/harfbuzz/blob/main/src/hb-ot-shaper.hh) | The implementation derives joining actions from context and feature masks; source code copies those action tags to Mongolian variation selectors. Shaper dispatch also considers direction. This code observation alone does not establish complete Mongolian vertical support. | Script shaping behavior is context- and direction-sensitive; a generic isolated glyph transformation is insufficient. |

The HarfBuzz documentation describes buffer inputs and outputs; it does not make HarfBuzz a paragraph bidi engine or a full page-layout engine. Typeface Studio will need a layout/itemization boundary in addition to font shaping.

## Compatibility and non-goals

- Existing schema-v2 design and operation records remain readable; `writingSupport` is optional and versioned independently.
- Existing heart substitution and reflection operate on stable glyph identities and remain direction-independent by default. They do not acquire new behavior merely because the writing extension exists.
- Existing v1 migration and the model-to-font integration experiment are unchanged. A later adapter may map horizontal metrics and script tags, but missing vertical information must become an explicit unresolved/default record.
- This contract does not implement UAX #9, Unicode itemization, vertical layout, HarfBuzz, OpenType shaping, or additional script generation.
- Latin-first development can retain only horizontal metrics at first. Supporting more scripts requires script-specific construction, feature authoring, shaping tests, and native-reader validation.

## Unresolved decisions

1. Which Unicode version is pinned per project and how property data upgrades migrate accepted designs.
2. Whether BCP 47 language tags are family-level default metadata, run-level only, or both; this draft permits both and requires run-level effective language.
3. Whether layoutContext should persist as a user-authored specimen object in the project or remain an external preview request.
4. Which bidi and itemization library/host capability will resolve paragraphs, and how browser environments expose resolved script/direction without a complete text engine.
5. Whether fontmaker authors source semantic shaping rules, lower-level GSUB/GPOS plans, or both.
6. Which vertical alternate strategy (`vert` + layout rotation, `vrt2`, or `vrtr`) is targeted by each exporter/consumer.
7. Exact fallback policy for horizontal-only fonts used in vertical contexts; it must remain explicit and user-visible.
8. How line breaking, vertical punctuation layout, baseline tables, mark attachment, and script-specific block progression will be represented beyond this first extension.

## Recommended next milestone

Keep this as a contract-only change. The next engineering milestone should add a non-rendering layout/shaping request adapter and validation tests for one Latin horizontal run, one mixed Latin/Arabic horizontal paragraph, and one Japanese vertical request with explicit orientation decisions. It should not claim visual shaping until a real shaping engine and independent reference results are available. The existing production font generation and geometry engine should remain unchanged during that milestone.
