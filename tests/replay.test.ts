import { expect, test } from "bun:test"
import { DogboneFanoutSolver } from "lib"
import { smallGrid } from "./fixtures/small-grid"
import { snapshot } from "./fixtures/snapshot"
test("serialized inputs reproduce the same stepped solve", async () => {
  const original = new DogboneFanoutSolver(smallGrid())
  original.solve()
  const replay = new DogboneFanoutSolver(
    JSON.parse(JSON.stringify(original.getConstructorParams()[0])),
  )
  replay.step()
  expect(replay.solved).toBe(false)
  while (!replay.solved && !replay.failed) replay.step()
  expect(replay.getOutput()).toEqual(original.getOutput())
  await expect(
    snapshot(replay, "Replay: identical 4 dogbones from JSON input"),
  ).toMatchSvgSnapshot(import.meta.path)
})
