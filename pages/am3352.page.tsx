import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { DogboneFanoutSolver, type DogboneFanoutSolverInput } from "lib"
import fixture from "tests/fixtures/am3352.json"
export default (
  <GenericSolverDebugger
    createSolver={() =>
      new DogboneFanoutSolver(
        structuredClone(fixture) as DogboneFanoutSolverInput,
      )
    }
  />
)
