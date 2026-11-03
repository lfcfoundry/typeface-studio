# Lowercase `a` Construction Generality Experiment

Date: 2026-11-03

## Result

The experiment adds an actual single-storey lowercase `a` to an immutable candidate based on the current accepted `o`, `n`, and `H` design. Its geometry is derived from semantic bowl, counter, stem, join, and terminal records plus the shared stem-width and x-height decisions. The new font passes the existing compiler/parser and internal SFNT audit. Parsed outlines and metrics for `o`, `n`, and `H` match the three-glyph compiled design exactly.

This demonstrates that the current model can express and generate one more construction structure. It does **not** establish a general semantic construction solver: geometry remains dispatched to a method-specific algorithm, and this experiment adds another registered method.

## Decisions represented explicitly

Lowercase `a` does not have one mandatory form. This experiment explicitly selects:

- `topology: single-storey`; the two-storey form is not implied or supported here.
- A right-side vertical stem.
- A left-half-ellipse bowl profile aligned to the shared x-height.
- An enclosed bowl counter.
- Flat top and baseline stem terminals.
- Upper and lower bowl-to-stem joins.
- Shared stem width and x-height references; bowl width and counter insets are glyph-specific ratios.

The semantic record is in [a-experiment.mjs](./a-experiment.mjs). The new method's validation is in [model.mjs](./model.mjs), and its parameter-driven contour derivation is in [geometry.mjs](./geometry.mjs).

## Construction and derived geometry

At the current parameters, advance is 650, right side bearing is 55, stem width is 90, and x-height is 500. Therefore:

- Stem outer edge is `x = 650 - 55 = 595`; stem inner edge is `x = 595 - 90 = 505`.
- Bowl width is `0.9 × 500 = 450`, so its left extent is `505 - 450 = 55`.
- Its outer boundary consists of the rectangular right stem, flat top and bottom terminals, and two quadratic arcs around the left bowl. The arcs are calculated from the bowl width and x-height, not stored as final contour coordinates in the semantic record.
- The counter uses one shared stem-width inset horizontally and vertically: its left extent is x=145, its attachment edge is x=505, and its vertical range is y=90..410. Two quadratics form the rounded left counter and a vertical segment closes it against the stem.

The resulting bounds are x=55..595 and y=0..500. The metrics are advance 650, left side bearing 55, and right side bearing 55. The outer and counter contours are closed, independently identified, oppositely wound, and accepted by the existing sampled contour validator. The counter-to-stem corners are intentionally angular in this prototype; tangent/optical quality at those joins is a visual-review question, not proved by contour validity.

## Candidate behavior

`buildLowercaseACandidate` clones an accepted three-glyph model, adds the `a` anatomy and an exact glyph selector, derives only the new glyph, and returns a candidate revision. The accepted input is not mutated. The revision records `glyph:u0061` as changed and `o`, `n`, and `H` as preserved. Existing accepted decisions are listed as preserved; the single-storey topology and baseline alignment are candidate decisions.

The add-glyph candidate helper records a `construct.glyph.add` operation. It is a narrow construction-experiment path: the existing construction parameter executor does not yet provide a general glyph-add operation. The normal shared font adapter then compiles the candidate model.

## Validation

Six new tests cover semantic anatomy/topology, deterministic derived contours, counter and winding validity, metrics and U+0061, shared parameter changes, immutable candidate revisions, preservation of existing glyphs, deterministic compilation, and explicit rejection of a two-storey topology by this method.

The compiled TTF contains six glyph records: `.notdef`, `space`, `o`, `n`, `H`, and `a`. The parser maps `a` to U+0061 with advance 650. The project's internal SFNT audit reports all expected TrueType tables, valid table and whole-font checksums, and no missing tables. This is not independent font validation. No fontTools or OTS validation ran, and no browser rendering was observed.

## Artifacts

- [TTF](./artifacts/LFCFoundry-Semantic-Construction-Lowercase-A-Experiment.ttf): 1,640 bytes; SHA-256 `2ba88fbe348e2c3f770c9744e569c7fdbf5fe17d01d0873d9db5fd85ad81f50c`.
- [Inspection JSON](./lowercase-a-inspection.json): actual parsed glyph order, `a` outline/metrics, internal table audit, hash, and exact preservation comparisons.
- [Review HTML](./lowercase-a-review.html): embeds the exact TTF and asks the browser's Font Loading API to load it; includes `a`, `o`, `n`, `H`, and a specimen.

The existing Base, Open-Counter, geometry-quality candidates, `font-review.html`, and `geometry-quality-review.html` were not overwritten.

## Architecture assessment

**Reused:** the universal model envelope, anatomy nodes and relations, shared decisions, stable glyph identity/Unicode, quadratic `PathBuilder`, contour bounds/winding/validation, geometry-derived metrics, candidate revision record shape, and font adapter/compiler.

**Added for this pattern:** an explicit topology parameter; `anatomy.terminal` nodes; method-specific bowl/counter/stem ratio validation; the `construction.bowl-with-attached-stem` derivation; and a narrow add-glyph candidate helper.

**Still specialized:** the geometry code recognizes this arrangement through one registered construction method and expects its particular node roles. It is not yet assembling arbitrary anatomy graphs from generic join/terminal constraints. Reuse for `b`, `d`, `p`, or `q` is plausible but untested and should not be claimed. A two-storey `a`, alternate stem sides, curved terminals, and general bowl/stem Boolean composition are not implemented.

The architecture is extensible enough to add a semantically described, parameter-driven construction without changing the existing glyph algorithms. It is also still at risk of accumulating one method per glyph pattern. The next architectural improvement should generalize construction operators and constraints across related glyphs, then prove reuse on another anatomy before expanding coverage.

## Commands and results

```sh
node --test architecture/universal-design-model/construction-experiment/test/*.test.mjs
node architecture/universal-design-model/construction-experiment/build-lowercase-a-demo.mjs
node architecture/universal-design-model/construction-experiment/make-lowercase-a-review-page.mjs
npm --prefix prototype test
node --test architecture/universal-design-model/contract.test.mjs architecture/universal-design-model/writing-context.test.mjs architecture/universal-design-model/shaping-request-adapter.test.mjs architecture/universal-design-model/integration-experiment/integration.test.mjs architecture/universal-design-model/construction-experiment/test/*.test.mjs
node --test test/*.test.mjs
git diff --check
```

Results: construction tests 17/17 passed; combined architecture/model/integration tests 58/58 passed; prototype tests 28/28 passed; production regression tests 21/21 passed; `git diff --check` passed. The combined architecture total includes the construction tests. Independent font validation and browser rendering remain untested.
