# Model-to-font integration experiment

This isolated experiment exercises the draft v2 contract against actual TTF output. It is not imported by the application. The existing recipe generator supplies initial outlines only; the v2 adapter and executor own instruction conversion, selectors, operation order, mutation, transaction validation, and revision diffs.

## Run

```sh
node --test architecture/universal-design-model/integration-experiment/integration.test.mjs
node architecture/universal-design-model/integration-experiment/run-scenarios.mjs
```

The runner writes actual TTF artifacts and a checksum/audit summary to `$(node -p 'process.env.TMPDIR || "/tmp"')/typeface-studio-v2-model-to-font/`. It does not create or replace repository font artifacts. Eight TTFs are generated: baseline and v2 outputs for Regular and Bold heart substitution, lowercase reflection, and heart-then-reflection composition.

## Path and guarantees

- `engine.mjs` adapts specification v1 and glyph-instruction v1 into a v2-shaped model, resolves selectors, topologically orders operations, detects overlapping non-commuting operations, stages edits on deep copies, validates every affected glyph, and only returns a candidate revision after the whole transaction succeeds.
- The adapter copies the full v1 source into `adapter.legacySource`, maps global parameters to characteristic paths (legacy construction `system` becomes an optional seed-design characteristic), retains unknown aggregate records and warnings, and does not mutate the v1 input.
- The v1 heart operation maps to `substitute.glyph` and calls the existing exported `heartOutline()` implementation. There is one heart geometry implementation. Unicode and glyph identity are carried by the registry and verified after compilation.
- The reflection parser is deliberately narrow and supports this experiment's “mirror every [lowercase|uppercase] letter/glyph [except …]” forms. It does not claim general English interpretation.
- Reflection uses the glyph advance midpoint: `x' = advanceWidth - x`. Advance width is preserved; bounds and left/right bearings are recomputed (the bearings swap for a simple reflection); anchors and component transforms are reflected; contour winding is normalized by role. Kerning and attachment data are marked for review/invalidation. Blank glyphs retain their metrics.
- Selectors snapshot IDs at the v1 base registry revision. Letter classes exclude `.notdef`, spaces, punctuation, and marks; the literal entire-registry selector includes `.notdef`, space, punctuation, and marks. The compiler's special `.notdef` and space records are represented in this experiment's registry so their behavior can be tested.
- `b`, `d`, comma, and space are test-only inventory fixtures because the existing recipes do not contain `b` or `d`. `b` and `d` clone valid outlines from generated lowercase glyphs but have distinct identities and Unicode mappings. These fixtures test scope and exception behavior, not the quality of those letter designs.
- A successful execution produces a **candidate** revision. It leaves the accepted revision pointer unchanged until a caller explicitly accepts that candidate. Failed execution returns the original model and family and creates no revision.

## Executor contract

`executeTransaction(model, family, { revisionLabel, operationHandlers })` stages deep copies and keeps the established built-in operation dispatch. `operationHandlers` is an optional per-call plain object mapping operation type strings to synchronous functions. The executor snapshots enumerable own map entries, does not consult a process-wide registry, and does not allow a registered handler to override a built-in type. A handler receives `{ model, family, glyph, operation }` once for each glyph selected by the operation; the operation value is a frozen copy. It validates that operation's typed parameters and any construction-specific targets, mutates only the staged values, and returns control synchronously. The executor then runs glyph validation. An exception rejects the complete transaction and returns the original input references.

Resolved glyph-selector membership is a snapshot tied to `glyphRegistry.revisionId`. A selector that names another registry revision is rejected as stale; a resolved same-revision snapshot is used as stored. New or unresolved selectors are resolved and bound during execution. The caller that accepts selector expressions must validate that the stored member set matches the expression. Typed `{ type: 'revision', id }` preconditions are checked against the transaction's head revision. Operation IDs already recorded in accepted revisions are rejected, so follow-up transactions contain only new operations. Dependencies and conflicts use the existing topological scheduler and interaction checks.

Revision IDs now use `rev:` plus the first 16 hex characters of a SHA-256 hash over canonical JSON-compatible data. The payload is version-tagged and includes the design ID, parent head and glyph-registry revision IDs, resolved operations in dependency order (including selected glyph membership), intent, accepted/resolved state, top-level conflicts, glyph registry, selectors, optional `constructionIntegration`, family metrics/design/spacing and glyph records in glyph order, and changed glyph IDs. Object keys are sorted recursively; arrays retain order. Timestamps, environment data, family metadata, raw adapter/input records, the revision ledger beyond the parent head, and derived geometry/reports are excluded. The serializer accepts JSON primitives, arrays, and plain or null-prototype records; undefined/function/symbol object values are omitted, their array values and array holes become `null`, non-finite numbers become `null`, and cycles, BigInt, and non-plain objects are rejected. It does not hash `revisionLabel`. Thus the same revision content and operation order produce the same ID regardless of object key insertion order, while parameter changes and alternate operation histories produce different IDs.

The executor creates candidate revisions; the caller owns explicit acceptance and freezing. The maintained-side `operation-composition.test.mjs` tests that lifecycle with the same bounded integration handlers as the isolated reference, without changing this experiment's own executable path or artifacts.

## Geometry contract observation

The current contour object duplicates outline information in `segments` and TrueType `points`. Inspection found generated contours where `orientContour()` had reordered/reversed segments while the stored point list still reflected the old order. SVG preview reads segments, while the compiler reads points; this can make the two paths disagree. The experiment therefore canonicalizes point records from segment records at its isolated geometry-ingress adapter and carries point-ID references through reversal. This does not change the existing generator.

Smallest contract amendment proposed: when both segment and point encodings are present, designate one authoritative representation (prefer semantic segments/control points) and require the other to be deterministically derived before preview/export. Store stable point identity references on segments so reversing winding does not change which physical point an ID denotes. The current contract describes both representations but does not specify which wins when they disagree.

## Validation boundary

`fontsketch` compiles the TTF, `parseFont()` reads them back, and `sfnt-audit.mjs` checks required table presence, ranges, checksums, hMetrics, cmap lookup, and geometry assertions. These are not independent validators. In this environment, Python `fontTools`/`fontTools.ttLib` and `ots-sanitize` were unavailable, as were `ttx`, `fc-scan`, `fc-query`, `ftdump`, `otfinfo`, and `hb-shape`; no packages were installed. Later independent checks can use:

```sh
python -m fontTools.ttLib.ttx -l /tmp/typeface-studio-v2-model-to-font/heart-humanist-regular-v2.ttf
ots-sanitize /tmp/typeface-studio-v2-model-to-font/heart-humanist-regular-v2.ttf
```

Repeat for each output font. Do not treat the bundled parser/auditor as independent evidence.

