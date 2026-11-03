# Primary-width assessment and diagnostic probe

The canonical geometry parameter is `decision:shared-stem-width`, property `stroke.primary-width`, initially 90 font units. It is not equivalent to compiler weight-class metadata (400), nor a calibrated perceived-weight axis.

- o keeps its outer bowl and shrinks its scaled counter; counter scale 0.78 makes actual wall thickness differ from the primary reference.
- n thickens stems, narrows the opening and raises its shoulder crown: width90→100 gives yMax560→564 at x-height520. Its 0.44 rise ratio and integer/C1 constraints reject width95.
- H thickens both stems and crossbar; its bounds stay fixed. It must be rebuilt for width changes, unlike x-height changes.
- a changes stem width, counter insets and bowl position. At x-height520, xMin/left bearing37→27 for width90→100, with advance650 and right bearing55 preserved. Topology stays single-storey.
- h thickens its stem and return, changes shoulder horizontal coordinates and narrows the opening. Its shoulder vertical profile is not a direct width-controlled offset. Only the isolated family-xheight adapter supports relational dimensions; the earlier h grammar still locks90/500.

The `probe-stroke-width.mjs` script records in-memory geometry results and compiles actual diagnostic TTFs using the existing guarded adapters, canonical point conversion, compiler and internal audit. This is a diagnostic probe, not a maintained stroke-width transaction, accepted design revision, or optical-compensation implementation. Width90 at x-height520 must exactly reproduce the saved candidate hash. Width100 is included for Linux inspection. Width95 is rejected; it must not be silently snapped to another value.

Existing dependency declarations can identify all five targets. A later authorized transaction would parameterize the x-height-specific decision selector/setter, retain source provenance, rebuild all dependents atomically, recompute bearings, and flag spacing/kerning/visual review. The executor can stay unchanged. The current read guard deduplicates decision IDs: n/H paired-stem bindings need explicit equality validation or independent consumption before supporting asymmetric overrides. Current override support only retains existing topology exceptions; weight overrides are unsupported.

One numeric primary-width delta is the smallest defensible technical experiment. A family weight model with construction-specific derived widths could later support compensation, but its mappings require rendered evidence. Separate stem/bowl/join optical parameters add uncalibrated degrees of freedom. Inspect the saved probe first; do not implement compensation during initial Linux validation.

Automated validation uses sampled contour intersection tests and centroid-based counter containment. It does not prove minimum stroke thickness, full counter clearance, optical consistency or small-size readability. Visual review remains pending.
