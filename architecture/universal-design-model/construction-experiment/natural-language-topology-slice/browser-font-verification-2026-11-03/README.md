# Browser and font verification

## Method

This read-only verification served the existing `review.html` and TTF artifacts from a temporary loopback Node server. Android Chrome loaded the review page in an iframe and separately loaded each existing TTF through `FontFace`. The probe records the review page's font-face status and computed sample font family, then uses Chrome Canvas 2D `fillText()` at 1000 CSS pixels to render a lowercase `a` from each font. The browser saved the resulting Canvas raster as PNG evidence. The TTF inputs, review page, and previous report were read only.

The two PNGs are actual raster output produced by Android Chrome's Canvas renderer. They are not screenshots of the full review page. Android `screencap` was attempted while Chrome was active but returned `Failed to take take screenshot. Capturing failed.` No screenshot was created. The PNGs were opened and visually inspected: the source shows one enclosed counter and the candidate shows two distinct enclosed counters/bowls.

## Findings

- Browser: Google Chrome `156.0.8078.79`, Android `17.0.0`, Pixel 7 Pro as reported by `navigator.userAgentData`. The legacy user-agent string is reduced and says Android 10; the higher entropy platform data reports Android 17.0.0.
- Both the existing review page's `FontFace` instances report `FontFace loaded`; `document.fonts.check()` is true for each review sample. Computed font families are `SourceA` and `CandidateA` as intended.
- Separate `FontFace.load()` checks for both unchanged TTF files also succeed, both are applied to Canvas, and neither raster is empty. Canvas reports an advance of about 650 px at 1000 px font size, with ascent 500 and descent 0.
- At the recorded luminance threshold `<250`, the source raster has one enclosed background component; the candidate has two. Both have the same measured pixel bounds (`x=74..614`, `y=50..549`, inclusive) at the same origin and baseline. The one-pixel antialias edge is consistent with the report's continuous outline bounds `x=55..595`, `y=0..500` placed at `x=20`, baseline `550`.
- Both TTF `head.unitsPerEm` fields read as 1000. This is a direct field extraction, not a font validation. The previous report records U+0061, advance 650, and 55/55 side bearings for both. The source and candidate SHA-256 values match the report.
- Canvas `TextMetrics.actualBoundingBoxLeft/Right` are `-46.875 / 609.375` for both at 1000 px. They remain discrepant from bounds implied by the outline and match the previously documented scale-sensitive Android Chrome behavior. They are not used here as side-bearing evidence. Raster bounds and `measureText().width` match the expected positioning and advance within rasterization precision.
- No probe-window JavaScript console/runtime errors were captured. The review iframe's FontFace statuses and checks succeeded, but its DevTools console was not independently captured. The only failed resource request was the optional `/favicon.ico` request (404); both font requests and the review page returned 200.
- No independent font validator is installed. `fontTools`/`ttx`, OTS, FontForge, `fc-scan`, and other checked system font validators were unavailable. The existing project report's internal SFNT audit is not counted as independent validation.

## Evidence

- `results.json`: browser identity, loading/application statuses, Canvas metrics, pixel bounds, counter-component counts, tool availability, and input hashes.
- `source-canvas.png` and `candidate-canvas.png`: saved Chrome Canvas output, 800 × 600 pixels.
- `sha256sums.txt`: hashes of both original TTFs, the pre-existing review and report, this probe, server, results, and PNG evidence.

The candidate passed browser loading and Canvas raster checks and visibly has two counters in the inspected raster. Full-page screenshot evidence and independent font validation remain unavailable in this environment; this result is not a claim of independent SFNT validation or production font correctness.
