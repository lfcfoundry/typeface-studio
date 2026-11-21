<!-- Copyright (c) 2026 LFC Foundry. MIT License. -->
# Typeface Studio font output qualification plan

**Baseline:** production main `270ac21` (2026-11-08). Read `README.md`, `THIRD-PARTY-NOTICES.md`, the core/export tests, and the prototype’s own README before work. The contour prototype remains isolated from the production editor.

## Goal

Establish whether generated font bytes are accepted and rendered consistently by independent font readers and real browsers. Current notes say internal SFNT checks passed while fontTools, OTS, and installation checks were unavailable. Treat those as open qualification items. Do not call the prototype a production font editor or change the production generator as part of this study.

## Matrix

For the current production app, cover every shipped construction family and Regular/Bold style, default and edited metrics, save/reopen, and export. For the isolated contour prototype, cover all three recipe systems, both weights, every generated glyph in its registry, combining/diacritic examples, and unsupported Unicode reporting. Include empty brief, minimal brief, maximal supported brief, invalid constraints, and repeated deterministic builds.

Check these stages separately: brief normalization, glyph recipe generation, contour validation, SFNT table writing, browser FontFace load, shaping/rendering, and final TTF size. Compare repeated exports byte-for-byte where determinism is promised. Verify cmap coverage, glyph count, head/maxp/hhea/hmtx/cmap/name/OS/2/post tables, checksums, metrics, component references, and ascent/descent bounds with an independent parser. Run OTS sanitizer before attempting installation. Record tool versions and failures explicitly.

Render a fixed specimen covering ascenders, descenders, counters, punctuation, spacing, accented Latin, and weight differences in Chromium, Firefox, and WebKitGTK at 16/24/48/96 px. Compare line breaks, advances, clipping, glyph fallback, and preview/export agreement. Keep font rendering differences separate from geometry-generation differences.

## Decision and limits

Use existing `npm test` and `npm run build` for the production app, and the prototype’s own tests/build for the prototype. Do not add validation libraries to runtime code; development-only tools must be pinned and optional. If OTS/fontTools are unavailable, report the exact missing check instead of marking it passed. Any new font binary, glyph coverage promise, dependency, or change to production output needs a separate owner decision and source/license review.
