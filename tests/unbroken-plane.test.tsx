import { expect, test } from "bun:test"
import { renderUnbrokenPlane } from "./fixtures/render-unbroken-plane"
import { unbrokenPlaneSnapshot } from "./fixtures/unbroken-plane-snapshot"

test("repro: reserving the inner1 GND pour blocks the same SIGNAL escape", async () => {
  const control = await renderUnbrokenPlane(false)
  const repro = await renderUnbrokenPlane(true)

  // The captured inputs differ only by the reserved pour obstacle.
  // Compare copies; neither native input is edited before solving.
  const pours = repro.input.input.obstacles.filter((o) => o.isCopperPour)
  expect(pours).toHaveLength(1)
  expect(pours[0]!.layers).toEqual(["inner1"])
  expect({
    ...repro.input,
    input: {
      ...repro.input.input,
      obstacles: repro.input.input.obstacles.filter((o) => !o.isCopperPour),
    },
  }).toEqual(control.input)
  expect(repro.input.input.connections).toHaveLength(1)
  expect(
    repro.input.input.connections[0]!.pointsToConnect[0]!.pcb_port_id,
  ).toBeTruthy()

  // Assert this repository's solver, independently of core's bundled copy.
  expect(control.solver.solved).toBe(true)
  expect(control.solver.getOutput()).toHaveLength(1)
  expect(repro.solver.failed).toBe(true)
  expect(repro.solver.error).toBe(
    "No complete local dogbone assignment within clearance/search limits",
  )
  expect(() => repro.solver.getOutput()).toThrow(repro.solver.error!)

  // Snapshot only the unmodified native Circuit JSON, never invented copper.
  expect(control.circuit.db.pcb_autorouting_error.list()).toHaveLength(0)
  expect(control.circuit.db.pcb_trace.list()).toHaveLength(1)
  expect(control.circuit.db.pcb_via.list()).toHaveLength(1)
  expect(repro.circuit.db.pcb_trace.list()).toHaveLength(0)
  expect(repro.circuit.db.pcb_via.list()).toHaveLength(0)
  expect(
    repro.circuit.db.pcb_autorouting_error.list().map((e) => e.message),
  ).toEqual([repro.solver.error!])
  await expect(
    unbrokenPlaneSnapshot(control.circuit, repro.circuit),
  ).toMatchSvgSnapshot(import.meta.path)
})
