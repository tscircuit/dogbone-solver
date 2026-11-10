import { DogboneFanoutSolver, type DogboneFanoutSolverInput } from "lib"
import ordinary from "./unbroken-plane-ordinary.json"
import reserved from "./unbroken-plane-reserved.json"

export function solveUnbrokenPlane(unbroken: boolean) {
  const input = structuredClone(
    unbroken ? reserved : ordinary,
  ) as DogboneFanoutSolverInput
  const solver = new DogboneFanoutSolver(input)
  solver.solve()
  return solver
}
