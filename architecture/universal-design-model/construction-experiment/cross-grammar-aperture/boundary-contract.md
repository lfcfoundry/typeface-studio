# Boundary/port adapter contract v1

This is an isolated experimental contract. No existing universal design contract or runtime was changed.

## Adapter interface

```js
{
  version: 1,
  validate(model),             // Validate a closed support projection; throw on invalid anatomy.
  boundaries(model, nodeId),    // Return zero or more versioned descriptors; no geometry is emitted.
  geometry(model)              // Derive closed support geometry with stable contour/segment IDs.
}
```

Adapters are passed explicitly; the operation executor does not select one using a grammar name, glyph name or Unicode value. A future registration system can resolve adapters by construction capability. No such registry is implemented here.

All methods are required to be pure. Transaction execution supplies independent candidate data and validates before accepting output. A malicious adapter is outside the trust model; the contract is for first-party construction code, not a sandbox for plugins.

## Persistent model conventions

Both grammars expose `id`, `name`, `characterIdentity`, `encoding`, `decisions`, `revision`, `construction.nodes/relations`, and `apertureExtension`. Anatomy nodes use stable IDs and component types; an enclosed space is a `counter` node with one `contained-by` relation to the selected enclosing node. The enclosing component is unrestricted by the operation (bowl, ring, or a future adapter-defined structure).

Empty legacy aperture-extension v1 state is accepted read-only. The new candidate is explicitly v2 because records now use `structureId` rather than `bowlId`, include `boundaryId` and `parameterization`, and ports refer to general structures. A populated v1 state is rejected with a migration requirement; it is not silently reinterpreted. This is local extension versioning, not a change to universal design model v2.

## Descriptor fields

```js
{
  version: 1,
  id: 'stable-boundary-id',
  structureId: 'semantic-target-id',
  spaceId: 'negative-space-node-id',
  classification: 'enclosed-region',
  revisionId: 'current-design-revision',
  aliases: ['exposed-side', 'free-bowl-side'],
  orientation: 'outer-clockwise-inner-counterclockwise',
  parameterization: 'quadratic-local-t',
  range: [0.1, 0.4],
  portOrder: ['lower', 'upper'],
  terminalTreatments: ['flat'],
  outer: { contourId, approach, depart },
  inner: { contourId, approach, depart }
}
```

The descriptor describes closed support geometry, including when the persistent model carries an aperture. Actual open/enclosed topology comes from the extension state. This distinction lets geometry regenerate deterministically while retaining opening intent.

Selection accepts a stable descriptor ID or an alias. Exactly one descriptor must match the semantic target and supplied region; missing, ambiguous, stale or mismatched descriptors are rejected. `free-bowl-side` remains a compatibility alias because the imported legacy operation factory emits it. The grammar-neutral alias is `exposed-side`. Both adapters map that region to their exposed left side; other regions are unsupported.

`approach` and `depart` identify adjacent quadratic segments around the opening center on each contour. The descriptor contains stable references, not final geometry or grammar-specific callbacks. Outer and inner boundary directions are opposite. Local curve parameter t is explicit: halfExtent h removes the outer approach tail t=1-h..1 and depart head 0..h; the inner pair has the corresponding orientation. It is not an angle, arc length, percentage of total perimeter, or a promise of optically equal openings between grammars.

## Port and operation semantics

The existing `semantic.aperture.open` operation factory is imported unchanged. Required scope, provenance, revision precondition and topology precondition are retained. Opening changes the selected counter's component to open-space, changes its enclosure relation to open-space-of, creates one aperture and two owned ports, and records an immutable candidate. Unaffected nodes and design decisions remain identical.

Ports carry stable identity, aperture/structure/boundary ownership, lower/upper role, outer/inner connection, and flat treatment. Derived port endpoints are labeled outer and inner. Shared validation rejects wrong ownership, missing/reversed/duplicate ports, unsupported treatment, stale scope and orphan topology.

The same `openBoundary` routine realizes both descriptors with exact quadratic subdivision followed by integer font-unit quantization. The original contour starts are retained; part of the outer boundary is replaced by two caps and the surviving inner perimeter. The former hole contour is removed, producing an open semantic space and a closed ink perimeter. Counter and boundary directions are validated by the geometry kernel.

The declared metric policy preserves advance and recomputes side bearings from the new bounds. Ring opening changes the left bearing from 55 to 72; spine opening preserves both bearings because its lower bowl retains the extreme.

## Supported scope and limits

One aperture, one selected enclosing node, flat caps, adjacent quadratic boundary pairs, one outer enclosing contour and one associated inner contour. The rest of the counter contour may contain multiple segments; this is what lets one realizer handle a spine wall and a full elliptical perimeter.

Cubic paths, mixed orientation normalization, multiple openings, disjoint cut regions, arbitrary nested negative-space topology, generated boundary discovery and operation composition are unsupported. Both demonstrated grammars provide the same quadratic boundary capability; arbitrary grammar support has not been shown.
