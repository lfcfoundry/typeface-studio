# Cross-grammar semantic aperture experiment

The same semantic aperture operation now executes on the existing spine-and-bowl structure and an independently constructed concentric elliptical ring. One shared contour-opening routine realizes both boundary descriptions. All new work is isolated in this directory.

## Architecture and implementation evidence

The original aperture-operation executor combined target checks for anatomy.bowl, bowl-specific relation fields and segment lookup with semantic edits, transaction control and geometry construction. It could not execute unchanged against a ring. This experiment imports its operation factory unchanged (`operation === originalFactory`) and its quadratic split function unchanged. It introduces one shared executor and one shared realizer, replacing the hard-coded bowl knowledge with adapter descriptors. The original executor and files remain unchanged; it would be inaccurate to claim the entire original executor was reused unchanged.

- operation.mjs: the shared semantic executor, input validation, negative-space role change, owned ports, revision/diff and rollback. It imports no grammar adapter and contains no grammar/glyph switch.
- grammars.mjs: independent ring anatomy and dimensional derivation; adapters for both grammars. The ring has a region, elliptical outer boundary and concentric counter, with explicit containment/alignment relations. It has no spine, bowl, stacked bands or shoulder.
- boundary.mjs: descriptor validation, closed-support projection, one shared quadratic cut/reconnection routine and geometric checks.
- boundary-contract.md: versioned interface, model conventions, parameterization, supported regions, ports and limitations.
- build.mjs: font adapter calls, inspection data and self-contained review page.
- experiment.test.mjs: fixtures and direct interface, semantic, geometry, transaction and compiled-font tests.

Data flow:

```text
unchanged operation payload + accepted model + explicitly supplied adapter
    -> semantic target / boundary capability resolution
    -> staged negative-space and port edits
    -> grammar-derived closed support geometry
    -> shared boundary realizer
    -> geometric validation
    -> immutable candidate revision
    -> existing fontsketch compiler / internal SFNT audit
```

No grammar registry is implemented; adapters are passed explicitly. The shared semantic convention requires stable nodes, counter containment, decisions and revision identity. It does not accept arbitrary model formats.

## Contract and compatibility changes

The operation type remains semantic.aperture.open. Scope, extent, terminal policy, metric policy, provenance and preconditions are unchanged. The old factory's free-bowl-side identifier is retained as a compatibility alias; exposed-side is the grammar-neutral alias. Exact stable boundary IDs are also accepted. Both adapters expose the left-facing region. The executor rejects missing or ambiguous region matches.

Boundary adapter v1 exposes validate(model), boundaries(model,targetId), and geometry(model). Descriptors give semantic structure/space identities, stable outer/inner contour and segment references, orientation, revision, allowed range, terminal treatments, port ordering and explicit quadratic-local-t parameterization. Neither adapter mutates semantic topology or creates revisions. The same shared realizer consumes descriptors; there are no separate ring/spine aperture implementations.

The isolated aperture-extension state is explicitly version 2: bowlId becomes structureId and records include boundaryId/parameterization with structure-neutral ports. Empty v1 state is read-only input; candidates become v2. Populated legacy v1 state is rejected pending explicit migration. No protected universal design model contract was changed.

## Cross-grammar results

Tests compare the new spine geometry's numeric contour points with the existing aperture implementation exactly. The lower counter and metrics also remain identical. The ring uses independent elliptical parameters (center 325/250, outer radii 270/250, stroke dimensions 70/60); boundaries are four-quadratic approximations, not exact conic arcs. It validates its own containment and concentric relationships without using the spine resolver.

The unchanged operation factory produces a payload consumed by the same execute function for both grammars. The same openBoundary function cuts both contours using their descriptor references. A renamed ring fixture with different glyph and structure identities produces the same structural behavior. The synthetic renaming test is additional evidence beyond source inspection for grammar-name switches.

Both candidates preserve accepted inputs, Unicode identity, decisions and unrelated anatomy. Failures include ambiguous/stale descriptors, bad scope, unsupported extent/treatment, invalid port relationships and deliberate late geometry errors; all return the original model with no candidate revision. Repeated opening is rejected.

## Geometry, continuity and metrics

Closed ring: outer contour plus one enclosed counter. Open ring: one closed ink contour with negative space connected to the exterior, two owned flat terminal ports, and no remaining hole contour. A sampled horizontal path from the cavity through the left opening verifies the exterior channel. Contour closure, winding, nonzero line lengths, G0 adjacency and sampled self-intersections are checked. Concentric dimensions guarantee the closed inner ellipse is smaller; tests check all sampled counter points against the outer boundary.

Closed outer and inner ring contours each have four G0/G1/C1 joins. The opened contour has ten joins: ten G0, six G1 and two C1. The four joins at the flat caps are intentionally sharp. Integer font-unit geometry is measured directly; smoothness is not inferred from a semantic label. Numerical sampling is not an exact computational-geometry proof.

Advance stays 650. Closed bounds x55..595, y0..500 yield bearings 55/55. The open ring loses the leftmost ink, giving bounds x72..595 and bearings 72/55. The revision diff records this consequence under preserve-advance-recompute-bearings. The spine candidate retains its previous bounds and bearings.

## Font and rendering validation

Four new fonts are in artifacts/: closed ring, open ring, combined ring inventory and a spine comparison. The inventory contains .notdef, space, o at U+006F, and unencoded o.open. Both ring constructions retain semantic characterIdentity [111]. The two review fonts encode their respective outline at U+006F. No invented Unicode identity or OpenType alternate switching is used.

Existing fontsketch compilation/parsing and the internal SFNT audit passed required-table, checksum, mapping, contour and metric checks. Independent font validation was not performed: fontTools import failed; ots-sanitize, fonttools, fc-scan and hb-shape were not found. No FreeType/HarfBuzz shared library was found at the checked Termux library paths. No packages were installed.

Actual browser rendering and installation were not tested. No usable browser executable was found. Open review.html directly in Chrome/Firefox to load the exact embedded TTFs, compare ring specimens at multiple sizes, inspect the derived terminal diagram and check each FontFace status. The diagram is labeled derived geometry; it is not font-rendering evidence. The HTML has no external assets or runtime fetch/import dependency.

inspection.json records semantic models, descriptors, diffs, geometry, ports, continuity and compiled glyphs/audits. hashes.json records generated artifact SHA-256 values. file-hashes.sha256 covers the entire new directory except itself.

## Tests and exact reproduction commands

Run from repository root:

```sh
node --test architecture/universal-design-model/construction-experiment/cross-grammar-aperture/experiment.test.mjs
node architecture/universal-design-model/construction-experiment/cross-grammar-aperture/build.mjs
node --test architecture/universal-design-model/*.test.mjs architecture/universal-design-model/integration-experiment/*.test.mjs architecture/universal-design-model/construction-experiment/test/*.test.mjs architecture/universal-design-model/construction-experiment/related-glyph-reuse/test/*.test.mjs architecture/universal-design-model/construction-experiment/two-storey-grammar/*.test.mjs architecture/universal-design-model/construction-experiment/aperture-operation/*.test.mjs architecture/universal-design-model/construction-experiment/cross-grammar-aperture/*.test.mjs
npm --prefix prototype test
node --test test/*.test.mjs
git diff --check
```

Executed results: 12 new tests pass within 101/101 architecture tests; prototype 28/28; production 21/21. Artifact generation succeeds and deterministic font compilation is tested. Build guards refuse to overwrite different artifacts. No protected artifact was rebuilt.

## Interface-quality assessment

| Question | Evidence / status |
|---|---|
| Same semantic operation on both grammars? | Demonstrated: same imported factory and shared executor. |
| Does it know ring or bowl geometry? | No grammar-specific geometry in the executor; it knows the shared containment/port model. |
| Interface sufficient for both? | Demonstrated for the exposed pair of adjacent quadratic boundaries. |
| Grammar adapter responsibilities? | Anatomy/dimensions, closed support validation/geometry and boundary descriptors. |
| Semantic operation responsibilities? | Target/precondition checks, open-space identity, ports, candidate transaction and diff. |
| Pre-geometry validation? | Demonstrated for semantic scope, descriptor capabilities and topology; actual segment existence/adjacency is checked at realization. |
| Remaining grammar-specific behavior? | Ring radii/concentricity and quarter references; spine bands/joins and bowl references; exposed-region mapping. |
| Complex boundaries? | Need richer path intervals, orientation/port contracts, intersection handling and topology-aware composition. |
| Unnecessary coupling? | Shared node/relation conventions and quadratic-local-t are deliberate current limits; no general registry or plugin framework added. |
| New capability? | A data-only boundary description lets one semantic executor AND one geometry realizer operate across independent construction grammars. |

Demonstrated: cross-grammar execution, shared realization, explicit parameterization/ports, immutability, rollback and actual TTF output.

Partially demonstrated: universal semantic operation independence (requires the common model conventions and supported quadratic boundaries), independent anatomy (two grammars only).

Not demonstrated: arbitrary grammar support, integration with the universal operation DAG, independent validation, browser rendering or visual quality.

Unsupported: multiple apertures, rounded caps, arbitrary cubic/multi-interval boundaries, orientation normalization, OpenType switching and topology-changing operation composition. No optional expansion was added; explicit parameterization and port validation were necessary parts of the demonstrated interface.

## Preservation and next milestone

Both prior hash manifests were verified first. baseline.json records 137 protected files plus original Git state; the final preservation test checks every hash. Production, prototype, prior experiments, source, reports, review pages, artifacts and pre-existing uncommitted work remain byte-for-byte intact. All additions are in cross-grammar-aperture/.

Branch remains codex/typeface-studio-first-mvp; HEAD dab1f7359dfc0581f8d28e2dc1af5ef25260e5d5. The nine previously modified prototype files and existing untracked architecture/prototype work remain present. Nothing staged, committed, pushed or installed; no configuration or remotes changed.

Next milestone: connect an adapter capability registration to an isolated universal transaction-executor path and test aperture composition with a scoped reflection. That would replace the local one-operation wrapper with existing selector/dependency/revision handling and expose how boundary identities and ports survive transformations. Do not add arbitrary grammars or terminal styles before that operation-lifecycle boundary is validated.
