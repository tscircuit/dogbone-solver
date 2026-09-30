import { expect, test } from "bun:test"
import { DogboneAutorouter } from "lib"
import { smallGrid } from "./fixtures/small-grid"
test("adapter yields, emits lifecycle events and cancels pending work", async () => {
  let yielded = false
  const events: string[] = []
  const router = new DogboneAutorouter(smallGrid(), {
    onSolverStarted: () => events.push("started"),
    onSolverEnded: () => events.push("ended"),
  })
  setTimeout(() => {
    yielded = true
  }, 0)
  const done = new Promise<void>((resolve, reject) => {
    router.on("complete", ({ traces }) => {
      expect(yielded).toBe(true)
      expect(traces).toHaveLength(4)
      resolve()
    })
    router.on("error", ({ error }) => reject(error))
  })
  router.start()
  await done
  expect(events).toEqual(["started", "ended"])
  const cancelled = new DogboneAutorouter(smallGrid())
  let delivered = false
  cancelled.on("complete", () => {
    delivered = true
  })
  cancelled.start()
  cancelled.stop()
  await new Promise((resolve) => setTimeout(resolve, 10))
  expect(delivered).toBe(false)
})
