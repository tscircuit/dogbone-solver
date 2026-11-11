// Copy this file and imported-grid.circuit.tsx into an existing tscircuit
// project, then run: bun capture-imported-grid.mjs
// Captured with tscircuit 0.0.3150 / @tscircuit/core 0.0.2334.
// The solver repo intentionally does not depend on core.
import { Circuit } from "@tscircuit/core"
import ImportedGrid from "./imported-grid.circuit.tsx"

const circuit = new Circuit()
const inputs = []
circuit.on("solver:started", (event) => {
  if (event.solverName === "DogboneFanoutSolver") {
    inputs.push(structuredClone(event.solverParams))
  }
})
circuit.add(ImportedGrid())
await circuit.renderUntilSettled()
if (inputs.length !== 1) throw new Error("Expected one native dogbone input")
await Bun.write("imported-grid.json", `${JSON.stringify(inputs[0], null, 2)}\n`)
console.log({
  traces: circuit.db.pcb_trace.list().length,
  vias: circuit.db.pcb_via.list().length,
  errors: circuit.db.pcb_autorouting_error.list().map((e) => e.message),
})
