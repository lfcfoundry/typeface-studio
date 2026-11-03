# Bounded semantic terminal profile

This is one bounded alternate profile shared by two experimental construction adapters: the single-storey lowercase `a` and the spine-and-bowl grammar. It is not a general terminal-design system and does not change production or the contour prototype.

## Semantic target

The single-storey `a` target is `part:a-upper-terminal`, an `anatomy.terminal` node with role `upper-stem-terminal`. It attaches to `part:a-stem`, aligns to the shared x-height decision, and is also referenced by the upper bowl/stem join.

The spine-and-bowl target is the `top` terminal node, with the same `upper-stem-terminal` role. Its `terminates` relation assigns it to the `spine` at port `top`. Both IDs, roles, owning construction instances, and anatomy relationships remain stable when the profile changes. The lower terminals remain flat and do not accept this profile.

Both adapters use the same small semantic vocabulary. Flat remains the default. The alternate semantic parameters are:

```js
{
  profile: 'chamfered',
  alignmentDecisionId: 'decision:x-height',
  orientation: 'outer-right',
  cutRatio: 0.2
}
```

`terminal-profile-record.mjs` contains the shared pure validator. It accepts the profile identifiers `flat` and `chamfered`; for chamfered records it requires orientation `outer-right` and a finite `cutRatio` greater than zero and at most `0.25`. A flat record may not carry those chamfer-only fields. The validator returns stable diagnostics and does not mutate the record. It deliberately ignores adapter-specific fields: the single-storey `a` still requires its `alignmentDecisionId`, while the spine grammar does not use that field, and each adapter retains its exact key allowlist.

`outer-right` is relative to the attached stem in its local frame, with local x increasing toward the glyph's right edge. `cutRatio` is a dimensionless fraction of the owning adapter's stem width. Each adapter then applies its own dimensional feasibility checks after flooring the product: the single-storey `a` requires at least one font unit, and the spine grammar also requires the cut to remain less than half the stem width. These geometry limits are not part of the shared record validator. Each adapter verifies that the target terminal has the expected role and unique relationship to its stem before deriving geometry.

## Geometry and metrics

`construction.bowl-with-attached-stem` and the spine-and-bowl resolver read the role and parameters and derive the chamfer. In both fixtures, the stem is 90 units wide, so `cutRatio: 0.2` gives an 18-unit cut. For the spine fixture, its top edge ends at `(577, 500)` and the diagonal reaches `(595, 482)`; the single-storey `a` has the corresponding local stem coordinates. The bowls, counters, other terminal, and unrelated anatomy remain unchanged. Dispatch uses the selected construction adapter, terminal role, and semantic parameters; it does not use glyph-name-specific geometry. Flat branches retain their original segment sequence and coordinates.

Flat output remains identical to both adapters' saved baseline outlines; the two-storey grammar test also verifies the existing compiled font bytes. The alternate outlines pass the existing `validateGlyph` lifecycle. Counter containment checks sample the curves and are not mathematical proofs. The `a` validator checks terminal alignment, stem attachment, and join attachment; the spine grammar checks terminal-to-spine ownership and its declared top port. Invalid or unsupported input rejects the candidate before acceptance.

The policy is `advance: preserve`, `bearings: recompute-from-derived-bounds`, and `kerning: invalidate-for-review`. Both standalone fixtures keep advance 650 and exact bounds `x=55..595`, `y=0..500`, so the recomputed bearings remain 55/55. The diagnostic assembly keeps advance 1350 and bounds `x=55..1295`, also with 55-unit bearings. The chamfer stays inside the existing extreme bounds; these measurements therefore justify preserving advances and recomputing unchanged bearings for this case. No optical kerning claim is made.

## Transaction integration

The per-call `semantic.terminal.set-profile` handler is in `transaction-composition/integration.mjs` and runs through the maintained executor's existing `operationHandlers` option. Parameters name one component selector, terminal ID, expected current profile, requested profile/orientation/cut ratio, and expected semantic construction revision. The handler validates the requested profile tuple with the same common record validator, while retaining its operation-schema, selector, revision, and current-profile transition checks. It requires exactly one selected instance and a supporting adapter (`capability:a-single-storey` or `capability:spine-quadratic`), rejects missing, duplicate, stale, foreign, multi-instance, or unsupported targets, changes only a staged semantic model, records operation provenance and the nested candidate revision, and asks the selected adapter to derive geometry. The executor runs normal glyph validation. Acceptance promotes the outer and nested revisions; a later failure rolls the transaction back.

Overlapping reflection requires an explicit dependency under the executor's existing interaction rule. Tests execute terminal → reflection and reflection → terminal for both supported terminal adapters and compare semantic construction, contours, component transforms, and metrics. The spine adapter also composes terminal profile and aperture opening in both orders through accepted follow-up revisions, comparing construction, ports, contours, bounds, and metrics. These are bounded composition results, not a general commutativity guarantee.

## Limits

The demonstrated shared contract is stable terminal identity, semantic role, `flat` or `chamfered` profile, the `outer-right` local orientation, and `cutRatio` relative to the owning stem width. Adapters keep their own topology checks and contour construction. The spine adapter can also derive aperture opening; the single-storey `a` adapter in this handler does not. The ring has no stem terminal and remains unsupported. No other terminal profile or orientation is implemented. This remains an architecture experiment, not production registration; no font artifact was rebuilt, and independent font validation or observed browser rendering was not performed.
