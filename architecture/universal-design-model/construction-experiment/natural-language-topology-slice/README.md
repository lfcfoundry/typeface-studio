# Natural-language single-to-double-storey `a` slice

This isolated experiment executes one controlled request through intent interpretation, the maintained v2 transaction lifecycle, semantic construction, derived geometry, and the existing font compiler.

Supported request strings are deliberately limited to:

- `Make the lowercase a double-storey and leave the other glyphs unchanged.`
- `Change lowercase a to double-storey, keeping every other glyph unchanged.`

The interpreter matches those patterns and a few punctuation/spacing variants. It rejects unsupported glyphs or topologies, ambiguous targets, contradictory requests, empty input, and other wording with explicit diagnostics. It is not a general natural-language interpreter and uses no external service.

## Source and candidate lifecycle

`createAcceptedSource()` starts from the existing accepted semantic construction experiment, adds the existing single-storey `a` fixture, and records an accepted adapter-backed source snapshot. The nested single-storey grammar fixture is checked against the accepted `a` geometry and metrics before it is used.

The interpreter records the original text, source spans, explicit construction and preservation intents, and no inferred decisions. `construct.glyph.set-topology` is then resolved against a revision-bound selector that must select exactly the lowercase `a` at U+0061. The handler checks the accepted outer and nested construction revisions and requires the single-storey topology before it stages the double-storey grammar.

The maintained `executeTransaction()` executor and its per-call handler registration perform staging, candidate revision creation, validation, and rollback. The executor is unchanged. The handler projects the existing spine-and-bowl grammar into the shared semantic anatomy record, records preserved and added node identities, derives geometry, and updates only lowercase `a`. The accepted source objects remain unchanged. A candidate is not accepted as a new accepted revision until `acceptCandidate()` verifies the compilation seal and lineage; acceptance returns a separate immutable snapshot. Replaying the topology operation against that accepted snapshot is rejected by the executor's accepted-history check.

The follow-up test narrows the upper bowl through its own transaction delta after candidate acceptance. The accepted operation history is not replayed.

## Geometry, metrics, and compiler boundary

The semantic source for the candidate topology is `two-storey-grammar/grammar.mjs`: two bowls and counters are attached to the shared spine through the grammar's joins and connector. The topology is validated before geometry derivation. The grammar's `PathBuilder` produces segment paths; `canonicalizeInitialGeometry()` rebuilds TrueType point records from those segments. The maintained executor validates the canonical family geometry. The existing `compilerProject()` passes those same model contours to `fontPoints()` and `compileTypeface()`.

The test verifies exact point-record equality at that compiler boundary and compares the accepted and candidate lowercase `a` outlines with a two-sided sampled distance check after decoding implied TrueType on-curve points. This comparison samples curves and lines; it is a numerical check, not a mathematical proof. Other glyphs are checked for unchanged compiler input and byte-decoded glyph records between the source and candidate fonts.

The topology increases the contour count from two to three and enclosed counters from one to two. The observed `a` bounds remain `x=55..595`, `y=0..500`. The operation preserves the 650-unit advance and recomputes bearings from the derived bounds, yielding 55 units on each side. Kerning is invalidated for review because this diagnostic slice has no kerning data or optical-spacing evaluation.

## Diagnostic output

Run:

```sh
node architecture/universal-design-model/construction-experiment/natural-language-topology-slice/build.mjs
```

The build writes separate source and candidate TTFs, `review.html`, and `report.json` under this experiment's `artifacts/` directory and root. It refuses to replace an existing artifact whose bytes differ. Both fonts use the established `fontsketch 0.1.0` path and the repository's internal SFNT audit. That audit is not independent font validation. Browser loading and rendering must be reported only if observed in a browser.

The review page displays semantic SVG outlines alongside the two embedded diagnostic fonts, topology, bounds, metrics, and revision identifiers. The candidate is a separate font artifact, not an OpenType alternate; no GSUB behavior is implemented. Android Chrome was launched and requested the page successfully (HTTP 200), but screen capture failed, so browser version, `FontFace` load status, and visible rendering remain unverified; see `browser-observation.json`.

Focused tests:

```sh
node --test architecture/universal-design-model/construction-experiment/natural-language-topology-slice/scenario.test.mjs
```

## Scope limits

This slice demonstrates one vocabulary, one glyph target, one topology transition, and one existing construction grammar. It does not create arbitrary glyph topologies, general language understanding, a production UI, OpenType substitutions, broad Unicode coverage, independent font validation, or a universal geometry/compiler boundary. It does not replace production, prototype, or historical construction experiments.
