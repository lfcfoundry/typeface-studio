# Executable family x-height propagation (experiment v1)

Start at `scenario.mjs`. This experiment applies a structured 500→520 font-unit x-height delta to a five-glyph engineering fixture. It does not add language interpretation. The fixture is assembled using the existing accepted-source and h-addition scenario, with technical fixture acceptance; it carries no claim of human visual approval.

The final diagnostic is `review-final.html`, with `build-report-final.json`, `dependency-plan-final.json`, and `artifacts-final/{source,candidate}.ttf`. The earlier unlabelled build is retained as intermediate evidence. Final source and candidate fonts are both 1700 bytes. Source SHA-256: `44aac2c744b2607037ce0445bdde7c1d9a2c1dd45e465d8e878f76c76e1f5efb`; candidate: `43310f5c97481f0c802d02f16e56ac29f5dba67c7aea3c0f9a4a5b3f9d0fdd8f`.

## Canonical state, dependencies and overrides

`state.characteristics[decision:x-height]` is the geometry-driving value. Its original full decision record, expected prior value, intent ID, accepted parent revision, and dependency plan are retained in `constructionIntegration.familyPropagation`. The parent object and revision remain unchanged. Input is explicit structured intent; null source offsets mean that no natural-language span is invented.

The declarations in `scenario.mjs` associate semantic parameter-reference fields with each construction method. Glyph IDs are obtained from the actual registry. Each declaration records component identity, field, decision identity, and effects on geometry, bounds, bearings, spacing review, and visual evidence. The affected set is derived by following the x-height edges; the separate expected set appears only in tests. All five methods must be supported, all referenced decisions must exist, and planning requires an accepted head. Plans include the full source content hash, registry revision, construction hashes, and explicit overrides. Canonical object-key serialization and fixed array ordering make plans deterministic.

Dependencies consumed:

| Construction | Family decisions read |
| --- | --- |
| o ring | shared stem width, x-height |
| n shoulder | shared stem width, x-height |
| H parallel stems/crossbar | shared stem width, cap height |
| a attached bowl | shared stem width, x-height |
| h stem/shoulder return | shared stem width, x-height, h ascender, baseline |

Every geometry decision read goes through a guard. Scalar reads made through the semantic validator's state view are guarded too. Missing or undeclared reads throw; declared inputs left unused also throw. Perturbation tests independently show that each distinct declared input changes actual contour data or metrics, so reading a value only for a hash does not satisfy the evidence. This is a bounded decision-read guard, not a JavaScript sandbox or generic read/write-set system. Construction parameters and construction-box metrics are protected by the revision/construction hashes, rather than modeled as family decisions.

Explicit overrides include owner, property, value and provenance. This slice supports retaining an existing topology exception. It remains in the plan and does not remove x-height dependencies. Duplicate/conflicting overrides and x-height overrides are rejected rather than silently applying precedence. Broader override evaluation remains unimplemented.

## Isolated adapter revisions

The safety requirement to keep every implementation change in this new directory prevents editing the earlier adapters. Therefore `geometry-adapter.mjs`, `h-adapter.mjs`, and `h-grammar.mjs` are explicit isolated revisions of the existing construction geometry, h geometry, and h grammar. The preservation baseline records the original source hashes. This is intentional limited duplication, not a second executor or compiler. The earlier modules remain authoritative for their historical experiments; this experiment does not promote these revisions into them.

The geometry formulas are preserved. The base adapter's decision lookup is guarded. The h adapter has guarded lookups and hashes only its declared dependency values, rather than all family decisions. The h grammar replaces exact 90/500 dimension assertions with positive integer stem width/x-height and an integer ascender above x-height. Existing topology, ownership, attachments, terminal profiles, stable nodes, and boundary checks remain. The original adapter's further checks still reject collapsed openings, insufficient stem separation, noninteger controls, shoulder peaks above the ascender, and invalid contours. This does not guarantee every positive dimension combination works. The tested dimensions are bounded fixtures, not a general h style range.

At 500 the canonical outlines match the saved accepted fixture, including point identities. Semantic construction records are identical before/after the family change. Semantic glyph metrics remain construction-box inputs; actual output bearings live on derived glyph geometry. Feeding newly computed bearings back into those box inputs would introduce drift on follow-up rebuilds.

## Transaction and font boundary

A family setter targets exactly one anchor derived from the dependency plan, so the existing per-glyph handler executes that state change once. Each required glyph has an exact-one re-derivation operation depending on the setter. This uses the maintained executor unchanged. The setter changes canonical state only on its staged copy; adapters derive o,n,a,h; H is untouched. Revision preconditions, selectors, source and construction hashes, explicit dependencies, and post-execution rebuild completeness are checked. Same-revision selector-expression/membership mismatches are rejected by this caller, as required by the existing executor contract.

Advance widths are preserved. Bearings are recomputed from exact derived bounds. Kerning is invalidated in the revision, while spacing and visual review are explicitly required in the integration record. Glyph validation alone does not enforce advance preservation, so the handler separately checks that metric policy. The existing executor validates each affected glyph. Any adapter, geometry, compiler, mapping or audit failure returns the original accepted source references and no candidate revision.

Segments are canonicalized through the existing ingress adapter to TrueType points. Every compiler contour record is compared against the executor-validated family before compilation. Compilation reuses `compilerProject` and the existing `compileTypeface`/fontsketch path. The inherited compiler adapter hard-codes x-height 500 in its project metadata, so this experiment explicitly replaces that project value with the canonical family decision before using the existing compiler. H's parsed compiled record remains identical. Internal SFNT checks and all five Unicode/advance mappings pass; independent font validation is not established here.

A test-only simulated visual approval exercises acceptance and a 520→500 follow-up. The follow-up contains new operation IDs only. It does not provide real visual approval. The generated 520 candidate remains not reviewed.

## Geometry results

| Glyph | Bounds before → after | Advance | Bearings before → after |
| --- | --- | --- | --- |
| o | (55,-8)-(565,508) → (55,-8)-(565,528) | 620 | 55/55 → 55/55 |
| n | (55,0)-(595,540) → (55,0)-(595,560) | 650 | 55/55 → 55/55 |
| H | (55,0)-(595,700), unchanged | 650 | 55/55, unchanged |
| a | (55,0)-(595,500) → (37,0)-(595,520) | 650 | 55/55 → 37/55 |
| h | (55,0)-(595,700), shoulder changes within bounds | 650 | 55/55 → 55/55 |

The a bowl widens because its existing width ratio follows x-height. Its accepted single-storey topology remains; no conventional double-storey a compliance is claimed. The numeric results match the prior probe for o/n/H/a. The h now derives at 520 while keeping its semantic topology and identities. Contour intersection/containment checks use existing sampling; they are not mathematical proofs. Exact quadratic extrema determine geometry bounds.

## Review and reproduction

`review-final.html` loads both actual TTFs through FontFace and offers grids, repeated glyphs, uppercase/lowercase comparison and Hanna/noon/anon at 12–72 CSS px. Its canvas compares the same five glyphs and can POST loading/raster evidence to the optional local `browser-server.py`. Browser loading or a successful canvas does not approve visual quality. A named human reviewer with evidence must explicitly approve a candidate before `accept()` allows acceptance.

Run from the repository root:

```
node --test architecture/universal-design-model/family-xheight-propagation/propagation.test.mjs
node architecture/universal-design-model/family-xheight-propagation/build.mjs run2
python architecture/universal-design-model/family-xheight-propagation/verify-preservation.py
```

Build outputs refuse replacement. Use a new label for a new build. `architecture-final-results.json`, `regression-results.json`, and logs record regression commands/results. Historical manifest results are in `historical-check-results.json`. The old whole-font preservation script compares outside-directory status to its earlier baseline; it flags this newly added experiment although all its existing file hashes still match. The new preservation check compares the full before/after state outside this directory.

No executor contract change is needed for this bounded scenario. Next work should review the isolated adapter revisions for a separately authorized shared dependency-aware adapter interface, rather than creating more copies. Family qualitative resolution, broader overrides, arbitrary grammars, optical calibration, professional quality, and production integration remain unsupported.
