import { expect, test } from "bun:test"
import { solveUnbrokenPlane } from "./fixtures/solve-unbroken-plane"
import { unbrokenPlaneSnapshot } from "./fixtures/unbroken-plane-snapshot"

test("repro: reserving inner1 GND blocks the same SIGNAL escape", async () => {
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
  expect(repro.failed).toBe(true)
  expect(repro.error).toBe(
    "No complete local dogbone assignment within clearance/search limits",
  )
  expect(() => repro.getOutput()).toThrow(repro.error!)
  await expect(unbrokenPlaneSnapshot(control, repro)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
