import { expect, test } from "bun:test"
import { DogboneFanoutSolver } from "lib"
import { smallGrid } from "./fixtures/small-grid"
import { snapshot } from "./fixtures/snapshot"

test("snake_case via diameters size the emitted dogbone vias", async () => {
  const params = smallGrid()
  delete params.input.minViaPadDiameter
  delete params.input.minViaHoleDiameter
  params.input.min_via_pad_diameter = 0.3
  params.input.min_via_hole_diameter = 0.15

  const solver = new DogboneFanoutSolver(params)
  solver.solve()
  expect(solver.failed).toBe(false)
  for (const trace of solver.getOutput())
    expect(
      trace.route.find((point) => point.route_type === "via"),
    ).toMatchObject({
      via_diameter: 0.3,
      via_hole_diameter: 0.15,
    })
  await expect(
    snapshot(solver, "snake_case via diameters: 4 local dogbones"),
  ).toMatchSvgSnapshot(import.meta.path)
})
