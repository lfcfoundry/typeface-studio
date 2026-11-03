# End-to-end chamfered terminal font validation

Date: 2026-11-03  
Repository HEAD: c6145af55231e4688225acb3844d759ea487aa3e

## Pipeline

Both chamfered variants were created by accepting the existing `semantic.terminal.set-profile` operation through the maintained transaction-composition executor. The accepted semantic state was then passed to its existing construction adapter and the existing `fontsketch@0.1.0` TrueType compiler. No contours were patched and no separate compiler was introduced.

## Accepted revisions

| Construction | Outer base | Outer accepted | Semantic base | Semantic accepted | Operation |
|---|---|---|---|---|---|
| Single-storey a | rev:transaction-base | rev:0f698cdca556439a | rev:1f967f7a1606afec | rev:dd644429432468d4 | op:font-validation-a |
| Spine-and-bowl | rev:transaction-base | rev:5b047400b34e5723 | revision:base | revision:9b5f9432040844cc | op:font-validation-spine |

## Artifacts and measurements

| Font | Bytes | SHA-256 | Advance | LSB / RSB | Glyf bounds | Saved flat baseline |
|---|---:|---|---:|---:|---|---|
| single-storey-a-flat (single-storey-a-flat.ttf) | 1640 | 2ba88fbe348e2c3f770c9744e569c7fdbf5fe17d01d0873d9db5fd85ad81f50c | 650 | 55 / 55 | 55…595, 0…500 | byte-identical |
| single-storey-a-chamfered (single-storey-a-chamfered.ttf) | 1644 | 24c605a34f77c98389334bdd5de80bf9c1e070ea7cab900a71640e0a46d1f856 | 650 | 55 / 55 | 55…595, 0…500 | — |
| spine-bowl-flat (spine-bowl-flat.ttf) | 1344 | a24790bac1f69af32c37e2cbb71c1b72b344530375d131dd3d0c68e4ba932db8 | 650 | 55 / 55 | 55…595, 0…500 | byte-identical |
| spine-bowl-chamfered (spine-bowl-chamfered.ttf) | 1348 | 2521d6b42248ef8439d1937b97847ebf0172a33ca656b76a5692225cef3efb2f | 650 | 55 / 55 | 55…595, 0…500 | — |

Flat outputs matched their saved artifacts byte-for-byte. Both chamfered outputs changed only the terminal outline: bounds, advance, side bearings, counters, and unrelated glyphs remained identical. The semantic profile derives an 18-unit cut from `cutRatio: 0.2` and the 90-unit stem.

## Validation evidence

The compiler's parser, glyph validator, checksum verifier, and internal SFNT audit passed for all four fonts. The audit found the required TrueType tables, valid table and whole-font checksums, 1000 units per em, U+0061 mapped to glyph `a`, and matching compiled advance/bearings/bounds. The raw `glyf` bounding boxes were read from the emitted SFNT and matched the derived geometry.

Independent command-line font validators were not available: Python FontTools, OTS, FontForge, Fontconfig utilities, and HarfBuzz CLI were absent. Chrome 156.0.0.0 on Android 10 loaded all four fonts through `FontFace.load()` and rendered U+0061 to Canvas at 512 CSS px. The measured advance was 332.7994 px against the 332.8 px value predicted by the 650-unit advance at 512/1000 scale. All four raster bounds matched (x=60…336, y=294…549). Each flat-to-chamfer comparison changed 54 alpha-mask pixels (counting deltas greater than 16), confined to x=327…336 and y=294…302 in the expected upper-right terminal region; advance and raster bounds remained unchanged. The Canvas `TextMetrics.actualBoundingBoxLeft/Right` values were -24/312 px for every variant, while the alpha-thresholded ink occupied x=60…336 at the probe's draw position (x=32). Those text-metric fields therefore do not match the raster ink bounds in this browser run and are reported separately, not treated as exact outline bounds. The measured per-font Canvas metrics and raster comparison are recorded in `browser-results.json`.

This is observed browser font loading and raster output, not a human visual inspection. Android screenshot capture failed, so no viewport screenshot is included. `review.html` and `browser-probe.html` embed the diagnostic fonts for side-by-side inspection and repeatable raster comparison.

## Scope limits

This validates one semantic terminal operation in two existing construction adapters. It does not validate optical kerning, independent shaping behavior, arbitrary profile support, or universal font correctness. No independent font sanitizer or general-purpose SFNT validator ran; successful browser parsing and rendering is a separate runtime check, not a replacement for those tools.
