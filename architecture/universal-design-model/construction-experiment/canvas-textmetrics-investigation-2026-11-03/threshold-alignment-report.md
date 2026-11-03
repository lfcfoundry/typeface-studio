# Canvas TextMetrics threshold and alignment experiment

Date: 2026-11-03  
Repository: `codex/typeface-studio` at `c6145af55231e4688225acb3844d759ea487aa3e`

## Execution

The new page `probe-fast.html` was served from the investigation directory on local port 18765 and opened in Android Chrome. The Node server logged the page request and accepted the result POST as `chrome-fast-results.json` (18,529 bytes). This confirms the page executed and saved its measurements. The page loaded all four `FontFace` objects; each reported status `loaded` and `document.fonts.check(...) === true`. The page's captured `error` and `unhandledrejection` handlers reported no runtime errors. A DevTools console was not available, so no claim is made about console messages outside those captured handlers.

The first newly prepared full-size page, `probe-execution.html`, was requested by Chrome but did not POST results during roughly 100 seconds. It performed a larger 40-raster run on a 900×700 canvas and was too slow in this environment. I restarted Chrome with the smaller, optimized `probe-fast.html`; the latter completed all 24 raster samples successfully. Existing pages were not overwritten.

Browser: Chrome 156.0.0.0 Mobile on Android 10; reported device pixel ratio 2.886. No second browser or browser automation package was installed: package and executable checks found no Firefox, Chromium binary, Edge, Brave, Opera, Vivaldi, Playwright, or Puppeteer.

## Controlled settings and coordinate handling

The page embeds the existing four TTFs and loads each through `FontFace.load()`. For every sample it sets `font` to `400 512px "<font-id>"`, `direction='ltr'`, `textBaseline='alphabetic'`, and the listed `textAlign`. It calls `measureText('a')`, then draws the same `a` at alignment point `(400, 540)` into a 760×560 canvas. It reads the bitmap at its native coordinate dimensions, without CSS or context scaling.

The sweep uses all five Canvas alignments (`start`, `left`, `center`, `right`, `end`) and alpha thresholds 0, 16, and 128 (pixels counted when alpha is greater than the threshold). Each alignment was rendered once for each font; `start` was repeated once more for each font. The full per-sample measurements, including `width`, all four actual bounding box fields, resolved font string, alignment point, raster bounds, and pixel counts, are in `chrome-fast-results.json`.

Canvas `actualBoundingBoxLeft/Right` are distances from the alignment point; their signs are not absolute bitmap coordinates. The probe converts them to absolute bounds with `xMin = alignmentX - left` and `xMax = alignmentX + right`. Raster bounds below are inclusive pixel indices from `getImageData()`.

## TextMetrics results

All four fonts returned the same advance and vertical metrics at 512 px. Horizontal fields vary with alignment as expected:

| `textAlign` | `width` | `actualBoundingBoxLeft` | `actualBoundingBoxRight` | ascent / descent | Converted x bounds at anchor 400 |
|---|---:|---:|---:|---:|---:|
| `start`, `left` | 332.799438 | -24 | 312 | 256 / 0 | 424…712 |
| `center` | 332.799438 | 142.399719 | 145.600281 | 256 / 0 | 257.600281…545.600281 |
| `right`, `end` | 332.799438 | 308.799438 | -20.799438 | 256 / 0 | 91.200562…379.200562 |

The Canvas width matches the 650-unit advance at 1000 UPM scaled by 512/1000 (expected 332.8 px). TextMetrics horizontal values were identical between flat/chamfered variants and between adapters.

## Raster threshold sweep

For all samples, raster y bounds were y=284…539 at each threshold. The x bounds and thresholded pixel counts for every font/alignment pair are below; columns show `alpha>0 / alpha>16 / alpha>128`.

| Font | Alignment | x bounds at thresholds 0 / 16 / 128 | Pixel counts at thresholds 0 / 16 / 128 |
|---|---|---|---:|
| a flat | start | 428…704 / 428…704 / 428…704 | 36605 / 36476 / 35878 |
| a flat | left | 428…704 / 428…704 / 428…704 | 36605 / 36476 / 35878 |
| a flat | center | 261…538 / 261…538 / 262…537 | 36639 / 36523 / 35800 |
| a flat | right | 95…371 / 95…371 / 95…371 | 36582 / 36455 / 35856 |
| a flat | end | 95…371 / 95…371 / 95…371 | 36582 / 36455 / 35856 |
| a chamfered | start | 428…704 / 428…704 / 428…704 | 36568 / 36431 / 35833 |
| a chamfered | left | 428…704 / 428…704 / 428…704 | 36568 / 36431 / 35833 |
| a chamfered | center | 261…538 / 261…538 / 262…537 | 36594 / 36478 / 35755 |
| a chamfered | right | 95…371 / 95…371 / 95…371 | 36546 / 36419 / 35811 |
| a chamfered | end | 95…371 / 95…371 / 95…371 | 36546 / 36419 / 35811 |
| spine flat | start | 428…704 / 428…704 / 428…704 | 34338 / 34188 / 33350 |
| spine flat | left | 428…704 / 428…704 / 428…704 | 34338 / 34188 / 33350 |
| spine flat | center | 261…538 / 261…538 / 262…537 | 34390 / 34246 / 33279 |
| spine flat | right | 95…371 / 95…371 / 95…371 | 34308 / 34167 / 33326 |
| spine flat | end | 95…371 / 95…371 / 95…371 | 34308 / 34167 / 33326 |
| spine chamfered | start | 428…704 / 428…704 / 428…704 | 34302 / 34143 / 33305 |
| spine chamfered | left | 428…704 / 428…704 / 428…704 | 34302 / 34143 / 33305 |
| spine chamfered | center | 261…538 / 261…538 / 262…537 | 34344 / 34201 / 33234 |
| spine chamfered | right | 95…371 / 95…371 / 95…371 | 34272 / 34131 / 33281 |
| spine chamfered | end | 95…371 / 95…371 / 95…371 | 34272 / 34131 / 33281 |

Raising the threshold reduced covered-pixel counts substantially. It did **not** change the measured outer x bounds for start/left or right/end, and changed center bounds only by one pixel at each side at alpha>128. Thus the alpha threshold does not explain the wider TextMetrics rectangle in the original start-aligned sample. The raster positions at each alignment match the expected translated glyph placement; `start` equals `left`, and `end` equals `right` for explicit LTR direction.

## Remaining TextMetrics-to-raster difference

The fonts have UPM 1000, advance 650, LSB/RSB 55/55, and compiled outline x bounds 55…595. At size 512, those outline bounds scale to 28.16…304.64 px from the glyph's advance origin. For start/left at x=400, the predicted absolute outline bounds are 428.16…704.64; the raster pixels occupy 428…704 at all three thresholds.

By contrast, the converted TextMetrics box is 424…712. It extends 4.16 px farther left and 7.36 px farther right than the expected outline box. The same offset remains for center and right/end after accounting for each alignment point. Because alpha thresholds 0 and 128 produce the same start/left and right/end bounds, and alignment translation does not remove the offset, neither the chosen alpha cutoff nor alignment causes the remaining difference.

This is a stable difference between Chrome's TextMetrics measurement path and its raster output for these fonts. All four fonts produce the same TextMetrics and the same relative discrepancy. Two `start` runs per font were identical in every recorded field except the run number. There were no captured runtime errors. No second browser was available, so this cannot be labeled a cross-browser difference or a Chrome-only standards violation. The available evidence does not establish a font/compiler defect: the custom font loaded, advance matched, raster placement matched the compiled outline/bearings, and all profiles/adapters shared the same offset.

## Which measurement to use

- **Semantic geometry:** validate the construction adapter's derived geometry and semantic relationships.
- **Compiled outlines:** inspect `glyf` bounds and parsed contour points against the derived geometry; do not substitute Canvas TextMetrics for this check.
- **Advance and bearings:** use compiled `hmtx` values for font data and `TextMetrics.width` for browser text advance.
- **Browser layout:** use TextMetrics in its documented alignment-point coordinate system.
- **Raster comparison:** use pixel coverage at a recorded Canvas size, font size, alignment, baseline, and alpha threshold. Keep bitmap indices distinct from text-relative distances.

No source, compiler, construction adapter, font artifact, existing report, or production/prototype file was changed.
