# Canvas TextMetrics and raster bounds investigation

Date: 2026-11-03  
Repository: `codex/typeface-studio` at `c6145af55231e4688225acb3844d759ea487aa3e`

## Result

**Classification: inconclusive for the residual 4–8 CSS pixel difference.** The earlier comparison mixed coordinate conventions and used an arbitrary alpha cutoff. Correcting those makes the numbers much closer and identifies a plausible raster-threshold explanation, but this session could not run a new browser threshold/alignment sweep to prove that explanation. No evidence points to bad advance or side-bearing metrics, a compiler defect, or a broken outline. No source or font correction is justified by the available evidence.

## Reproduction conditions from the saved probe

`../terminal-profile-font-validation-2026-11-03/browser-probe.html` loads each font from an embedded data URL into a `FontFace`, awaits `face.load()`, and adds the face to `document.fonts`. It assigns Canvas `font` to `400 512px "<family>"`, sets `textBaseline` to `alphabetic`, calls `measureText('a')`, and then calls `fillText('a', 32, 550)`. It does not explicitly set `textAlign` or `direction`; Canvas `textAlign` therefore starts at `start`, and `direction` remains its default `inherit`. The canvas backing bitmap is 520×620 and is not CSS-resized. Pixel bounds include only alpha values greater than 16.

The saved browser result reports Chrome 156.0.0.0 on Android 10. `document.fonts.check()` is used in the flat/chamfer comparison. The saved measurements are in `../terminal-profile-font-validation-2026-11-03/browser-results.json`.

The saved probe requested an effective 512 px font and produced an advance of 332.7994 px, consistent with the custom font's metrics. Its thresholded glyphs also differ between the two construction families, which is further evidence that the intended custom faces were rendered. It did not record the normalized `ctx.font` string or explicitly set the Canvas direction; the new diagnostic page is designed to record those details.

## Coordinate and scale comparison

The HTML Canvas standard defines `TextMetrics.width` as the inline box advance. `actualBoundingBoxLeft` and `actualBoundingBoxRight` are distances from the text alignment point, parallel to the baseline. A negative left value means the left edge is to the right of that point. Those values are not absolute canvas pixel coordinates. The standard does not define an alpha threshold for comparing these geometry measurements with a raster bitmap.

For all four files, the validated font data is 1000 units per em, with `a` advance 650, left side bearing 55, right side bearing 55, and outline bounds x=55…595, y=0…500. At 512 px, the scale is 0.512 px per font unit:

- Advance: `650 × 0.512 = 332.8 px`.
- Expected outline x bounds from the glyph origin: `55 × 0.512 = 28.16 px` to `595 × 0.512 = 304.64 px`.
- Expected outline y extent from an alphabetic baseline: 0 to 256 px above the baseline.

The saved Canvas values are `actualBoundingBoxLeft=-24` and `actualBoundingBoxRight=312`. With draw/alignment origin x=32, the corresponding absolute bounds are x=56…344, calculated as `32 - (-24)` and `32 + 312`. They should not be directly compared to the raster coordinates without this translation.

The alpha>16 raster bounds are x=60…336 and y=294…549, with draw origin x=32 and alphabetic baseline y=550. Relative to the text origin, the raster x bounds are x=28…304; this agrees with the scaled font outline bounds to pixel rounding. The transformed TextMetrics bounds extend 4 px farther left and 8 px farther right than those thresholded pixels. The reported advance, compiled bearings, and rendered glyph origin are otherwise consistent.

`actualBoundingBoxAscent=256` and descent 0 agree exactly with the font's y bounds at this scale. `devicePixelRatio` is not a multiplier for `getImageData()` coordinates here: the canvas backing bitmap is explicitly 520×620 coordinate-space pixels and is not scaled by the page's CSS or a context transform.

## Comparison across all four fonts

All four variants report the same Canvas advance and same `actualBoundingBoxLeft/Right`; each has the same compiled advance, bearings, and bounds. Both adapter pairs have identical thresholded raster bounds. The chamfer changes pixels only near the top-right terminal. Therefore the reported horizontal difference is shared across flat/chamfer profiles and across adapters; it is not caused by the chamfer's changed geometry or by a changed metric policy.

The TTFs are parsed by the project's existing `fontsketch/core` parser. It reports the same UPM, advance, contour count and x/y bounds as the saved compiler audit. All four glyphs have empty TrueType instruction arrays, and compilation explicitly requested `hinting: 'none'`. This rules out an intentional embedded hint program moving glyph points, but does not determine how Chrome computes its `TextMetrics` rectangle.

## Harness and remaining uncertainty

The previous report described a direct disagreement between TextMetrics and the raster. One part was a coordinate-reference error: the TextMetrics fields are distances from the alignment point, whereas raster bounds are absolute bitmap coordinates. After translating by the x=32 alignment point, a smaller 4/8 px difference remains.

The raster measurement also uses a chosen alpha cutoff (`>16`), not the mathematical path edge or all nonzero coverage. Such a cutoff can exclude faint antialiased edge pixels. This is a plausible explanation for the remaining difference, but it was not demonstrated in this session.

An additional local probe was prepared to record normalized Canvas font state, explicit direction and alignment, and raster bounds at alpha thresholds 0, 16, and 128 at several font sizes. Chrome did not request that probe from the local server during this session, despite opening the URL with Android's activity command. The probe files remain available as `probe-v2.html` and `make-probe.mjs`; no browser results are claimed for them. The initial broader `probe.html` is also retained but was not run.

## Decision

No font, compiler, or existing validation artifact was changed. The current evidence is consistent with correct font metrics and geometry plus a harness comparison that mixes relative and absolute coordinates and thresholds the raster. The residual difference cannot be conclusively attributed to thresholding or Chrome's measurement implementation without the new sweep succeeding (or a second independent browser/rendering engine being tested).

For outline validation, use parsed TTF contour/glyph bounds and compare them with geometry-derived bounds. For advance and spacing, use `TextMetrics.width` and parsed `hmtx` values. For visual raster comparison, document the canvas size, origin, device scale, and alpha cutoff; do not treat a thresholded pixel box as an exact vector-outline bound.
