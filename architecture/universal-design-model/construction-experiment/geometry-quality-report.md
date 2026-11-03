# Construction Geometry Quality Pass

Date: 2026-11-03

## Summary

The original `n` outline is positionally connected, but several shoulder joins are not tangent-continuous. The outer shoulder has approximately 48° direction changes at stem joins and a roughly 49° change at the crown. The inner counter crown reverses its tangent by about 118°. These are plausible sources of visible corners, especially the inner reversal. The construction now derives a four-segment quadratic outer shoulder from the semantic stem width and shoulder rise, with matching first derivatives at every outer join. The inner counter is represented by two quadratic segments with tangent-aligned stem endpoints and a C1 center join.

The original shared 90-unit stem decision, glyph identities, Unicode mappings, and all horizontal metrics are preserved. Two additional H candidates keep the existing placement as the reference and vary only the semantic `centerRatio` parameter. There is no observed browser rendering in this report, so no optical winner is claimed.

## Original `n` continuity analysis

For a quadratic Bézier segment from `P0` through control point `C` to `P1`, the endpoint derivatives are `B'(0)=2(C-P0)` and `B'(1)=2(P1-C)`. A line segment is parameterized over `[0,1]` by its endpoint difference. G0 means the adjacent endpoints coincide; G1 means the derivative vectors point along the same ray; C1 means the vectors are equal. C1 depends on the chosen parameterization, while G1 describes tangent direction.

The original TTF's TrueType points identify the following adjacent segments:

| Join | Incoming derivative | Outgoing derivative | G0 | G1 | C1 | Direction change |
|---|---:|---:|---|---|---|---:|
| Left outer stem → outer shoulder | `(90, 0)` | `(162, 180)` | Yes | No | No | 48.01° |
| Outer quadratic 1 → 2 | `(198, -90)` | `(198, 90)` | Yes | No | No | 48.89° |
| Outer shoulder → right outer stem | `(162, -180)` | `(90, 0)` | Yes | No | No | 48.01° |
| Right inner wall → inner quadratic | `(0, 290)` | `(-162, 660)` | Yes | No | No | 13.80° |
| Inner quadratic 1 → 2 | `(-198, -330)` | `(-198, 330)` | Yes | No | No | 118.08° |
| Inner quadratic → left inner wall | `(0, -330)` | `(0, -290)` | Yes | Yes | No | 0° |

At the last join the printed vector order is the segment traversal order: the incoming vector is `(0,-330)` and outgoing is `(0,-290)`, so it is G1, but not C1. At the first inner join, the line and curve meet at `(505,290)`; the derivative vectors are not parallel, so it is G0 only. At the inner crown, the vectors point to opposite sides of the contour tangent and are not collinear, producing the largest mathematical discontinuity. Direction discontinuities of 48° and 118° are substantial enough to make a visible kink likely, though actual rasterized severity still requires visual review.

The calculations use the actual outline points parsed from the preserved base TTF, not estimates from the UI or semantic labels. Segment/control-point data is visible in [artifact-inspection.json](./artifact-inspection.json).

## Construction correction

The `n` retains its semantic anatomy: left and right stems, a shoulder, and two shoulder joins. The geometry method now derives the shoulder from semantic parameters rather than patching final output points:

- Shared stem width: 90 font units, unchanged.
- Shoulder rise ratio: `0.44`, producing a 40-unit rise for the 90-unit stem.
- Inner aperture endpoint ratio: `0.58` of the 500-unit x-height, producing endpoints at y=290.
- The outer shoulder span is divided into four quadratic segments. Their endpoint derivative vectors are constructed as `(90,0)`, `(90,40)`, `(90,0)`, `(90,-40)`, and `(90,0)`. Adjacent quadratic endpoints and derivatives therefore match exactly. The line-to-curve stem joins also have equal `(90,0)` derivatives.
- The counter arch uses two quadratics. Its endpoint tangents align with the vertical inner stem walls; the two quadratics meet at the center with equal `(-360,0)` derivatives.

Every join remains G0. All five outer joins are G1 and C1. Both inner endpoint joins are G1 but not C1: line derivatives have magnitudes 290 while the corresponding curve derivatives have magnitudes 330. The inner center join is G1 and C1. The endpoint speed difference is a parameterization difference rather than an angular corner. The existing contour validator accepts the closed contour and winding; the regression test also checks generated geometry determinism.

The correction changes only the derived `n` outline. It preserves its identity (`glyph:u006e`), U+006E mapping, advance (650), left side bearing (55), and right side bearing (55). The `o` and `H` outline structures remain exactly equal to the original base artifact.

Implementation references: [semantic parameters](./model.mjs), [derived geometry](./geometry.mjs), [construction operations](./engine.mjs), [candidate setup](./scenarios.mjs), and [geometry regressions](./test/construction.test.mjs).

## H crossbar comparison

All candidates use the same 90-unit crossbar thickness, 700-unit cap height, glyph identity, Unicode mapping, advances, and bearings. The semantic parameter is the crossbar's center ratio relative to cap height.

| Candidate | `centerRatio` | Center y | Crossbar band | Relationship |
|---|---:|---:|---:|---|
| Existing placement (reference) | `367/700` = 0.524286 | 367 | 322–412 | 17 units above geometric midpoint |
| Exact midpoint | 0.50 | 350 | 305–395 | Geometric reference |
| Modestly below midpoint | 0.48 | 336 | 291–381 | 14 units below midpoint (2% of cap height) |

These are separate parameter-driven candidates, not edits to the same contour. The 0.48 alternative is a modest comparison offset chosen to expose a visible difference without changing thickness. No optical preference is asserted because the fonts were not observed in a browser or desktop renderer.

## Artifact comparisons

The original artifacts remain unchanged:

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `LFCFoundry-Semantic-Construction-Base.ttf` | 1,580 | `f94fcae18a65a32d3f486d7f4fa652826c8f87832a79a3eae02bff76e9473824` |
| `LFCFoundry-Semantic-Construction-Open-Counter.ttf` | 1,580 | `00065a4210071d36ecaf4f25ed7808fb74ee04f665627f0f204e4c6131492018` |

New fonts were written to distinct paths:

| Artifact | Bytes | SHA-256 | Internal SFNT audit |
|---|---:|---|---|
| `LFCFoundry-Semantic-Construction-Smooth-N-Current-H.ttf` | 1,576 | `b1ef7eaabdd7b134d11cfbafd7bc5dc88653ac8d08faaaefd27c88ef3ab18fad` | Pass |
| `LFCFoundry-Semantic-Construction-Smooth-N-H-Midpoint.ttf` | 1,576 | `3587987a2da0ceb674e1244485254943d2ec8ed608e9424db693cb35250cbbdd` | Pass |
| `LFCFoundry-Semantic-Construction-Smooth-N-H-Low-0_48.ttf` | 1,576 | `cbce373331f70deb77b793848631f877dbb86582c0640fa3945d9cdfebfa0eb6` | Pass |

The compiler-related `fontsketch` parser compared the actual generated TTF outlines. Against the old base TTF, only lowercase `n` differs: `.notdef`, `space`, `o`, and `H` have exactly equal parsed contours. For all five glyphs, Unicode mappings, advances, and SFNT-audited horizontal metrics (advance plus left side bearing) are equal. Each H candidate differs from the corrected-current-H font only in `H`'s outline; all other glyph outlines, all Unicode mappings, and all horizontal metric rows are equal. The artifact inspection also confirms the two original `o` variants are included and retain their distinct counters.

This is an exact comparison of compiler/parser-produced glyph structures and audit metric records from the actual TTF files. It is not independent font validation: `fontsketch` is the compiler's own implementation family, and `auditSfnt` is this project’s internal SFNT audit.

## Review and validation limits

[geometry-quality-review.html](./geometry-quality-review.html) embeds the exact bytes of the two original fonts and all three new candidates. It uses browser `@font-face` / Font Loading API and displays `o`, `n`, and `H` at 12, 32, and 72 px with a specimen line. Open it directly in a browser to visually compare the n shoulder, H placements, and both original o counters. The included payloads were checked byte-for-byte through their SHA-256/base64 representation.

No browser renderer could be observed in this environment during this pass. The review page is prepared, but browser loading, rasterized smoothness, and optical acceptability are **not tested**. Python fontTools and OTS are unavailable; no independent parser or sanitizer ran. Internal parsing, required table presence, table checksums, whole-font checksum, and the project SFNT audit passed for all five files. This does not establish installation or cross-application behavior.

## Tests and reproduction

Commands run:

```sh
node --test architecture/universal-design-model/construction-experiment/test/*.test.mjs
npm --prefix prototype test
node --test architecture/universal-design-model/contract.test.mjs architecture/universal-design-model/writing-context.test.mjs architecture/universal-design-model/shaping-request-adapter.test.mjs architecture/universal-design-model/integration-experiment/integration.test.mjs architecture/universal-design-model/construction-experiment/test/*.test.mjs
node --test test/*.test.mjs
git diff --check
```

Results: construction experiment 11/11 passed; architecture/contract/writing-context/shaping/integration/construction group 52/52 passed; production regression suite 21/21 passed; prototype suite 28/28 passed; `git diff --check` passed. Tests inspect generated contours and compiled font data, but browser rendering and independent font validation remain untested.

The new artifacts and reports can be regenerated/checked with:

```sh
node architecture/universal-design-model/construction-experiment/build-quality-candidates.mjs
node architecture/universal-design-model/construction-experiment/make-quality-review-page.mjs
node architecture/universal-design-model/construction-experiment/inspect-quality-candidates.mjs
```

The builder refuses to overwrite an existing quality font. The original Base and Open-Counter artifact paths are not written by these commands.
