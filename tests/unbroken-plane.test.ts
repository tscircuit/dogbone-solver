import { expect, test } from "bun:test"
import { DogboneFanoutSolver, type DogboneFanoutSolverInput } from "lib"
import ordinary from "./fixtures/unbroken-plane-ordinary.json"
import reserved from "./fixtures/unbroken-plane-reserved.json"
import { unbrokenPlaneSnapshot } from "./fixtures/unbroken-plane-snapshot"

function solveUnbrokenPlane(unbroken: boolean) {
  const input = structuredClone(
    unbroken ? reserved : ordinary,
  ) as DogboneFanoutSolverInput
  const solver = new DogboneFanoutSolver(input)
  solver.solve()
  return solver
}

test("reserved inner1 GND preserves the same SIGNAL escape", async () => {
  const control = solveUnbrokenPlane(false)
  const repro = solveUnbrokenPlane(true)

  const pours = repro.params.input.obstacles.filter((o) => o.isCopperPour)
  expect(pours).toHaveLength(1)
  expect(pours[0]!.layers).toEqual(["inner1"])
  // Compare copies. Neither captured input is edited before solving.
  expect({
    ...repro.params,
    input: {
      ...repro.params.input,
      obstacles: repro.params.input.obstacles.filter((o) => !o.isCopperPour),
    },
  }).toEqual(control.params)
  expect(repro.params.input.connections).toHaveLength(1)
  expect(repro.params.input.traces).toEqual([])
  expect(control.params.input.traces).toEqual([])
  expect(
    repro.params.input.connections[0]!.pointsToConnect[0]!.pcb_port_id,
  ).toBeTruthy()

  expect(control.solved).toBe(true)
  expect(control.getOutput()).toHaveLength(1)
  expect(
    control.getOutput()[0]!.route.filter((p) => p.route_type === "via"),
  ).toHaveLength(1)
  expect(repro.solved).toBe(true)
  expect(repro.failed).toBe(false)
  expect(repro.error).toBeNull()
  expect(repro.getOutput()).toEqual(control.getOutput())
  expect(
    repro.getOutput()[0]!.route.find((p) => p.route_type === "via"),
  ).toMatchObject({
    from_layer: "top",
    to_layer: "inner2",
    layers: ["top", "inner1", "inner2", "bottom"],
  })
  await expect(unbrokenPlaneSnapshot(control, repro)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
