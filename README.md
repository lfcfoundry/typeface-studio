# LFCFoundry Typeface Studio

## What it is and how it works

Typeface Studio turns a few words into a TrueType font family you can install. Type what you want ("a warm, friendly storybook font, not too heavy"), press **Make my font**, and see a specimen in your browser. Press **Try another** for a different take. It runs offline from one HTML file.

- **Reading your words.** A built-in reader understands negation ("not too heavy"), degrees ("a bit bolder"), comparisons and "like <font name>". Mood words ("elegant", "calm") are matched against measured real fonts and nudge the settings. Every change is listed with its reason, and each guess has an Undo.
- **Drawing the letters.** A pen engine draws smooth curved outlines for all 95 printable ASCII characters in three styles: Sans, Serif and Slab, with Regular and Bold weights, automatic spacing and kerning. A pixel-grid style is kept as an extra.
- **Making the file.** The outlines are compiled to a TrueType font with fontsketch, and the same bytes are previewed and offered for download. Font building runs in a background worker.
- **Fine control, when wanted.** Sliders for width, heights, stroke thickness and contrast, spacing, openness, squareness and stress angle, plus a glyph grid and editor.

Limits: it covers printable ASCII only, not broad Unicode. Curved letters have many outline points, so hand-editing individual points is awkward. The Slab style is slow at heavy weights. It is not a professional font editor. Visual quality has been checked by eye in Chromium, Firefox and WebKitGTK on a desktop only; phones are untested.

## Why it exists

Most people who want a custom font have no design skills and no wish to learn a font editor. Typeface Studio aims for the fewest steps from an idea to a usable font: one box, one button, nothing sent anywhere, no account.

## Live demo and earlier contour prototype

Open the canonical [GitHub Pages demo](https://lfcfoundry.github.io/typeface-studio/). It links to both the production MVP and a separate experimental contour-engine prototype, plus six prototype TTF downloads.

- [Contour prototype HTML](prototype/dist/typeface-studio-contour-prototype.html)
- [Geometric construction](prototype/dist/typeface-studio-contour-prototype.html?system=geometric)
- [Humanist-inspired construction](prototype/dist/typeface-studio-contour-prototype.html?system=humanist)
- [Serif construction](prototype/dist/typeface-studio-contour-prototype.html?system=serif)
- [Prototype source](prototype/README.md)
- TTFs: [Geometric Regular](prototype/artifacts/LFCFoundry-Contour-geometric-Regular.ttf) · [Geometric Bold](prototype/artifacts/LFCFoundry-Contour-geometric-Bold.ttf) · [Humanist Regular](prototype/artifacts/LFCFoundry-Contour-humanist-Regular.ttf) · [Humanist Bold](prototype/artifacts/LFCFoundry-Contour-humanist-Bold.ttf) · [Serif Regular](prototype/artifacts/LFCFoundry-Contour-serif-Regular.ttf) · [Serif Bold](prototype/artifacts/LFCFoundry-Contour-serif-Bold.ttf)

The contour prototype interprets a brief into a structured specification and constructs ten representative glyphs (A, B, E, H, O, a, e, n, o, g) through three distinct recipe systems. It can compile Regular and Bold outputs and preview the compiled bytes through the browser FontFace API. It remains isolated from the production application and is an engineering experiment, not a complete font editor or broad Unicode font family.

The six linked TTFs are generated prototype artifacts. In the current environment, the internal SFNT audit passed, but independent fontTools and OTS validation and actual browser/font installation checks were unavailable. See the landing page and prototype notes for the exact limitations; do not treat the artifacts as production-ready fonts.

## Run

Open `dist/typeface-studio.html` directly in a current browser. The same file can be hosted on GitHub Pages. The build has no runtime network, server, service worker or external-asset requirement. Browser storage may be restricted for `file://`; download the project JSON for portable recovery.

## Speed report and error log

Five quick taps in the top-left corner open two buttons: Save speed report and Save error log. Each saves a small Markdown file on the device; nothing is sent anywhere. This uses the shared field-report 1.1.1 module from JS-modules (vendored in `src/vendor/`). Timed steps: generating glyphs, building each font, unpacking the mood tables.

## Develop

```sh
npm install
npm test
npm run build
```

The production source is modular under `src/`. `npm run build` bundles JavaScript and CSS into `dist/typeface-studio.html`.

The isolated contour prototype has its own source, tests, and build:

```sh
npm --prefix prototype test
npm --prefix prototype run benchmark
npm --prefix prototype run fonts
node prototype/build.mjs
```

The prototype benchmark currently uses 20 hand-annotated cases. In the latest run, the first-party lexical interpreter and Compromise-backed interpreter both scored 1.000 precision and recall on that small set (median 2.010 ms and 3.191 ms); the existing MVP scored 0.857 precision and 0.618 recall (median 0.123 ms). This does not establish general language accuracy, and the equivalent scores indicate the typography ontology/rules—not Compromise alone—account for the benchmark improvement. Full results and validation boundaries are in [prototype notes](prototype/README.md).

## Exporter and scope

The application uses fontsketch 0.1.0 (MIT) to compile TrueType `glyf`/`loca` outlines and SFNT tables. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Its offline phrase interpreter controls width, stroke weight, contrast, rounded contours, spacing, simple block-serif additions, and fixed-pitch metrics. The default letters now come from the pen engine described above; the pixel row-grid engine remains an option. Humanist construction, historical type subfamilies, adjustable counter shapes, bracketed serifs, and expressive display forms are disclosed as approximations or unsupported. It exports static Regular and Bold fonts; it is not a professional outline editor or broad Unicode font production system.

Project files use schema version 1 and are portable JSON. IndexedDB autosave is best-effort; project download/import is the cross-origin and cross-device backup path.

## GitHub Pages

The existing site is served from the repository's `main` branch root. The root `index.html` is a lightweight static landing page linking to the checked-in app and font artifacts; relative links keep the same content available from GitHub Pages and local static hosting. No build workflow or Pages setting change is required for this existing branch-based deployment. The single-file prototype and production HTML remain in their original output paths.
