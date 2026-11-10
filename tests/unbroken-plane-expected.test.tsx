import { expect, test } from "bun:test"
import { renderUnbrokenPlane } from "./fixtures/render-unbroken-plane"

// Known failure: remove `.failing` and update the repro snapshot after a fix.
// A future integration test must also verify actual antipads/foreign-net DRC.
test.failing("dogbone can escape SIGNAL across a reserved inner1 GND pour", async () => {
  const { solver } = await renderUnbrokenPlane(true)
  expect(solver.solved).toBe(true)
})
