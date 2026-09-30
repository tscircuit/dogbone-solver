import { expect, test } from "bun:test"
import { DogboneFanoutSolver, type DogboneFanoutSolverInput } from "lib"
import fixture from "./fixtures/am3352.json"
import { snapshot } from "./fixtures/snapshot"
test("AM3352: all 324 power, ground and signal pads escape locally", async () => {
  const solver = new DogboneFanoutSolver(
    structuredClone(fixture) as DogboneFanoutSolverInput,
  )
  const before = JSON.stringify(solver.getConstructorParams())
  solver.solve()
  expect(solver.error).toBeNull()
  expect(solver.solved).toBe(true)
  expect(solver.getOutput()).toHaveLength(324)
  for (const trace of solver.getOutput()) {
    const start = trace.route[0]!,
      via = trace.route.find((point) => point.route_type === "via")!
    if (start.route_type !== "wire") throw new Error("Expected source wire")
    expect(Math.abs(via.x - start.x)).toBeCloseTo(0.4)
    expect(Math.abs(via.y - start.y)).toBeCloseTo(0.4)
    expect(via.layers).toEqual(["top", "inner1", "inner2", "bottom"])
  }
  expect(JSON.stringify(solver.getConstructorParams())).toBe(before)
  await expect(
    snapshot(solver, "AM3352: 324 local escapes (including VCC / GND)"),
  ).toMatchSvgSnapshot(import.meta.path)
})
