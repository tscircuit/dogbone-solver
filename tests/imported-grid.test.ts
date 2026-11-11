import { expect, test } from "bun:test"
import { DogboneFanoutSolver, type DogboneFanoutSolverInput } from "lib"
import fixture from "./fixtures/imported-grid.json"
import { importedGridSnapshot } from "./fixtures/imported-grid-snapshot"

test("imported STM32 grid selects an escape rejected by the angle guard", async () => {
  const params = structuredClone(fixture) as DogboneFanoutSolverInput
  const before = JSON.stringify(params)
  const pads = params.input.obstacles.filter(
    (pad) => pad.componentId === "pcb_component_0",
  )
  expect(pads).toHaveLength(354)
  expect(params.input.connections).toHaveLength(1)
  expect(params.input.traces).toEqual([])

  const solver = new DogboneFanoutSolver(params)
  solver.solve()
  expect(solver.phase).toBe("creating_traces")
  expect(solver.solved).toBe(false)
  expect(solver.failed).toBe(true)
  expect(solver.error).toBe(
    "Dogbone fanout requires straight or 45-degree local escapes",
  )
  expect(() => solver.getOutput()).toThrow(solver.error!)

  // visualize() includes the selected candidate even though no copper is output.
  const [start, via] = solver.visualize().lines![0]!.points
  expect(start).toMatchObject({ x: 7.199884, y: 2.400046 })
  expect(via).toEqual({ x: 6.799961, y: 1.999996 })
  const dx = Math.abs(via!.x - start!.x)
  const dy = Math.abs(via!.y - start!.y)
  expect(Math.abs(dx - dy)).toBeCloseTo(0.000127, 9)
  expect(JSON.stringify(params)).toBe(before)
  await expect(importedGridSnapshot(solver)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
