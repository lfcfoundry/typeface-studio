# Semantic aperture operation experiment

All work is isolated here. The starting branch is codex/typeface-studio-first-mvp at dab1f7359dfc0581f8d28e2dc1af5ef25260e5d5. baseline.json records the original working-tree status and SHA-256 hashes of 125 existing files, excluding Git metadata and installed dependencies. The prior two-storey manifest was verified before implementation.

## Architectural findings

The previous grammar represents each enclosed region as an anatomy.counter with a contained-by relation to a bowl. Bowls attach to one spine, terminals attach to its top/bottom ports, and explicit connectors link adjacent bowls. Its resolver requires one counter per bowl; its geometry emits one combined outer perimeter plus a separate contour for each counter. Geometry dispatch is structural, but the only registered topology is a stack of enclosed left-attached bowls.

The universal operation representation can carry a semantic target, parameters, dependencies and provenance. Its integration-experiment executor has a closed dispatch for heart substitution and reflection; the earlier construction executor similarly registers only specific scalar edits. Neither can execute an aperture without a new realizer. This experiment therefore implements a small isolated transaction wrapper, preserving the contract concepts without modifying either protected executor. It has no general DAG or multiple-operation scheduler and is not registered in the universal model runtime.

## Operation and extension contract

`semantic.aperture.open` is a semantic construction operation. Its target identifies one glyph and exactly one anatomy node; it does not inspect glyph names or Unicode identity. Required fields are stable operation id, phase construction, explicit provenance with intent IDs, target glyphId/nodeIds, preconditions revisionId/topology=enclosed, and parameters:

- boundary: free-bowl-side. The side opposite the attached spine in this adapter.
- halfExtent: 0.1..0.4, dimensionless. For this quadratic adapter it removes the final fraction of the lower half-boundary and initial fraction of the upper half-boundary. This is local curve parameter extent, not an angle or arc-length measure.
- terminal: flat. Other treatments are explicitly rejected.
- metricPolicy: preserve-advance-recompute-bearings. An opening can remove an extremum; the resulting bearings must describe actual ink bounds.

The existing construction data is retained, with a new apertureExtension v1 payload. The selected counter node keeps its stable ID and parameters but becomes open-space. Its contained-by relation becomes open-space-of, and the aperture record links bowl, open space, boundary extent and two terminal port IDs. Each port declares lower/upper side, aperture and bowl ownership, outer/inner boundary connection and treatment. The derived port record provides labeled outer/inner endpoint coordinates and its cap segment ID. This makes intentional opening distinct from a malformed contour.

The semantic node/boundary instruction could be realized by other construction adapters. The current parameter interpretation and geometric implementation remain specific to the spine/bowl grammar. This experiment does not claim universal aperture execution.

## Validation and derivation

The semantic resolver rejects missing or multiple target nodes, incompatible anatomy, invalid boundary or extent, missing/reversed/duplicate ports, contradictory enclosure, orphan open spaces and unsupported multiple apertures. It creates a read-only closed-support projection for the unchanged grammar resolver. This projection restores the original counter only for dimensional support calculation; it does not replace the candidate's explicit open topology.

The realizer uses exact de Casteljau subdivision of the selected outer and inner quadratic boundaries before integer font-unit quantization. It removes the designated outer opening and splices the surviving inner boundary into the outer ink perimeter through two flat terminal caps. The former negative space becomes connected to the exterior; its separate counter contour disappears. Ink contours remain closed, as required for TrueType filling. An open semantic bowl must not be confused with an unclosed font contour.

The upper opening leaves the lower counter, spine segment, connectors, bounds, advance and bearings exactly unchanged. Tests also sample an uninterrupted exterior channel through the former upper cavity and inspect each lower-counter sample against the resulting outer boundary. The existing validator checks winding, bounds, degenerate area and sampled self-intersections. These numerical checks are not a general exact intersection/containment proof.

Continuity comes from actual endpoint derivatives. All resulting segment junctions are G0. The waist transitions retain G1, with C1 only where derivatives match. Both sides of each new flat cap are intentionally sharp (not G1 or C1). Inner spine/counter corner discontinuities also remain. No smooth terminal claim is made.

## Transactions, preservation and generality

Execution validates the accepted source, revision precondition and semantic operation, stages an independent clone, resolves and derives the complete affected glyph, validates it, and only then creates a candidate revision. Rejection returns the original model reference, an error and no diff. No accepted state is mutated. Dependencies beyond the empty set are rejected instead of silently reordered. Repeated application is explicitly non-idempotent and rejected, even if an open candidate is marked accepted for a test. The wrapper does not implement acceptance, merging or full revision history.

All unaffected anatomy records and design decisions remain identical. The target bowl identity is preserved; the selected negative-space identity is retained with its new semantic role. The diff lists changed nodes, added opening/ports, preserved counter IDs, preserved decisions and before/after metrics.

The same operation and realizer also open a synthetic one-bowl structure with renamed glyph and anatomy identities and no Unicode encoding. This proves reuse beyond the named lowercase a case within the same grammar. It exposed a useful metric consequence: opening the sole bowl changes its extreme ink position, so bearings are recomputed while advance is preserved. The two-storey case keeps the original metrics because its lower bowl still determines the extents.

No additional operation was added: the unresolved high-value question is transfer to another construction grammar, rather than more features on this adapter.

## Fonts and review

artifacts/LFCFoundry-Aperture-inventory.ttf contains .notdef, space, a at U+0061, and unencoded a.open. No extra Unicode assignment or GSUB switch is introduced. Separate enclosed/open review fonts each map their form to U+0061. Tests compare compiled lower contours exactly and confirm deterministic font bytes. Both forms have advance 650, bearings 55/55 and bounds x55..595, y0..500. Enclosed form has three contours, open form two.

review.html embeds the exact three generated fonts, displays reference/candidate specimens at 24/64/170px, reports FontFace status and shows the unchanged lower counter as a clearly labeled derived SVG diagram. The diagram is not font-rendering evidence. Open this HTML directly on Windows or Android and inspect upper-left aperture, flat caps, waist and small-size counter behavior. The inventory's alternate cannot be selected in ordinary text without additional shaping support.

inspection.json includes source/candidate models, operation, revision diff, geometry, port coordinates, continuity, synthetic result, compiled glyph records and internal SFNT audits. hashes.json records hashes of the fonts, HTML and inspection report; file-hashes.sha256 additionally covers source/report files.

Validation evidence:

- Semantic/operation/revision validation: passed.
- Geometry validation: passed with the numerical limitations above.
- Existing fontsketch compilation/parser and internal SFNT audit: passed. These are internal checks, not independent validation.
- Independent parser/sanitizer: not tested. fontTools import failed; ots-sanitize, fonttools, fc-scan and hb-shape executables were not found. FreeType/HarfBuzz libraries were not found at the checked Termux library paths.
- Browser rendering: not tested. No usable browser executable or automation tool was available. Generated FontFace code does not establish successful rendering.
- Installation and optical quality: not tested.

## Reproduction and tests

Run from the repository root:

```sh
node --test architecture/universal-design-model/construction-experiment/aperture-operation/aperture.test.mjs
node architecture/universal-design-model/construction-experiment/aperture-operation/build.mjs
node --test architecture/universal-design-model/contract.test.mjs architecture/universal-design-model/writing-context.test.mjs architecture/universal-design-model/shaping-request-adapter.test.mjs architecture/universal-design-model/integration-experiment/integration.test.mjs architecture/universal-design-model/construction-experiment/test/*.test.mjs architecture/universal-design-model/construction-experiment/related-glyph-reuse/test/*.test.mjs architecture/universal-design-model/construction-experiment/two-storey-grammar/grammar.test.mjs architecture/universal-design-model/construction-experiment/aperture-operation/aperture.test.mjs
npm --prefix prototype test
node --test test/*.test.mjs
git diff --check
```

Final results: 11 new tests passed within 89/89 architecture tests; prototype 28/28; production 21/21. Build passed. The preservation test confirms all 125 existing source/artifact files match their initial hashes. The first synthetic test initially rejected a legitimate bounds change; the explicit metric policy corrected that restriction, and the final synthetic test passes. Build output guards refuse to overwrite different artifacts. No production/prototype build was run.

## Capability assessment

Demonstrated: explicit enclosed-to-open semantic change; two owned terminal ports; structural targeting independent of glyph identity; transactional candidate derivation; reuse on one- and two-bowl topologies; preserved lower geometry/metrics through TTF compilation.

Partially demonstrated: generic semantic aperture (one grammar realizer only), port architecture (flat outer/inner connections only), general revision execution (local single-operation wrapper).

Not demonstrated: cross-grammar reuse, observed browser rendering, independent font validation, optical quality.

Unsupported: multiple apertures, spine-side openings, rounded caps, arbitrary boundary profiles, script shaping and OpenType alternate switching.

Responsibilities: semantic model records open/closed space and port ownership; operation layer resolves target/preconditions and stages revisions; grammar provides anatomy/boundary support and dimensional constraints; realizer subdivides and reconnects contours; compiler consumes resulting ink geometry without knowing the aperture recipe.

Next milestone: define a boundary/port realizer interface and demonstrate this same semantic operation on an elliptical ring construction. This would directly test whether the operation can transfer beyond the spine-and-bowl grammar, without expanding glyph inventory or silently making this adapter universal.

Final Git branch/HEAD remain codex/typeface-studio-first-mvp / dab1f7359dfc0581f8d28e2dc1af5ef25260e5d5. Nothing staged, committed, pushed or installed. Prior modified and untracked work is preserved; additions are confined to aperture-operation/.
