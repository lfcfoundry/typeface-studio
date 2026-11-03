# Independent Font Validation and Visual Review

Date: 2026-11-02

## Result summary

| Check | Result | Evidence / limit |
|---|---|---|
| Existing TTF artifacts preserved | **Passed** | SHA-256 values match the construction handoff. No font-generation command was run. |
| Existing compiler parser and internal font checks | **Passed** | fontsketch 0.1.0 parsed both files; compiler checksum checks and the project `auditSfnt` pass. These are not independent of the font production stack. |
| Actual base/candidate glyph comparison | **Passed internally** | Only `o`'s inner contour differs. `n`, `H`, `.notdef`, and `space` outlines compare byte-structure-identically after parsing. Advances and Unicode arrays match. |
| Independent parser / sanitizer | **Not tested** | fontTools, OTS, FontForge, FreeType command-line utilities, and HarfBuzz utilities were unavailable. |
| Browser native font loading / rendering | **Not verified** | Android Chrome is installed and a VIEW intent was issued, but the browser result could not be inspected. Android screenshot capture failed and no browser automation/CDP interface is available. |
| Shaping | **Not tested** | No HarfBuzz utility or shaping API was available. |

## Available tools

- Node.js: `v26.13.0`.
- `fontsketch`: `0.1.0`, MIT. Its `parseFont`, `verifyChecksums`, and compiler path are related implementations, so this does not count as independent font parsing.
- Project SFNT auditor: `prototype/src/sfnt-audit.js`; internal project check only.
- Android package inventory included `com.android.chrome` and `com.android.webview`; a Chrome version could not be read from this Termux shell.
- Not found: `ots-sanitize`, Python `fontTools`, Python `freetype`, `fontforge`, `fc-scan`, `fc-query`, `fc-list`, `hb-shape`, `hb-view`, `ttx`, `ftview`, `ftvalid`, `ftdump`, Playwright, and Puppeteer.

The categories are distinct: parsing reads font structures; sanitization checks conformance/security properties; rendering rasterizes outlines; shaping maps text sequences to glyph runs and positions. Only compiler-related parsing and the project's internal table/checksum audit ran here.

## Artifact checks and comparison

Both files contain the required TrueType tables: `OS/2`, `cmap`, `glyf`, `head`, `hhea`, `hmtx`, `loca`, `maxp`, `name`, and `post`. Each has five glyph records: `.notdef`, `space`, `o`, `n`, and `H`. The internal SFNT audit reports valid table checksums, whole-font checksums, and horizontal metrics for both.

| Artifact | Bytes | SHA-256 | `o` | `n` | `H` |
|---|---:|---|---|---|---|
| Base | 1,580 | `f94fcae18a65a32d3f486d7f4fa652826c8f87832a79a3eae02bff76e9473824` | U+006F, advance 620, LSB 55, 2 contours | U+006E, advance 650, LSB 55, 1 contour | U+0048, advance 650, LSB 55, 1 contour |
| Open-counter candidate | 1,580 | `00065a4210071d36ecaf4f25ed7808fb74ee04f665627f0f204e4c6131492018` | U+006F, advance 620, LSB 55, 2 contours | U+006E, advance 650, LSB 55, 1 contour | U+0048, advance 650, LSB 55, 1 contour |

The parsed glyph order is identical. The outer `o` contour is exactly identical; only its counter contour changes. The base counter's point bounds are 258 × 262 units (`x=181..439`, `y=119..381`); the candidate counter is 330 × 336 (`x=145..475`, `y=82..418`). That is a 72-unit width and 74-unit height increase. These are the parsed quadratic control-point bounds; for this ellipse construction the extrema are the cardinal points. All advances, left side bearings, Unicode mappings, and outlines for `.notdef`, `space`, `n`, and `H` are exactly equal in fontsketch's parsed representations.

Exact table-byte comparison finds changes in `glyf` and `head`. `glyf` has five changed bytes, with its table checksum changing from `d65bbd2a` to `445bbc2a`; offset and length stay fixed (496, 192 bytes). In `head`, the only changed bytes are offsets 8 and 10 within the table's `checksumAdjustment` field, which must differ to preserve the whole-font checksum after `glyf` changes. Every other table is byte-for-byte identical. The `head` directory checksum remains the same because TrueType table-checksum calculation zeroes `checksumAdjustment`. This is an exact byte comparison using the actual artifacts, not an independent parser result.

## Geometry and typographic observations

- **`o`:** the outer bowl uses four quadratic arcs and has near-circular proportions (510 × 516 units including overshoot). The base counter leaves about 126–127 units of stroke at the cardinal axes, substantially heavier than the shared 90-unit stem decision. The candidate counter leaves 90 units at those axes, so it is more open and aligns better with the `n` and `H` stems. The candidate remains nested inside the outer contour according to the experiment's containment check.
- **`n`:** it has two 90-unit stems joined by one closed outline around a curved shoulder, with an open lower counter. It is continuous as a filled contour, but the outer and inner shoulder arcs meet at explicit center points with non-collinear tangents. The center can therefore read as a cusp or kink rather than a smooth arch. The geometry validator does not check tangent continuity. Its arch also overshoots the 500-unit x-height; this is a design choice that needs visual review.
- **`H`:** the silhouette has two aligned 90-unit stems and a 90-unit crossbar. The bar is centered at y=367, 17 units above the geometric midpoint of the 700-unit cap height. This is a small upward bias, but its optical suitability has not been rendered here.
- **Shared weight:** the `n` stems and `H` stems/crossbar use the same 90-unit parameter. The candidate `o` reaches that thickness at its cardinal axes; the base `o` does not.

These observations combine construction-model coordinates and the compiler-related parsed outlines. They do not establish how a browser or desktop rasterizer renders the contours. Mathematical closure and winding are not a judgment of finished type quality.

## Browser review page

[font-review.html](./font-review.html) is a standalone page with no external resources. It embeds the exact bytes of both existing TTFs as data URLs; the inspection script verified that the embedded base64 payloads match the artifact files. It uses CSS `@font-face`, `document.fonts.load`, `FontFaceSet.check`, and displays each glyph at 12, 32, and 72 pixels plus `onH onH` side by side.

To review manually, open `font-review.html` in Android Chrome or a desktop browser. Confirm that both status messages report successful loading; compare the lowercase `o` counter at 32 and 72 px; then compare `n`, `H`, and `onH onH` for unchanged outlines and spacing. If the fonts fail to load, report the browser and the visible status/error. The page contains its font data, so the TTF files do not need to be beside it.

An Android VIEW intent was attempted:

```sh
am start -a android.intent.action.VIEW -d 'file:///data/data/com.termux/files/home/lfcfoundry/typeface-studio/architecture/universal-design-model/construction-experiment/font-review.html' -t text/html
```

Android accepted the intent, but the active app/page result could not be observed. `/system/bin/screencap -p /tmp/typeface-studio-font-review.png` failed with `Failed to take take screenshot. Capturing failed.` Therefore no claim is made that Chrome actually loaded or rendered either font.

I also issued `termux-open --view --content-type text/html architecture/universal-design-model/construction-experiment/font-review.html`, which returned without an error, but this shell still could not inspect the resulting page or its FontFace status.

## Reproduction commands

Inspection report (reads the two existing fonts; writes `artifact-inspection.json`):

```sh
node architecture/universal-design-model/construction-experiment/inspect-artifacts.mjs
```

Review page generation (reads the two existing fonts; writes `font-review.html`):

```sh
node architecture/universal-design-model/construction-experiment/make-review-page.mjs
```

Environment checks used:

```sh
python3 -c 'import fontTools; print(fontTools.__version__)'
python3 -c 'import freetype; print(freetype.version())'
for tool in ots-sanitize fontforge fc-scan fc-query fc-list hb-shape hb-view ttx ftview ftvalid ftdump; do command -v "$tool"; done
node -e "for (const p of ['fontkit','opentype.js','fonteditor-core','playwright','puppeteer']) { try { console.log(p,require.resolve(p)) } catch {} }"
```

The Python imports failed with `ModuleNotFoundError`, the command-line tools were not found, and no listed Node parser/browser automation package resolved.
