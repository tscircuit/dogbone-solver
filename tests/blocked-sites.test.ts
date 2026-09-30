import { expect, test } from "bun:test"
import { DogboneFanoutSolver } from "lib"
import { smallGrid } from "./fixtures/small-grid"
import { snapshot } from "./fixtures/snapshot"
test("oversized vias fail without publishing partial copper", async () => {
  const input = smallGrid()
  input.input.minViaPadDiameter = 2
  const solver = new DogboneFanoutSolver(input)
  solver.solve()
  expect(solver.failed).toBe(true)
  expect(() => solver.getOutput()).toThrow(
    "No complete local dogbone assignment",
  )
  await expect(
    snapshot(solver, "NO LEGAL SITE: 2 mm vias / 0.8 mm pitch"),
  ).toMatchSvgSnapshot(import.meta.path)
})
