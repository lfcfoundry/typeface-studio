# Semantic glyph construction experiment

This isolated experiment demonstrates one executable bridge from the universal design model v2 to font geometry. It does not replace the production or prototype generator and does not change the separate contour-operation integration experiment.

## Model boundaries

- **Semantic anatomy** is recorded in `glyphRegistry.glyphs[].construction`: stable nodes identify bowls, counters, stems, shoulders, joins, and crossbars; typed relations express containment, attachment, alignment, and shared parameter use.
- **Design parameters** are universal-model `state.characteristics` decisions. Shared stem width, x-height, and cap height are referenced by anatomy nodes. A glyph-specific counter scale remains on the counter node.
- **Derived geometry** is emitted separately at `derived.geometry.glyphs`: stable quadratic contours, bounds, metrics, provenance node IDs, and construction hash. Geometry is not used as the semantic input.
- **Font representation** is an adapter view with glyph IDs/names, Unicode mappings, advances, side bearings, and the same derived contours.

The construction record is a versioned extension on the existing v2 glyph model, not a competing document envelope. Its registered methods are small procedural construction operators rather than typeface-family branches:

1. `construction.ring-from-bowl-counter` derives lowercase `o` outer bowl and negative counter contours from x-height, shared stem width, overshoot, advance, and counter scale.
2. `construction.connected-stems-and-shoulder` derives lowercase `n` as one connected outer contour around two stems and a curved arch. The open lower counter is negative space, not a closed counter contour.
3. `construction.parallel-stems-and-crossbar` derives uppercase `H` as one closed silhouette from two aligned stems and a joining crossbar.
4. `construction.bowl-with-attached-stem` is used only by the isolated lowercase-a generality experiment below. It derives a single-storey bowl/counter attached to a right-side terminal stem from explicit anatomy, shared stem/x-height decisions, and a selected topology. It is not a default for lowercase `a` and does not claim support for the two-storey form.

All three share the same 90-unit primary stem decision. Their anatomy and construction relationships differ; no geometric/humanist/serif family selector is involved. Final outlines use the existing quadratic contour primitives and validator from `prototype/src/contours.js` as a derived-geometry layer.

## Scoped construction operation

`construct.parameter.set` targets lowercase `o` through a revision-bound exact glyph selector and changes only `part:o-counter.parameters.scale` from 0.78 to 1.0. The operation uses the universal-model operation fields (identity, selector, phase, parameters, dependencies, pre/postconditions, metric policy, provenance, capability, and resolution). The existing integration experiment's `resolveSelector` is reused. Its transaction executor handles geometry-only heart/reflection operations, so this construction-specific adapter stages the semantic parameter change, regenerates the selected glyph, validates it, and emits a candidate revision without modifying the accepted input.

Only `o` geometry is regenerated; `n` and `H` carry forward their geometry snapshot unchanged. The candidate diff records the changed semantic parameter, changed glyph, preserved glyphs, and preserved base decisions. A failed construction operation returns `rejected` and leaves the input model unchanged.

## Font compilation

`font-adapter.mjs` adapts the three derived glyphs to the existing `compileTypeface` path in `prototype/src/font.js`; it does not duplicate or modify the compiler. That path uses the already-present `fontsketch` 0.1.0 package (MIT) and its parser/checksum checks. `prototype/src/sfnt-audit.js` adds an internal project SFNT audit. fontsketch supplies `.notdef` and `space`, so each TTF contains five glyph records: those two plus `o`, `n`, and `H`.

Build the demonstration artifacts with:

```sh
node architecture/universal-design-model/construction-experiment/build-demo.mjs
```

This writes base and open-counter candidate fonts into `architecture/universal-design-model/construction-experiment/artifacts/`.

Run focused tests with:

```sh
node --test architecture/universal-design-model/construction-experiment/test/*.test.mjs
```

Run the wider regression set with:

```sh
node --test architecture/universal-design-model/contract.test.mjs architecture/universal-design-model/writing-context.test.mjs architecture/universal-design-model/shaping-request-adapter.test.mjs architecture/universal-design-model/integration-experiment/integration.test.mjs prototype/test/*.test.mjs architecture/universal-design-model/construction-experiment/test/*.test.mjs
```

## Presentation boundary and limitations

The construction engine has no direction or writing-mode input. A horizontal or vertical presentation can reference the same semantic construction and derived outline. This is only a shared-construction reference demonstration: no vertical alternate, vertical metrics, script shaping, hinting, or vertical placement is generated.

The registered construction methods are a narrow proof of the semantic-to-contour path, not a general construction grammar. The `n` shoulder and `H` silhouette are constructed procedurally from semantic nodes and shared measurements, but each method still encodes a limited structural algorithm. The existing contour validator samples curves for topology checks. Font compiler parsing, checksum checks, and `auditSfnt` are internal checks, not independent validation; fontTools and OTS are not installed in the inspected environment.

## Lowercase `a` generality experiment

The separate `a-experiment.mjs` adds a lowercase `a` as a candidate revision without changing the accepted `o`, `n`, and `H` design. The model explicitly selects `single-storey` topology, a right-side stem, a left-half-ellipse bowl profile, a contained counter, two bowl/stem joins, and flat upper/lower stem terminals. The geometry method reads those anatomy nodes and the shared stem-width/x-height decisions, then derives outer and counter quadratic contours; it does not store final output coordinates as its semantic description.

Build the new TTF and inspection record, then create its separate browser review page:

```sh
node architecture/universal-design-model/construction-experiment/build-lowercase-a-demo.mjs
node architecture/universal-design-model/construction-experiment/make-lowercase-a-review-page.mjs
```

The builder refuses to overwrite an existing artifact or inspection record. It emits `artifacts/LFCFoundry-Semantic-Construction-Lowercase-A-Experiment.ttf`, `lowercase-a-inspection.json`, and `lowercase-a-review.html`. Run the focused construction tests with:

```sh
node --test architecture/universal-design-model/construction-experiment/test/*.test.mjs
```

This experiment adds one more registered construction pattern. It demonstrates extensibility of the current method-dispatch architecture, but it does not provide a generic anatomy-to-outline solver. One bounded alternate profile, a role-relative upper-stem chamfer, is represented semantically and derived by both the single-storey `a` adapter and the spine-and-bowl adapter. The shared contract covers stable identity, terminal role, profile, local orientation, and a cut ratio relative to stem width; geometry and topology validation remain adapter-specific. See [the terminal-profile contract](./terminal-profile.md). Other terminal profiles, support for lower terminals, arbitrary anatomy graphs, broader bowl topology, and browser-observed visual quality remain unsupported or unverified.
