import { expect, mock, test } from "bun:test"
import {
  DogboneAutorouter,
  DogboneFanoutSolver,
  type DogboneFanoutSolverInput,
} from "lib"
import { smallGrid } from "./fixtures/small-grid"

test("selects the supplied solver once before routing and preserves the default handoff output", () => {
  const params = smallGrid()
  const selected = new DogboneFanoutSolver(params)
  const factory = mock((input: DogboneFanoutSolverInput) => {
    expect(input).toBe(params)
    return selected
  })
  const router = new DogboneAutorouter(params, {}, factory)
  expect(factory).toHaveBeenCalledTimes(1)
  expect(selected.solved).toBe(false)
  expect(router.solveSync()).toEqual(new DogboneAutorouter(params).solveSync())
  expect(selected.solved).toBe(true)
  expect(factory).toHaveBeenCalledTimes(1)
})
