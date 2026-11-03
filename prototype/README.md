# Isolated contour and language prototype

This directory is separate from the production app. Do not import its modules into `src/`, change the root package manifest, or write to the root `dist/` directory.

## Dependency qualification

- `compromise@14.19.0` is pinned for the benchmark and this prototype only. Its runtime dependency tree is `efrt@2.9.0` and `suffix-thumb@6.0.0`; all three upstream packages declare MIT and ship MIT `LICENSE` files.
- Font compilation uses the already-present repository dependency `fontsketch@0.1.0` (MIT). It is bundled into this prototype, without changing the root dependency manifest or production build.
- The build tool is the root-pinned `esbuild@0.25.12` development dependency. No system tools or extra package installs are required beyond the local prototype Compromise install already recorded in this checkout.
- No NLP package is included in the production application.

The 20-case benchmark compares the existing production interpreter, a first-party lexical tokenizer using the prototype ontology, and Compromise using that same ontology. Linguistic tagging is not counted as typography understanding. The gold concepts are hand annotated in `src/benchmark-gold.js` and are not an independent human evaluation.

Latest local run (2026-11-02): existing interpreter precision 0.857, recall 0.618, 2 forbidden parameter changes, median 0.123 ms; lexical tokenizer plus ontology precision 1.000, recall 1.000, 0 forbidden changes, median 2.010 ms; Compromise plus the same ontology precision 1.000, recall 1.000, 0 forbidden changes, median 3.191 ms. Both newer paths detected the single annotated conflict case. These measurements cover only the 20 authored cases and do not establish general language accuracy. The equal concept scores show no measured accuracy improvement attributable to Compromise itself on this benchmark.

## Validation record

- Prototype tests: 18/18 passed; production test files: 21/21 passed.
- All six generated artifacts passed the bundled first-party SFNT audit: 10 required tables, valid table and whole-font checksums, 12 glyphs with `.notdef` first, and weight class 400 or 700 as named. The glyph set is `.notdef`, space, A, B, E, H, O, a, e, n, o, g.
- The fontsketch parser also parsed all six generated outputs. These are not independent validations: Python fontTools and OTS were not installed in the inspected environment.
- Browser rendering, FontFace loading, console/network behavior, Windows font installation, and Android browser behavior remain unverified until manual testing.
- The self-contained HTML is 472,104 bytes in the current build and bundles its JavaScript and CSS. Static source inspection found no external runtime script, stylesheet, or asset request. This does not replace testing the actual HTML in browsers.

## Prototype behavior

- The first-party ontology maps explicit phrases and a small grammar to version 1 of the design specification. It records source spans, certainty, conflicts, defaults, approximation/support status, and unsupported instructions.
- The contour engine keeps quadratic control points, stable IDs, and parametric recipes separate from language interpretation. Ten glyphs are generated through geometric, humanist-inspired, and serif systems.
- `fontsketch` accepts quadratic off-curve points directly as `{x, y, on: false}`; the adapter passes those points to the existing compiler. Bold contours are regenerated at a heavier weight instead of reusing Regular outlines.
- The prototype UI can compile all six system/style combinations, load the actual bytes through `FontFace`, display specimen text, and download each TTF. Browser execution was not automated in the current environment, so the FontFace path still requires a manual browser check.
- The local SFNT audit checks table ranges, required tables, per-table checksums, whole-font checksum, glyph count, and BMP cmap lookups. It is an independent first-party byte-structure check, but not a substitute for fontTools or OTS.

## Commands

Run from the repository root:

```sh
npm install --prefix prototype --ignore-scripts --no-audit --no-fund
npm --prefix prototype test
npm --prefix prototype run benchmark
node prototype/build.mjs
npm --prefix prototype run fonts
```

The build writes only `prototype/dist/typeface-studio-contour-prototype.html`. The font command writes six generated TTFs only under `prototype/artifacts/`. Neither command touches the production `dist/` artifact.

Open the isolated HTML directly in a browser to inspect a brief specification, compare the three contour systems, compile TTFs, and preview them with `FontFace`. The bundle contains no CDN, external module, runtime fetch, or other network requirement.
