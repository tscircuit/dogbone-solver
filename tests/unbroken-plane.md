# Reproduction: reserved ground plane blocks a dogbone escape

Related design proposal: [#4](https://github.com/tscircuit/dogbone-solver/pull/4).
This adds executable TSX and a visual reproduction against this repository's
solver source; it does not implement the proposal.

```sh
bun install
bun test tests/unbroken-plane.test.tsx tests/unbroken-plane-expected.test.tsx
```

![Native PCB output: ordinary vs reserved ground plane](./__snapshots__/unbroken-plane.snap.svg)

The standalone circuit is [unbroken-plane.circuit.tsx](./fixtures/unbroken-plane.circuit.tsx).
It contains a 3 x 3 pad grid at 0.8 mm pitch, one SIGNAL connection, and an inner1
GND pour. Native `dogbone` targets inner2. `routeRemaining={false}` requests only
the chip's local escape, so the resistor intentionally stays unrouted.

| Only changed TSX prop | Published core output | Repository dogbone solver |
| --- | --- | --- |
| `unbroken={false}` | 1 escape trace, 1 via | Solved |
| `unbroken={true}` | 0 escape traces, 0 vias | Failed |

The failure is `No complete local dogbone assignment within clearance/search limits`.
Expected: both cases can escape; the SIGNAL via crosses inner1 GND with an
antipad, keeping the two nets isolated. The props contract explicitly permits
vias through unbroken pours using antipads.

The test captures `solver:started` from stock core and passes its untouched
constructor input to `DogboneFanoutSolver` imported from this checkout. It checks
that the only input difference is the added `isCopperPour` obstacle on inner1.
The source-pad ID is present in both cases. The snapshot combines native PCB
SVGs from the original Circuit JSON, with enlarged top-copper views and captions.
No manually drawn routes, saved routing, replacement router callbacks, or solver
patches are used.

`unbroken-plane.test.tsx` records the current failure. The separate
`test.failing` in `unbroken-plane-expected.test.tsx` expresses the desired solver
result. Bun reports that expected failure as a passing test; this is not evidence
of a routing fix. Remove `.failing` and update the reproduction assertions and
snapshot after fixing the solver.

The relevant path is `lib/dogbone-fanout-solver.ts`, which passes all obstacles to
`matchComponentDogboneViaSites`. The shared `viaSiteClearsObstacles` helper in
`@tscircuit/fanout-solver` rejects the pour geometrically. A fix must preserve
real obstacle clearance and verify emitted antipads/foreign-net isolation in
core integration. These tests only reproduce the local escape failure.

Core is pinned to 0.0.2323, props to 0.0.724, and the repository's fanout dependency
remains 0.0.79. The circuit-json schema is aligned to 0.0.548 because the current
core bundle requires exports absent in 0.0.507. The additional development
dependencies supply core's footprint/rendering imports and the PCB SVG renderer.

To regenerate the explanatory snapshot intentionally:

```sh
BUN_UPDATE_SNAPSHOTS=1 bun test tests/unbroken-plane.test.tsx
```
