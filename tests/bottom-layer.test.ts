import { expect, test } from "bun:test"
import { DogboneFanoutSolver } from "lib"
import { smallGrid } from "./fixtures/small-grid"
import { snapshot } from "./fixtures/snapshot"
test("bottom-side pads escape to inner2 with through vias", async () => {
  const solver = new DogboneFanoutSolver(smallGrid("bottom"))
  solver.solve()
  expect(solver.failed).toBe(false)
  for (const trace of solver.getOutput())
    expect(
      trace.route.find((point) => point.route_type === "via"),
    ).toMatchObject({
      from_layer: "bottom",
      to_layer: "inner2",
      layers: ["top", "inner1", "inner2", "bottom"],
    })
  await expect(
    snapshot(solver, "BOTTOM to INNER2: 4 local dogbones"),
  ).toMatchSvgSnapshot(import.meta.path)
})
