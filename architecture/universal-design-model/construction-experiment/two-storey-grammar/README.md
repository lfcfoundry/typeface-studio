# Spine-and-bowl-stack construction grammar

This isolated experiment derives single-storey and experimental two-storey lowercase a through the same constructor. All pre-existing files remain protected by preservation-baseline.json (111 files, excluding Git metadata and installed dependencies). No application, prior experiment, contract, package or existing artifact is edited.

## Baseline findings

Existing construction/model.mjs version 1 represents anatomy nodes and relations within universal design model v2. Its geometry dispatches to named construction methods. a-experiment.mjs adds one bowl, counter, right stem, joins and flat terminals. The related-glyph experiment separates definitions from arrangements, but its constructor assumes exactly one counter and one bowl, with left/right branches and implicit vertical join positions. Existing PathBuilder, winding normalization, bounds, geometry validation, font adapter, and fontsketch integration are reusable. Existing operation execution creates immutable candidates but only supports its registered parameter types; this experiment does not extend that executor or change its contract.

The earlier one-bowl representation cannot express independent upper/lower enclosure and a connecting waist. This experiment introduces an explicitly versioned local construction payload (`lfcfoundry.spine-bowl-grammar`, version 1, universalModelVersion 2). It is a proposed construction-extension payload, not a replacement universal model or a claim that the old semantic validator supports its method. An eventual adapter must register and validate this payload before inserting it into a full universal design revision.

## Demonstrated grammar

Definitions in `library` are shared by all anatomy instances. `design()` is a fixture author: it supplies one or two bowl arrangements. `resolve()` and `derive()` do not inspect glyph names, encoded characters, or a single/two-storey label. They operate on nodes, dimensions and relationships.

Nodes have stable identities, component references and parameters. Relations state bowl-to-spine attachment, counter-to-bowl enclosure, terminal-to-spine ports, and ordered connector endpoints. The resolver establishes the vertical order from resolved bands, verifies the declared connections agree with that order, and rejects missing/duplicate enclosure, unsupported side/continuity, missing references, orphan counters/connectors, overlapping bands and collapsed negative spaces before any PathBuilder is allocated. One bowl may not borrow another bowl's counter.

The fixed grammar constraints require one right-hand spine, left-attached bowls, one counter per bowl, stable upper/lower terminal nodes at the top and bottom spine ports, ordered nonoverlapping bands and enough clearance for rounded connectors. The resolver keeps both terminal profiles flat by default and accepts one alternate profile on the upper terminal. These constraints are implemented by the resolver; this is not a general declarative constraint solver. Nor does the grammar support arbitrary anatomy graphs, component rotations or Boolean unions.

## Bounded semantic upper-terminal profile

The `top` node has role `upper-stem-terminal`, and its `terminates` relation assigns it to the `spine` at port `top`. The default semantic parameters are `{ profile: 'flat' }`; they preserve the saved flat geometry and font bytes. Older version-1 fixtures that omit terminal role and parameters remain readable as flat terminals from their top/bottom spine port; the profile operation requires an explicit role. The supported alternative is `{ profile: 'chamfered', orientation: 'outer-right', cutRatio: 0.2 }`. Orientation is in the stem's local frame, where x increases toward the glyph's right edge. The dimensionless ratio is measured against `decisions.stem`; with the 90-unit fixture stem, it yields an 18-unit cut. The resolver rejects unknown profiles, extra fields, other orientations, nonfinite or out-of-range ratios, cuts below one unit, and use on the lower terminal.

The adapter derives the top edge and diagonal from the terminal role and validated parameters. It keeps the terminal ID, owner relation, bowl topology, and counter geometry unchanged. The altered points are inside the existing outline bounds (`x=55..595`, `y=0..500`); advance stays 650 and side bearings recompute to 55/55. These are bounds from the derived geometry. The existing contour validator and sampled counter checks pass, but do not prove arbitrary-curve intersection or containment. This is one adapter realization, not a general terminal profile facility.

Both forms derive geometry using the same sequence: terminal and spine boundary, iterate bowl boundaries, insert the relation-selected rounded return connector between adjacent bowls, and generate each bowl's counter. No final contour coordinates are supplied by the fixture. Coordinates derive from baseline, x-height, advance, bearing, stem width, normalized band proportions, width ratios and counter insets. Bowl definitions and join mechanisms are reused; final contours remain derived editable output with stable point IDs.

Default decisions are baseline 0, x-height 500, stem 90, advance 650, bearing 55, connector radius 20. The single bowl occupies 0..1 x-height and width ratio .9 with stem-sized counter insets. The two-storey lower bowl occupies 0...58, width .9, inset .65 stem; the upper bowl .66..1, width .68, inset .5 stem. These are explicit experimental construction choices, not measured optical optima. The geometry is a stylized sealed-upper-bowl form as required by the two-counter test. Conventional two-storey a designs often use an open upper aperture; conventional readability has not been demonstrated here.

## Continuity and geometric evidence

The single-storey output exactly reproduces the established a's numeric contour points and metrics, with new identities. The two-storey output has one outer and two counter contours. All forms have bounds x55..595, y0..500 and advances 650, bearings 55/55.

Each outer contour segment transition is positionally continuous (G0). All three waist connector transitions are G1. The middle connector transition is also C1; transitions from large bowl curves to small connector curves have unequal derivatives and are not C1. Both bowl midpoint joins are C1. The default flat terminal corners are deliberately G0 only; the upper chamfer adds a role-relative straight diagonal while retaining the lower flat terminal. Tests compute derivatives from the actual quadratic controls, rather than inferring smoothness from a label. Parametric continuity is reported using each segment's local t in [0,1].

The existing validator tests integer bounds, winding, sampled self-intersections and area; additional tests check every sampled counter point against the outer boundary. Disjoint vertical bowl bands provide separation between counters. This is useful numerical evidence for this restricted geometry, not an exact robust intersection or containment proof for arbitrary curves. Optical quality is unverified.

## One additional improvement

`resizeBowl()` demonstrates an immutable semantic parameter candidate. It changes the upper bowl width ratio .68 to .62, validates/regenerates geometry before returning, records a scoped node operation with explicit provenance and parent revision, and preserves its input on failure. Tests verify the single form and lower counter remain identical in compiled output, with unchanged metrics. Regeneration covers the whole affected glyph because its outer perimeter is shared; unrelated glyphs need not regenerate. This local candidate helper is not integrated with the universal selector/DAG executor and does not implement general revision acceptance/history.

## Font representation and review

`font.mjs` adapts derived glyphs directly to the existing compiler without altering it. The inventory contains .notdef, space, a (U+0061), and a.alt (unencoded). Both semantic constructions record characterIdentity [97]; encoding is separate. There is no fabricated second Unicode code point. No GSUB, stylistic-set switch or shaping behavior is implemented.

The two review fonts encode their respective form at U+0061. Compiled outlines match the corresponding inventory glyphs exactly. A third review font displays the upper-width candidate. `review.html` embeds all four exact TTF byte sequences, registers them separately using FontFace, reports status, and shows specimens at 24/64/160 px. Open it directly in a browser; no server, asset or network fetch is needed. Inspect the waist, the shallow upper counter, apparent stroke differences, terminal corners, small-size readability, and whether the shape reads as a. FontFace success must be observed on the user's browser before it is reported as tested.

`inspection.json` records full construction payloads, revision diff, compiled glyphs, table audit, metrics, bounds, contour counts and segment continuity. `hashes.json` records the generated TTF, inspection and HTML hashes. Its own SHA is reported separately below.

Validation categories:

- Semantic resolution: executed; supported constraints validated before geometry.
- Geometry: executed; deterministic construction and numerical checks passed.
- Internal compilation: executed through existing fontsketch; required tables and checksums passed.
- Independent parsing/sanitization: not tested. Python fontTools is unavailable; ots-sanitize, fc-scan and hb-shape executables and FreeType/HarfBuzz shared libraries were not found in the checked Termux locations.
- Browser rendering: not tested. No browser automation tool or browser executable was available. The review page is a manual inspection facility, not evidence of observed rendering.
- Installation and conventional typographic quality: not tested.

## Reproduction and results

Run from repository root:

```sh
node --test architecture/universal-design-model/construction-experiment/two-storey-grammar/grammar.test.mjs
node architecture/universal-design-model/construction-experiment/two-storey-grammar/build.mjs
node --test architecture/universal-design-model/contract.test.mjs architecture/universal-design-model/writing-context.test.mjs architecture/universal-design-model/shaping-request-adapter.test.mjs architecture/universal-design-model/integration-experiment/integration.test.mjs architecture/universal-design-model/construction-experiment/test/*.test.mjs architecture/universal-design-model/construction-experiment/related-glyph-reuse/test/*.test.mjs architecture/universal-design-model/construction-experiment/two-storey-grammar/grammar.test.mjs
npm --prefix prototype test
node --test test/*.test.mjs
git diff --check
```

Results: 11 new tests passed within the 78-test architecture run; prototype 28/28, production 21/21. The build passed. Existing-output guards refuse to replace a generated file with different bytes. No production build is run. The preservation test compares all 111 original files, including uncommitted source, artifacts, review pages, reports and test files, against the initial SHA-256 baseline.

## Capability assessment and next milestone

Demonstrated: definition reuse, multiple explicit enclosures, topology resolution before geometry, one constructor for two topologies, G1 rounded attachments, immutable structural parameter candidates and actual TTF output with an unencoded alternate.

Partially demonstrated: semantic graph construction (restricted grammar only), derived editable geometry (data available, no editing UI), relationship-driven composition (only the registered spine/bowl/connector grammar).

Not demonstrated: conventional visual quality, independent font validation, browser loading, arbitrary glyph synthesis and integration into universal accepted-state execution.

Unsupported: open upper bowls, independent shoulders/diagonals, arbitrary graph layouts, right-attached stacks, general outline unions, variable fonts and OpenType alternate switching.

The next concrete milestone should open the upper bowl through a semantic aperture operation while preserving the lower enclosure and testing actual rendered readability. That would challenge this closed-stack grammar with an open structure and explicit terminal ports. Do not generalize a complete arbitrary anatomy solver or add unrelated glyphs yet.

Git baseline and final branch: codex/typeface-studio-first-mvp; HEAD dab1f7359dfc0581f8d28e2dc1af5ef25260e5d5. Nothing staged, committed or pushed. The previously modified prototype files and untracked architecture/prototype work remain intact. All additions are confined to this new directory.
