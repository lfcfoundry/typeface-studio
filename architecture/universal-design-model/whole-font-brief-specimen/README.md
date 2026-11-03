# Whole-font brief resolution and coordinated specimen

This isolated experiment adds a versioned, source-aware resolution contract for one complete English family brief. It does not claim general natural-language understanding. It turns a brief into family decisions, one glyph-specific exception, explicit capability gaps, a construction plan, and one coordinated candidate transaction.

## Supported language

The resolver accepts the exact illustrative brief below and one variant that changes only the opening verb from “Create” to “Design”. Capitalization, repeated whitespace, and final punctuation are normalized. The remaining wording is deliberately fixed; synonyms and free-form paraphrases are not interpreted.

> Create a humanist sans-serif typeface with moderately condensed proportions, consistent stroke weight, a relatively tall x-height, generous counters, slightly rounded terminals, and a conventional double-storey lowercase a. Prioritize readability at small sizes.

Unknown wording returns a diagnostic and no candidate. It is not mapped to the closest supported property. Contradictory serif or `a` topology instructions return conflict diagnostics. Script/language support is limited to this English-language rule set.

## Contract

`contract.mjs` defines schema `lfcfoundry.whole-font-brief-resolution` version 1 and validates it without a general schema framework.

- `brief` stores the exact original string, message ID, and the explicitly limited language capability.
- Each `decision` has family or glyph scope, a typed qualitative value, explicit/inferred/defaulted origin, capability state, explanation, and source span when explicit. Explicit source spans are half-open UTF-16 offsets into the preserved message. Inferred/defaulted records do not invent source spans.
- `constraints`, `dependencies`, `unsupported`, `unresolved`, and `conflicts` remain separate. A qualitative phrase is not converted to a numerical value without a grounded mapping.
- `defaults` records the specimen inventory and why it was chosen. The default `h` is not represented as a user request.
- `specimenPlan` lists methods, affected glyphs, dependencies on shared decisions, and excluded repertoire.
- `briefCompliance.status` remains `incomplete-blocked` because key explicit requirements cannot be satisfied by the available constructors.

The brief's stroke-consistency request is linked to the existing shared 90-unit stem decision, but classified as approximate: matching that value does not prove optical weight equality. The existing fixture measurements (x-height 500, cap height 700) are reported as inherited measurements, not as proof that “relatively tall” has been met. “Generous counters” has no calibrated cross-glyph rule. Small-size readability requires visual review.

The humanist direction, moderately condensed proportions, rounded terminals, and conventional double-storey `a` are not reported as supported. The double-storey `a` experiment is excluded because its saved Android Chrome raster looks like stacked loops. The accepted single-storey `a` is carried forward for comparison only; it is not substituted as a solution. The plan also includes a lowercase `h` as a default specimen member because a bounded construction already exists.

## Construction and candidate lifecycle

The planner reuses the accepted `o`, `n`, `H`, and single-storey `a` records, plus the tested ascender-stem/shoulder-return `h` constructor. Its shared-decision bindings identify which nodes refer to the existing stroke and x-height decisions. This is a specimen plan, not a full glyph inventory or automatic family-wide style solver.

The family resolution is stored in the existing v2 `constructionIntegration` extension through a per-call handler. The same `executeTransaction()` call stages that operation and the existing semantic `h` addition operation. The `h` operation depends on the family-resolution operation. The executor validates glyph geometry, creates a content-sensitive candidate revision, and rolls the whole transaction back on a handler or geometry failure. The source remains accepted and unchanged. The build then uses the existing `compilerProject()` and `compileSemanticDesign()` path; it verifies that compiler contour points match the executor-validated family points and that existing glyph records are identical between source and candidate fonts.

No maintained executor changes or second transaction engine were added. Because the source geometries are inherited and only `h` is newly constructed, this candidate does not claim that all family-wide requests have been realized. The plan records rather than hides that gap.

## Technical and visual status

Candidate status is a separate field with these states:

- `construction-geometry-invalid`
- `compilation-failed`
- `technically-valid-not-visually-reviewed`
- `visually-reviewed-not-approved`
- `visually-approved`

The generated candidate is `technically-valid-not-visually-reviewed`. Internal compiler/SFNT checks and successful FontFace loading do not change its visual status. `recordVisualReview()` requires a named human reviewer, explicit decision, and evidence reference. `acceptWholeFontCandidate()` requires visual approval and, for this intentionally incomplete candidate, explicit acceptance of the partial scope. A visual approval of this specimen would still not mean the original brief was satisfied or that the font is professionally acceptable.

`review.html` provides:

- Accepted-source and candidate outline grids.
- Uppercase/lowercase views and repeated `nn`, `oo`, and `aa` samples.
- `Hanna`, `noon`, and `anon` word samples at 12, 16, 24, 32, 48, and 72 CSS pixels.
- The accepted font for source/candidate comparison where the same glyphs exist. The accepted source lacks `h`, so `Hanna` is candidate-only.
- FontFace load reporting and a separate human review record download control.

Opening the page or loading the fonts is not visual review. Inspect the words on the target device and record a separate reviewer decision. No screenshot or independent validator is produced by the build itself. The fonts use the project's existing `fontsketch 0.1.0` compiler and internal SFNT audit; those checks are not independent validation.

## Build and test

From the repository root:

```sh
node --test architecture/universal-design-model/whole-font-brief-specimen/test/whole-font.test.mjs
node architecture/universal-design-model/whole-font-brief-specimen/build.mjs
node architecture/universal-design-model/whole-font-brief-specimen/write-sha256-manifest.mjs
node architecture/universal-design-model/whole-font-brief-specimen/verify-preservation.mjs
```

The build writes only new files under this directory and refuses to reuse an existing `artifacts/` directory or overwrite generated files. It creates a source TTF, a partial candidate TTF, `specification.json`, `build-report.json`, and `review.html`. The candidate includes U+0068; pre-existing `o`, `n`, `H`, and `a` compiler records must match the accepted source.

The test suite covers resolver provenance and diagnostics, scope, decision typing, unsupported capability planning, shared-decision links, transaction dependency, source immutability, rollback, compiler failure, acceptance gating, visual-review separation, and a follow-up `h` delta after explicit acceptance. The follow-up test uses a test-only reviewer record to exercise revision state transitions; it is not evidence of actual visual approval.

## Limits

This is one bounded English brief and one small Latin specimen. It does not implement family-wide geometry regeneration for every decision, a conventional double-storey `a`, humanist-specific construction, calibrated width/counter/terminal policies, complete English coverage, arbitrary language understanding, Unicode-wide planning, shaping, kerning, a production UI, independent font validation, or professional quality certification. Visual quality remains a human review requirement.
