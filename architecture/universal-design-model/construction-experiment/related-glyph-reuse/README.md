# Related-glyph construction reuse experiment

This isolated experiment asks whether the existing lowercase `a` bowl-and-stem construction can be reused to derive `b`, `d`, `p`, and `q`. It does not change the accepted construction experiment, prototype, production application, or any existing artifact.

## Result

The narrow construction pattern generalized to these four related glyphs through one shared arrangement constructor. It is more than four named outline recipes: the generator dispatches on a declared stem side and vertical extent, reads the bowl, counter, stem, join, and terminal components through each glyph's semantic relationships, and does not branch on glyph names. The lowercase `a` generated through this path exactly matches the existing `a` outline, bounds, and metrics.

This is not yet a general semantic construction engine. It supports only the fixed `single-storey-bowl-stem-counter` topology, a half-ellipse bowl, a single counter closed by a vertical stem, G1 bowl-to-stem joins, and flat terminals. The geometry code has left/right construction branches. It does not solve arbitrary component graphs, fuse independently constructed shapes, infer anatomy, or support alternative bowl topologies. In particular, the current `a` is a single-storey construction; this experiment does not implement a double-storey `a`.

## Model and construction

The component library defines shared component types and dimensions separately from glyph placements:

- Bowl: half-ellipse profile aligned from baseline to x-height.
- Counter: inset ratios that preserve the negative-space contour.
- Stem: width sourced from the shared `decision:shared-stem-width` parameter.
- Join: G1 continuity requirement at both bowl/stem joins.
- Terminal: flat profile.

Each glyph arrangement has stable part IDs and typed relationships (`bowl-attached-to-stem`, `counter-contained-in-bowl`, `counter-closed-by-stem`, and `stem-ended-by-terminals`). It explicitly sets the stem side and extent:

| Glyph | Stem side | Stem extent | Reason for arrangement |
|---|---|---|---|
| `a` | right | baseline to x-height | Existing single-storey reference |
| `b` | left | baseline to ascender | Ascender rises above the bowl |
| `d` | right | baseline to ascender | Same bowl/stem relation, opposite side from `b` |
| `p` | left | descender to x-height | Stem extends below the baseline |
| `q` | right | descender to x-height | Same descender extent, opposite side from `p` |

The derived geometry engine consumes component IDs and relationship references. It constructs the outer contour and counter from shared dimensions, then derives bounds and side bearings. The `a` source contour is used as a compatibility reference; the newly initialized experiment regenerates `a` through the common constructor.

The candidate model adds `b`, `d`, `p`, and `q` in a candidate revision, records the four `construct.glyph.add` operations, preserves `a`, and leaves its accepted input unchanged. This is an isolated experiment model, not the production universal operation executor.

## Font and review artifacts

- TTF: [`artifacts/LFCFoundry-Related-Glyph-Reuse-abdpq.ttf`](artifacts/LFCFoundry-Related-Glyph-Reuse-abdpq.ttf)
- TTF SHA-256: `4342ebe4d617f80d56278e111dd7a39c480922efc60ba836846749763a8ce14f`
- Self-contained specimen: [`related-glyph-review.html`](related-glyph-review.html)
- Build inspection: [`related-glyph-inspection.json`](related-glyph-inspection.json)

The TTF contains `.notdef`, `space`, and encoded `a`, `b`, `d`, `p`, `q`. The five letters use U+0061, U+0062, U+0064, U+0070, and U+0071. Their advances are 650 units; derived left and right side bearings are 55 units. Bounds are x=55..595; `b` and `d` reach y=700, `p` and `q` reach y=-200, and `a` reaches y=500. The shared stem width is 90 units.

The existing `fontsketch` compiler and the project's internal SFNT audit accepted the font, reporting the expected glyph order, required tables, checksums, mappings, contours, and metrics. No independent fontTools/OTS validation or observed browser rendering is claimed. Open the review HTML in a browser to inspect the embedded font; it reports FontFace load status and presents the glyphs at multiple sizes. Optical quality still requires human review.

## Commands

From the repository root:

```sh
node --test architecture/universal-design-model/construction-experiment/related-glyph-reuse/test/*.test.mjs
node architecture/universal-design-model/construction-experiment/related-glyph-reuse/build-demo.mjs
node architecture/universal-design-model/construction-experiment/related-glyph-reuse/make-review-page.mjs
```

The build and page scripts refuse to replace an existing artifact with different content (and the page builder refuses any existing output file). The test suite records the original TTF and review-page hashes to guard against changes to prior work.

## Generality assessment

This is a successful reuse proof for one related lowercase family: the anatomy vocabulary, components, constraints, and single arrangement algorithm are shared, while attachment side and stem reach vary as explicit glyph construction data. It is not evidence that the engine can construct arbitrary glyph anatomy from a general relationship graph. The next useful generality test would introduce a genuinely different topology (for example, a two-storey `a` or a bowl attached to a separate shoulder) and determine whether the model can express it without a glyph-name branch or final-contour patch.
