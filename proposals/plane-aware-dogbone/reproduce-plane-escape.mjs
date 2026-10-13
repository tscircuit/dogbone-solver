import fs from "node:fs"
import { SOLVERS } from "@tscircuit/core"

// Fresh 3 x 3 BGA, board-world millimetres: +X right, +Y up.
const pads = [-0.8, 0, 0.8].flatMap((x, column) =>
  [-0.8, 0, 0.8].map((y, row) => ({
    type: "rect",
    shape: "circle",
    componentId: "U1",
    center: { x, y },
    width: 0.4,
    height: 0.4,
    layers: ["top"],
    connectedTo: [`U1_${column}_${row}`],
    circuitJsonMetadata: { pcb_port_id: `U1_${column}_${row}` },
  })),
)
const input = {
  bounds: { minX: -3, maxX: 3, minY: -3, maxY: 3 },
  layerCount: 6,
  minTraceWidth: 0.102,
  minViaPadDiameter: 0.457,
  minViaHoleDiameter: 0.254,
  minTraceToPadEdgeClearance: 0.102,
  connections: [
    {
      name: "DDR_D0",
      source_trace_id: "DDR_D0",
      pointsToConnect: [{ x: 0, y: 0, layer: "top", pcb_port_id: "U1_1_1" }],
    },
  ],
  obstacles: pads,
}
const plane = {
  type: "rect",
  center: { x: 0, y: 0 },
  width: 6,
  height: 6,
  layers: ["inner1"],
  connectedTo: ["GND"],
  isCopperPour: true,
}
fs.writeFileSync(
  "minimal-plane-escape.srj.json",
  JSON.stringify({ ...input, obstacles: [...pads, plane] }, null, 2),
)
const results = []
for (const [name, obstacles] of [
  ["no_plane", pads],
  ["intermediate_ground_plane", [...pads, plane]],
  [
    "physical_obstacle_on_intermediate_layer",
    [...pads, { ...plane, isCopperPour: false }],
  ],
]) {
  const solver = new SOLVERS.DogboneFanoutSolver({
    input: { ...input, obstacles },
    fanoutRoutingLayers: ["inner2"],
  })
  solver.solve()
  results.push({
    name,
    solved: solver.solved,
    error: solver.error,
    iterations: solver.iterations,
  })
}
fs.writeFileSync(
  "plane-reproduction-results.json",
  JSON.stringify(results, null, 2),
)
console.log(results)
