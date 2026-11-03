# Distinct construction topology: lowercase `h`

This isolated experiment implements one request:

> Add a lowercase h with a vertical stem and shoulder, preserving every existing glyph.

One exact wording variant is also accepted: `Add lowercase h with a vertical stem and shoulder; preserve all existing glyphs.` Other requests return diagnostics and do not create a candidate. This is a small rule-based scenario, not a natural-language interpreter.

## Why `h` is a different topology

The existing lowercase `n` record in the shared semantic fixture has two vertical stem nodes joined by an arched bridge. The new `h` has one ascender stem and one shoulder component whose topology includes a descending return leg. The return leg ends in its own flat terminal. The shoulder-open counter and its baseline opening are explicit semantic nodes with stable boundary identities. Geometry contains one closed TrueType contour that leaves the baseline interval between the stem and return uninked; the semantic open-space connects to the exterior through that interval.

This is a distinct bounded grammar, not a general anatomy-graph compiler. Its semantic profile stores decisions, ratios, component roles, stable IDs, ownership, attachments, constraints, and provenance. It does not store contour coordinates. The adapter resolves those records and dimensions into quadratic segments. Its fixed supported roles and topology are deliberately narrow.

## Request and transaction

`scenario.mjs` preserves the full input string and source spans for the explicit construction and preservation intent. It records the inferred use of the accepted cap-height decision as the h ascender, and the explicit experiment metric policy: preserve the 650-unit advance, derive left and right bearings from outline bounds, and invalidate kerning for review.

The accepted parent has no `h` glyph. A candidate-only `glyph:u0068` identity shell is staged in cloned registry and family data and selected by an exact glyph-ID selector bound to the staged registry revision. The registered per-call handler checks the accepted parent revision, target absence and Unicode uniqueness, staging lineage, exact target cardinality, and provenance. It then replaces the shell's pending construction record with the semantic grammar, validates the anatomy and relationships, derives the outline, and lets the maintained `executeTransaction()` lifecycle validate and create the candidate revision.

The maintained executor was not changed. It has no general glyph-add operation; this experiment demonstrates one explicitly constrained addition handler, not universal glyph registration. Failure during semantic validation, geometry derivation, executor validation, a later dependent operation, or font compilation produces no accepted candidate. `acceptCandidate()` returns a separate immutable snapshot. A follow-up shoulder-rise edit is a new transaction delta and does not replay the accepted add operation.

## Geometry and metrics

The adapter uses the semantic `left-ascender-stem`, `arched-return`, terminal, and boundary roles. It derives stem width from the shared 90-unit decision, x-height from 500 units, ascender from the accepted 700-unit cap-height decision, and the shoulder/counter curves from the semantic ratios. It has no glyph-name geometry dispatch.

For the current fixture, exact quadratic bounds are `x=55..595`, `y=0..700`. Advance stays 650; side bearings recompute to 55/55. Existing `validateGlyph()` checks integer TrueType points, winding, area, and sampled self-intersection/containment. The sampling checks do not prove all possible geometric properties. The experiment has no kerning data or optical spacing model, so kerning is marked for review.

`canonicalizeInitialGeometry()` creates the TrueType point list. The executor validates that family glyph, and `compilerProject()` supplies the same point records to the existing `fontsketch 0.1.0` compiler. The build asserts point-for-point equality at that boundary. The internal SFNT audit and parser are project checks, not independent font validation.

## Build, tests, and review

Focused tests:

```sh
node --test architecture/universal-design-model/construction-experiment/lowercase-h-topology-slice/scenario.test.mjs
```

Build the isolated parent and candidate diagnostic fonts plus `review.html` and `build-report.json`:

```sh
node architecture/universal-design-model/construction-experiment/lowercase-h-topology-slice/build.mjs
```

The build writes only new files under this experiment. It uses exclusive file creation and fails if an output already exists. The parent font contains the accepted `o`, `n`, `H`, and `a`; the candidate font adds U+0068. The internal compiler parser checks that the prior glyph records are unchanged. The review page embeds both fonts and presents the existing `n`, the semantic-derived `h`, metrics, and a Canvas preview. A generated review page alone does not establish browser rendering; any browser observation belongs in the separate evidence files.

Android Chrome Mobile 156 loaded both diagnostic fonts through `FontFace`, passed `document.fonts.check()`, and rendered the parent `n` and candidate `h` in Canvas without runtime errors. The browser exposes a reduced user agent (`Chrome/156.0.0.0`); `getprop` reports Android 17, API 37, Pixel 7 Pro. The captured PNG is `browser-evidence/android-chrome-canvas.png`; its final machine-readable measurements are in `browser-evidence/android-chrome-results-final.json`. The same-size, same-baseline raster shows the h ascender and shoulder return. Its thresholded raster bounds are `x=516..678`, `y=150..359` in the candidate region; the parent n is `x=116..278`, `y=198..359`. The browser Canvas reports width about 195 CSS px for both at 300 px font size, consistent with the 650-unit advance. Its `actualBoundingBox*` values differ from thresholded raster bounds; those metrics and the pixel threshold are recorded rather than treated as interchangeable outline bounds. The first alpha-only mask counted the opaque white canvas as ink, and an intermediate corrected file had a crop initialization error; both are preserved as evidence history and superseded by the final results file.

`preservation-baseline.json` records the branch, HEAD, staged/modified inventory, untracked baseline count, and hashes of the pre-existing files inspected for this slice. `sha256-manifest.json` verifies those input hashes and inventories the new experiment files and evidence; it excludes its own self-hash.

## Explicit limits

- Only the two documented strings, a new lowercase `h`, and this stem/shoulder-return grammar are supported.
- The open counter is semantic negative space with a baseline opening, not a closed counter contour.
- No arbitrary topology construction, general glyph-add API, font shaping, kerning, broad Unicode support, independent font validation, or universal font correctness is claimed.
- The experiment does not modify production, prototype behavior, the maintained executor, or earlier diagnostic artifacts.
