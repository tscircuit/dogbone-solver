import { expect, test } from "bun:test"
import { solveUnbrokenPlane } from "./fixtures/solve-unbroken-plane"

// Known failure: remove `.failing` and update the repro snapshot after a fix.
// A future integration test must also verify actual antipads/foreign-net DRC.
test.failing("dogbone can escape SIGNAL across a reserved inner1 GND pour", () => {
  expect(solveUnbrokenPlane(true).solved).toBe(true)
})
