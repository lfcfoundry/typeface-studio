# Typeface Studio: Linux visual-validation handoff

The first task is to render and inspect the actual saved TTFs. Visual review and human acceptance remain pending. Do not begin optical compensation or broad architectural expansion before inspecting the specimens.

This dedicated branch snapshots the dirty Termux architecture workspace from parent `c6145af55231e4688225acb3844d759ea487aa3e`. It does not merge or update the working branch. All files under `architecture/universal-design-model/` are included byte-for-byte. Existing production and prototype release files inherited from the parent commit are unchanged; they are not the candidate output.

## Start here

1. Inspect `architecture/universal-design-model/family-xheight-propagation/README.md`, `build-report-final.json`, `dependency-plan-final.json` and `review-final.html`.
2. Verify the exact saved source and candidate TTFs. Paths in that build report are relative to its experiment directory, not the repository root.
3. Inspect the stroke assessment and actual diagnostic probe fonts under `linux-handoff-evidence/`.
4. Use an available Linux FreeType renderer. The supplied Pillow helper loads the actual saved TTF bytes, checks their hashes and draws through Pillow's FreeType support. It does not reconstruct contours.
5. Produce PNGs at 12,16,24,32,48,96 pixels, comparing o/n/H/a/h, oo/nn/aa/hh/Hh, Hanna/noon/anon, and the complete supported glyph grid. The only encoded inventory is space plus H,a,h,n,o; this is not a complete alphabet. Labels and punctuation are not candidate glyphs.
6. Open the resulting PNGs at native size, including the small specimens. Record the Linux version, renderer/FreeType versions, font-loading method, sizes, antialiasing and available hinting settings. Private loading is sufficient; do not install these fonts system-wide.
7. Record recognizability, stroke consistency, counters, joins, shoulder/bowl transitions, baseline/x-height, spacing/bearings/rhythm and small-size behavior separately. Distinguish measured raster/outline defects from subjective design judgments. Identify which adapter produced each implausible letterform and recommend concrete corrections backed by images.
8. Keep technical checks and visual review separate. Successful loading does not imply professional quality or approval. Do not mark a candidate approved without explicit human acceptance.

## Exact fonts and comparisons

All paths below are relative to the repository root. The saved x-height source and candidate are 1700 bytes each; the new width100 diagnostic is 1704 bytes.

| Purpose | File | SHA-256 |
| --- | --- | --- |
| x-height500, primary width90 | `architecture/universal-design-model/family-xheight-propagation/artifacts-final/source.ttf` | `44aac2c744b2607037ce0445bdde7c1d9a2c1dd45e465d8e878f76c76e1f5efb` |
| x-height520, primary width90 | `architecture/universal-design-model/family-xheight-propagation/artifacts-final/candidate.ttf` | `43310f5c97481f0c802d02f16e56ac29f5dba67c7aea3c0f9a4a5b3f9d0fdd8f` |
| diagnostic x-height520, primary width100 | `linux-handoff-evidence/stroke-width-artifacts/primary-width-100.ttf` | `0d64f58cef5d61f33d1e59abbe1e9cbd6bbeaf62dd0371a7fc9742f5a242f769` |

The first two fonts contain .notdef, space, o,n,H,a,h. Their mappings and advances match; o,n,a,h outlines change, while H/.notdef/space records remain identical. The a left bearing changes55→37. Source revision is `rev:9e756b95e08bc7de`, x-height candidate `rev:96f4702797761a78`. The candidate is a separate font, not a GSUB alternate. Its a is single-storey and is not a compliant substitute for the blocked request for a conventional double-storey a.

The new stroke probe holds x-height520 and changes primary width90→100 through the existing adapters/compiler. Width90 reproduces the saved candidate exactly. Width100 changes all five glyphs, including H; a left bearing37→27 and n yMax560→564. This is diagnostic geometry, not an implemented maintained weight transaction or accepted revision. Width95 is rejected by n/h coordinate constraints. Compiler weight class remains400; the numeric primary width is not a calibrated perceived-weight axis.

## Architecture and authority

The conceptual path is brief → structured intent → resolved design state → semantic construction → derived contours → compiled font → technical checks → human visual review → acceptance.

- `architecture/universal-design-model/README.md`, fixtures and contract tests describe the v2 model. Writing context and shaping-request files represent layout information and request adaptation; they do not implement shaping, bidi resolution or rendering.
- `integration-experiment/engine.mjs` is the maintained transactional executor despite its historical directory name. It supplies revision-bound selectors, dependency ordering, atomic staging/rollback, per-call handlers and content-sensitive revision IDs. It is unchanged by this handoff.
- Semantic nodes/relationships and canonical decisions are authoritative. Contours are derived. `construction-experiment/model.mjs` and `geometry.mjs` cover o/n/H and the bounded single-storey a. `two-storey-grammar` is restricted spine/bowl topology, not an arbitrary graph compiler.
- `natural-language-topology-slice` and `lowercase-h-topology-slice` are bounded language/constructor probes. The saved two-storey a looked like stacked loops; do not infer conventional typographic quality from valid topology.
- `whole-font-brief-specimen` records one bounded English brief, provenance, capabilities and family/glyph scope. Its partial candidate only added h. Humanist character, rounded terminals, calibrated width/counters and conventional double-storey a remain unsupported/unresolved.
- `family-xheight-propagation` operationalizes one family x-height delta using isolated guarded adapter revisions. Those copies are authoritative only for this experiment; historical adapters retain their old contracts. In particular the old h grammar locks90/500 while the isolated revision uses relational checks.
- Terminal profile, related-glyph reuse, aperture, cross-grammar aperture and transaction-composition directories are historical experiments with their own saved artifacts and tests. The transaction-composition baseline is a frozen prerequisite snapshot, not the maintained executor.
- Saved TTFs plus their recorded hashes are authoritative for the first rendering task. Reports/internal audits do not establish visual quality or independent font validation.

## Dependency closure and setup

The snapshot includes the entire universal-design-model directory: sources, fixtures, tests, saved fonts, HTML, historical reports, manifests and preservation records. Ten prototype modules are direct/transitive dependencies and therefore included at their original paths:

`brief.js`, `contours.js`, `font.js`, `glyph-instructions.js`, `glyph-operations.js`, `glyph-svg.js`, `ontology.js`, `recipes.js`, `sfnt-audit.js`, `spec.js` under `prototype/src/`.

They supply the existing compiler/contours, v1 adapter contracts and recipes used by architecture integration tests. Exact existing source bytes are carried; no new prototype behavior was developed. Pre-existing changes to app.js, benchmark.mjs, prototype README/CSS/dist HTML and the untracked prototype glyph-instructions test are excluded from the commit delta. Root production artifacts and prototype UI inherited from the parent are not rebuilt or updated.

External JavaScript dependencies are declared by the existing root and prototype package/lock files: fontsketch0.1.0, compromise14.19.0 and esbuild0.25.12. Node22+ is recommended; Termux validation used Node26.13.0. A fresh Linux checkout can install those locked dependencies with `npm ci` and `npm ci --prefix prototype` if dependency installation is permitted there. No dependency was installed in Termux. Termux test runs used existing modules via temporary local symlinks; those symlinks are not committed and are not needed in Linux after normal dependency setup.

`linux-handoff-evidence/import-audit.json` records successful static resolution of97 architecture entry modules and113 source inputs. All architecture files, including targets of template-based experiment imports and saved artifacts, are present. No runtime import depends on an omitted untracked source. Historical preservation inventories include hashes of unrelated old workspace files; those inventories are evidence, not runtime dependencies.

## Reproduction and rendering

From the repository root, with dependencies already available:

```
node --test architecture/universal-design-model/family-xheight-propagation/propagation.test.mjs
node architecture/universal-design-model/family-xheight-propagation/build.mjs linux1
node linux-handoff-evidence/probe-stroke-width.mjs linux-stroke-probe1
python3 linux-handoff-evidence/render-linux.py --output linux-render-evidence1
```

Each output path must be unused. Builders refuse replacement. The x-height build should reproduce the saved TTF hashes and revision; the stroke probe should reproduce the diagnostic hashes. Existing earlier builders may overwrite their own artifacts: inspect them and use a disposable checkout if reproducing those. The saved font/HTML parity assertions in the architecture tests already cover many historical artifacts.

The renderer helper requires an existing Pillow build with FreeType. It does not install anything. If absent, first check available Linux ImageMagick/FreeType tools; report or request authorization before installing a renderer. Pillow settings are pixel sizes, grayscale antialiasing, BASIC layout, baseline anchors and default FreeType hinting/load behavior. They are recorded in results.json. It produces comparison panels and individual glyph PNGs with hashes; a companion index.html references the PNGs. Inspect those actual pixels. The helper was syntax-checked in Termux but could not be executed there because Pillow/FreeType are absent. No PNGs or Linux rendering results are claimed in this handoff.

For portable functional regression, use the command saved in `linux-handoff-evidence/architecture-portable.json`, which selects192 architecture tests. The unmodified full suite has196 tests:192 pass in this isolated snapshot and four historical workspace-preservation assertions fail against unrelated old prototype README/UI bytes. The portable command explicitly filters those four names with `--test-skip-pattern`; no test source was weakened or removed. Full and portable logs are included. Original preservation scripts may also report branch/status differences on a handoff branch; do not rewrite their historical baselines to silence that.

Verify this handoff with `sha256sum -c linux-handoff-evidence/SNAPSHOT.sha256` from the root. That manifest covers every included architecture file, required prototype module and new handoff evidence/document, excluding itself. Repository-wide old-workspace preservation claims are separate from this snapshot integrity check.

## Receiving-session limits

Actual Linux rasterization and visual inspection are the outstanding first task. Prior Chrome attempts established no rendering evidence for this x-height candidate. Android screenshots failed; Windows access and local Termux rasterizers were unavailable. Historical rasters for earlier experiments must not be mistaken for evidence about the current candidate.

Do not treat Canvas TextMetrics as direct side-bearing measurements. Measure bearings from font tables/outlines and evaluate their visual effect in specimens. Sampled geometry checks do not prove full counter containment, clearance or optical balance. Unrelated family decisions, semantic identities and accepted revisions must survive any later correction. Separate technical validity, renderer acceptance, measured raster behavior, subjective judgments and explicit human approval. Recommend adapter corrections only after evidence; do not begin an optical model or general topology engine during initial validation.

## Whitespace audit

Staging historical untracked files exposes existing trailing spaces (including Markdown hard line breaks) and blank EOF lines, plus whitespace in the raw full-suite assertion log. `git diff --cached --check` therefore reports warnings. These exact source/report bytes are deliberately retained to preserve source hashes and historical evidence. No whitespace-only normalization or baseline rewrite was applied. See validation-summary.json for the captured output.
