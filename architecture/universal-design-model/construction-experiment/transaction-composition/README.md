# Universal transaction composition experiment

This isolated integration uses a mechanically extended copy of the existing universal executeTransaction implementation. It registers construction-instance reflection and cross-grammar aperture handlers, preserving the existing selector resolution, dependency ordering, interaction checks, staging, geometry validation and candidate creation lifecycle.

Open [review.html](review.html) directly in a browser for the self-contained comparison. Browser rendering has not been observed. These are diagnostic two-instance glyphs, not proposed finished typefaces.

## Source and publication boundary

The original branch is codex/typeface-studio-first-mvp at dab1f7359dfc0581f8d28e2dc1af5ef25260e5d5. Its architecture experiments and some required prototype modules were untracked. Publishing only imports to those paths would produce a broken branch. Therefore baseline/ contains 13 reviewed, frozen first-party source prerequisites, preserving their relative imports and MIT notices. baseline-sources.json records every frozen source path/hash. One copied executor has a surplus EOF blank line removed for publication whitespace checks; snapshot-normalizations.json records its original and normalized hashes. No executable code changed in that prerequisite, and the original file remains byte-identical. It contains no node_modules, caches, credentials or runtime downloads. Existing root fontsketch 0.1.0 is the only font compiler dependency; no packages or manifests were changed.

All original files remain unchanged. Only this experiment directory is intended for the dedicated publication branch codex/typeface-studio-transaction-composition. No previous experiment's working-tree changes are staged. The source snapshots are explicit dependencies of this milestone; they are not promotion or replacement of those original experiments.

## Executor integration and exact extension

extend-executor.mjs reads the frozen universal executor and deterministically emits extended-executor.mjs. The established executor cannot register custom handlers; its dispatch only recognizes heart substitution, glyph preservation and whole-glyph reflection. A module wrapper cannot inject a handler into that closed dispatch. The isolated extension adds:

1. Optional typed operationHandlers dispatch at the existing per-glyph execution point.
2. An export of the existing reflectGlyph helper, with its winding, point-identity and positional-data behavior unchanged.
3. A content-sensitive revision hash. The old hash used base/operation IDs/changed glyph IDs only, so different parameters with the same IDs collided. The new hash includes operation content, glyph content and the versioned construction state.
4. Relocated relative imports to the frozen prerequisite tree.

No new dependency scheduler or global transaction algorithm was built. A parity test runs the original and extended executors on existing geometry.reflect and compares family output, scope and ordering. Established source is not edited. This is actual execution through the extended universal lifecycle, not registration in the production runtime.

integration.mjs prepares and validates requests, supplies registered handlers and defines a local constructionIntegration v1 extension. It contains capability-keyed construction instances, revision-bound instance selectors, transform state, trace and accepted-operation history. No universal schema version changes were made. The universal validator still validates these schema-v2 envelopes; it does not independently validate the extension, which is checked by this integration layer.

## Scope and operation semantics

Universal glyph selectors snapshot membership at the inventory revision. Structure selectors independently snapshot instance IDs at that same revision. The integration rejects stale snapshots rather than silently re-resolving them. Operations additionally carry the accepted design revision as a precondition. Glyph inventory revision and accepted design revision are distinct concepts.

Each diagnostic glyph contains a main construction at offset 0 and a support construction at offset 700, with advance 1350. Reflection selects main only, with axis at that instance's local advance midpoint (x=325). It uses the existing reflection helper on the local derived geometry, then positions the instance in the assembly. The support contours and a separate unencoded control glyph remain unchanged. This demonstrates sub-glyph scope; it does not claim arbitrary individual bowl/shoulder reflection within one connected construction. Such structural reflection would require attachment solving.

Aperture resolves an internal anatomy node within the selected instance and delegates unchanged to the frozen cross-grammar implementation and capability adapter. Its local candidate result remains staged construction provenance; only the enclosing universal transaction can accept the overall revision. No local candidate is independently committed.

Apertures use object-attached boundary identity and quadratic-local-t parameterization. Reflection persists as an instance transform rather than rewriting the construction's anatomy or boundary names. Ports retain logical IDs/owners and outer/inner roles; their presentation coordinates and handedness are transformed explicitly. Tests compare each transformed port against the actual transformed cap segment. Winding normalization handles the reflected contours. World-left aperture instructions and arbitrary component axes are unsupported.

## Composition and revision lifecycle

Sequence A previews reflection, then extends that candidate plan with aperture depending on reflection. Sequence B previews aperture, then extends with reflection depending on aperture. Candidate continuation re-executes the extended operation delta from the immutable accepted base; it does not apply already-executed operations again to preview geometry. Both combined batches are atomic.

Both sequences produce exactly equal final geometry/metrics/ports under object-attached semantics. They commute geometrically in this defined domain. Their ordered operation traces, provenance and revision IDs differ. Font file hashes differ because exported family metadata identifies A/B, while compiled glyph records are equal. The executor conservatively requires explicit dependency ordering for overlapping geometric operations even where this restricted pair commutes.

The acceptance helper checks a candidate content seal, validates the universal model, clones it, marks the new root revision accepted and freezes the returned accepted state. The input candidate and base remain unchanged. Root acceptance is authoritative; embedded construction revision records retain the local aperture evaluation provenance.

Follow-up transactions execute only their new delta. Prior complete operation records move into constructionIntegration.operationHistory, retaining provenance referenced by earlier revisions. Reusing an accepted operation ID is rejected. A follow-up reflection restores orientation without reopening the already-open aperture or losing it. This is a bounded experiment in acceptance/history, not a persistent undo UI, merge system or arbitrary DAG operation registry.

## Validation and results

- New integration tests: 13/13 passed.
- All architecture/experiment tests: 114/114 passed, including the new tests.
- Prototype tests: 28/28 passed.
- Production tests: 21/21 passed.
- Internal font parsing and SFNT checks: passed for all ten exports.
- Workspace preservation: every one of 153 pre-existing files matched its initial hash.
- Independent font parser/OTS: unavailable; fontTools import failed and checked validator commands were absent.
- Actual browser FontFace rendering and font installation: not tested.

Tests cover registered handlers, legacy parity, dependency ordering, missing dependencies/cycles, unordered overlaps, scoped instances, unchanged control geometry, reflection/aperture order, stable port/cap identity, revision-bound selectors, second-operation rollback, deterministic output, content-sensitive revisions, immutable acceptance, accepted provenance/delta replay, frozen prerequisites and all generated TTF/HTML bytes. Geometry uses the existing sampled intersection/containment checks, not exact robust computational-geometry proofs.

The clean-publication smoke procedure exports only the baseline Git commit plus this directory to a temporary tree. It uses existing dependencies through a temporary symlink, installs nothing and runs this suite with TYPEFACE_ISOLATED_PUBLICATION=1. That mode skips only the workspace-specific preservation test because the unpublished original working tree is intentionally absent; frozen prerequisites and all functional/font tests still run. The result is recorded in the handoff.

## Reproduction

Run from repository root using the existing dependencies:

```sh
node architecture/universal-design-model/construction-experiment/transaction-composition/extend-executor.mjs
node --test architecture/universal-design-model/construction-experiment/transaction-composition/composition.test.mjs
node architecture/universal-design-model/construction-experiment/transaction-composition/build.mjs
node --test architecture/universal-design-model/*.test.mjs architecture/universal-design-model/integration-experiment/*.test.mjs architecture/universal-design-model/construction-experiment/test/*.test.mjs architecture/universal-design-model/construction-experiment/related-glyph-reuse/test/*.test.mjs architecture/universal-design-model/construction-experiment/two-storey-grammar/*.test.mjs architecture/universal-design-model/construction-experiment/aperture-operation/*.test.mjs architecture/universal-design-model/construction-experiment/cross-grammar-aperture/*.test.mjs architecture/universal-design-model/construction-experiment/transaction-composition/*.test.mjs
npm --prefix prototype test
node --test test/*.test.mjs
git diff --check
```

On a clean checkout of this publication branch, where previous untracked experiments are absent, run the isolated suite as follows instead of the full workspace suite:

```sh
TYPEFACE_ISOLATED_PUBLICATION=1 node --test architecture/universal-design-model/construction-experiment/transaction-composition/composition.test.mjs
```

If development dependencies are absent on another machine, install the already pinned root lockfile dependencies as a separate local setup action. This task installed nothing. Downloaded review.html needs no installation or dependencies. No production or prototype build is required or executed.

## Artifacts

artifacts/ contains Regular TTFs for ring and spine, each with baseline/reflection/aperture/A/B variants. Only the intended a (U+0061) or o (U+006F) is encoded; a separate control glyph is unencoded. The paired constructions are deliberately one glyph to prove partial-glyph scope, not an attempt at natural text shaping. No new Unicode values or alternate feature switching are invented.

review.html embeds all ten exact font bytes with status displays and multiple sizes. inspection.json records both accepted models, operation order, geometry hashes, metric/port results, glyph records and SFNT audits. artifact-hashes.json lists all generated paths/SHA-256 values. file-hashes.sha256 covers the complete publication directory except itself. No external runtime requests, scripts, styles, imports or fonts are required.

## Maturity assessment

| Capability | Classification and evidence |
|---|---|
| Structured typography intent | Partially demonstrated: existing structured contracts, not unrestricted language understanding. |
| Resolved decisions | Demonstrated for explicit experimental operations, scope, provenance and revisions. |
| Semantic construction | Demonstrated for the bounded spine stack and independent ring topologies. |
| Reusable construction grammar | Demonstrated within the tested stack/ring capabilities; arbitrary anatomy remains unsupported. |
| Reusable semantic operations | Demonstrated cross-grammar aperture and instance reflection. |
| Universal operation execution | Demonstrated through the isolated mechanical extension; maintained/production registration not performed. |
| Operation composition | Demonstrated for both object-attached orders, not arbitrary operations or frames. |
| Dependency ordering | Demonstrated using the established executor, including cycles and overlap rejection. |
| Transactional editing | Demonstrated staging, rollback, candidate continuation, immutable acceptance and new-delta follow-up. |
| Derived geometry | Demonstrated with numerical validation and stable identifiers. |
| Font output | Demonstrated ten deterministic TTF exports. |
| Font validation | Internal checks demonstrated; independent checks not demonstrated. |
| Visual verification | Not demonstrated: review page generated, rendering unobserved. |

## Recommendation

Option A: return to GPT-6 Luna for bounded consolidation and coverage tasks. This experiment established the operation lifecycle without a remaining fundamental architectural blocker in the tested domain. That is a scope-based engineering recommendation, not a model performance comparison or claim that the overall typeface product is mature. Official OpenAI guidance recommends evaluating representative tasks and using the lightest setting that meets the quality bar: https://developers.openai.com/api/docs/guides/model-selection .

The next milestone should promote the reviewed handler hook and revision-content hashing into the maintained universal executor with these parity, rollback and delta-history tests. It is a bounded consolidation task with precise acceptance checks. Defer new anatomy, arbitrary connected-component reflection, screen/UI integration and multi-script expansion until that consolidation is reviewed.
