import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { DogboneFanoutSolver } from "lib"
import { smallGrid } from "tests/fixtures/small-grid"
export default (
  <GenericSolverDebugger
    createSolver={() => new DogboneFanoutSolver(smallGrid("bottom"))}
  />
)
