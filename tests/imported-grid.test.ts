import { validateRoutedCopperDrc } from "@tscircuit/fanout-solver"
import { expect, test } from "bun:test"
import { DogboneFanoutSolver, type DogboneFanoutSolverInput } from "lib"
import fixture from "./fixtures/imported-grid.json"
import { importedGridSnapshot } from "./fixtures/imported-grid-snapshot"

test("imported STM32 grid selects a clearance-valid 45-degree escape", async () => {
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
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.error).toBeNull()
  const output = solver.getOutput()
  expect(output).toHaveLength(1)
  const trace = output[0]!
  expect(trace.connectsTo).toEqual(["pcb_port_347"])
  expect(trace.source_trace_id).toBe("source_trace_0")
  expect(trace.route).toHaveLength(5)
  const start = trace.route[0]!
  if (start.route_type !== "wire") throw new Error("Expected source wire")
  const vias = trace.route.filter((point) => point.route_type === "via")
  expect(vias).toHaveLength(1)
  const via = vias[0]!

  expect(start).toMatchObject({
    x: 7.199884,
    y: 2.400046,
    layer: "top",
    width: 0.15,
  })
  expect(via).toMatchObject({
    x: 6.799961,
    y: 2.799969,
    from_layer: "top",
    to_layer: "inner3",
    via_diameter: 0.3,
    via_hole_diameter: 0.15,
    layers: ["top", "inner1", "inner2", "inner3", "inner4", "bottom"],
  })
  const dx = Math.abs(via.x - start.x)
  const dy = Math.abs(via.y - start.y)
  expect(Math.abs(dx - dy)).toBeLessThan(1e-9)

  // Audit emitted copper against the original physical pads, independently of
  // candidate selection. Pour antipads are formed downstream and aren't solid
  // pad obstacles in this audit; the solver still receives the reserved plane.
  const auditInput = {
    ...params.input,
    obstacles: params.input.obstacles.filter(
      (obstacle) => !obstacle.isCopperPour,
    ),
    traces: [],
  }
  const drc = validateRoutedCopperDrc({
    inputSrj: auditInput,
    routedSrj: {
      ...auditInput,
      traces: [
        { ...trace, connection_name: params.input.connections[0]!.name },
      ],
    },
    clearance: params.input.minTraceToPadEdgeClearance!,
    allowBlindAndBuriedVias: false,
  })
  expect(drc.issues).toEqual([])
  expect(drc.valid).toBe(true)
  expect(drc.checkedViaCount).toBe(1)
  expect(JSON.stringify(params)).toBe(before)
  await expect(importedGridSnapshot(solver)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
