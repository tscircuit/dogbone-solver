import { Circuit } from "@tscircuit/core"
import { DogboneFanoutSolver, type DogboneFanoutSolverInput } from "lib"
import UnbrokenPlane from "./unbroken-plane.circuit"

export async function renderUnbrokenPlane(unbroken: boolean) {
  const circuit = new Circuit()
  const inputs: DogboneFanoutSolverInput[] = []
  circuit.on("solver:started", (event) => {
    if (event.solverName === "DogboneFanoutSolver") {
      // Observe the stock core event; do not replace the router or edit input.
      inputs.push(
        structuredClone(event.solverParams) as DogboneFanoutSolverInput,
      )
    }
  })
  circuit.add(<UnbrokenPlane unbroken={unbroken} />)
  await circuit.renderUntilSettled()
  if (inputs.length !== 1) {
    throw new Error(`Expected one native dogbone input, got ${inputs.length}`)
  }
  // Test this repository's source as well as the published core integration.
  const solver = new DogboneFanoutSolver(inputs[0]!)
  solver.solve()
  return { circuit, solver, input: inputs[0]! }
}
