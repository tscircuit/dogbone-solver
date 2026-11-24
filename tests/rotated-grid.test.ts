import { expect, test } from "bun:test"
import { DogboneFanoutSolver, type DogboneFanoutSolverInput } from "lib"

function makeRotatedBga(
  rotationDeg: number,
  gridSize = 6,
  pitchX = 1,
  pitchY = pitchX,
  roundStepMm?: number,
): DogboneFanoutSolverInput {
  const rad = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const halfX = ((gridSize - 1) * pitchX) / 2
  const halfY = ((gridSize - 1) * pitchY) / 2
  const roundCoord = (value: number) =>
    roundStepMm ? Math.round(value / roundStepMm) * roundStepMm : value
  const pads: { x: number; y: number }[] = []
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const lx = col * pitchX - halfX
      const ly = row * pitchY - halfY
      pads.push({
        x: roundCoord(lx * cos - ly * sin),
        y: roundCoord(lx * sin + ly * cos),
      })
    }
  }
  const activeIndices = [0, 5, 7, 14, 21, 28, 30, 35]
  return {
    fanoutRoutingLayers: ["inner2"],
    input: {
      layerCount: 4,
      minTraceWidth: 0.1,
      minViaPadDiameter: 0.4,
      minViaHoleDiameter: 0.15,
      bounds: { minX: -7, maxX: 7, minY: -7, maxY: 7 },
      obstacles: pads.map((center, index) => ({
        type: "rect",
        shape: "circle",
        center,
        width: 0.5,
        height: 0.5,
        layers: ["top"],
        componentId: "U1",
        obstacleId: `pad_${index}`,
        connectedTo: [`port_${index}`],
      })),
      connections: activeIndices.map((padIndex, i) => ({
        name: `net_${i}`,
        source_trace_id: `trace_${i}`,
        pointsToConnect: [
          {
            ...pads[padIndex]!,
            layer: "top",
            pcb_port_id: `port_${padIndex}`,
            pointId: `port_${padIndex}`,
          },
        ],
      })),
    },
  }
}

test("45-degree rotated BGA escapes all 8 pads with valid straight or 45-degree segments", () => {
  const solver = new DogboneFanoutSolver(makeRotatedBga(45))
  solver.solve()
  expect(solver.failed).toBe(false)
  expect(solver.error).toBeNull()
  const traces = solver.getOutput()
  expect(traces).toHaveLength(8)
  for (const trace of traces) {
    const via = trace.route.find((p) => p.route_type === "via")
    expect(via).toBeDefined()
  }
})

test("135-degree rotated BGA escapes all 8 pads cleanly", () => {
  const solver = new DogboneFanoutSolver(makeRotatedBga(135))
  solver.solve()
  expect(solver.failed).toBe(false)
  expect(solver.getOutput()).toHaveLength(8)
})

test("non-45-degree rotation fails with a clear rotation error", () => {
  for (const angle of [0.3, 30, 44.7, 45.3]) {
    const solver = new DogboneFanoutSolver(makeRotatedBga(angle))
    solver.solve()
    expect(solver.failed).toBe(true)
    expect(solver.error).toMatch(/rotation/i)
    expect(solver.error).toMatch(/45/)
  }
})

test("45-degree rotated BGA rounded to 0.001 mm escapes all 8 pads cleanly", () => {
  const solver = new DogboneFanoutSolver(makeRotatedBga(45, 6, 1, 1, 0.001))
  solver.solve()
  expect(solver.failed).toBe(false)
  expect(solver.error).toBeNull()
  expect(solver.getOutput()).toHaveLength(8)
})

test("45-degree rotated 6x6 1mm and 16x16 0.8mm BGAs rounded to 0.01 mm escape all 8 pads cleanly", () => {
  for (const [gridSize, pitch] of [
    [6, 1],
    [16, 0.8],
  ] as const) {
    const input = makeRotatedBga(45, gridSize, pitch, pitch, 0.01)
    input.input.bounds = { minX: -12, maxX: 12, minY: -12, maxY: 12 }
    const solver = new DogboneFanoutSolver(input)
    solver.solve()
    expect(solver.failed).toBe(false)
    expect(solver.error).toBeNull()
    expect(solver.getOutput()).toHaveLength(8)
  }
})

test("45-degree rotated rectangular-pitch BGA escapes all 8 pads cleanly", () => {
  const solver = new DogboneFanoutSolver(makeRotatedBga(45, 6, 1, 1.27))
  solver.solve()
  expect(solver.failed).toBe(false)
  expect(solver.error).toBeNull()
  expect(solver.getOutput()).toHaveLength(8)
})
