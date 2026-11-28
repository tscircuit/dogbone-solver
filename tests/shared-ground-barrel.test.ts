import { validateRoutedCopperDrc } from "@tscircuit/fanout-solver"
import type { Obstacle } from "../lib/types"
import { expect, test } from "bun:test"
import { DogboneFanoutSolver, type DogboneFanoutSolverInput } from "lib"
import { snapshot } from "./fixtures/snapshot"

test("diagonal ground escapes can share one interstitial barrel", async (): Promise<void> => {
  const pads = Array.from({ length: 16 }, (_, index) => ({
    x: (index % 4) * 0.65,
    y: Math.floor(index / 4) * 0.65,
  }))
  const occupiedSites = [
    { x: 0.325, y: 0.325 },
    { x: 0.975, y: 0.325 },
    { x: 0.325, y: 0.975 },
    { x: 1.625, y: 0.975 },
    { x: 0.975, y: 1.625 },
    { x: 1.625, y: 1.625 },
  ]
  const params: DogboneFanoutSolverInput = {
    fanoutRoutingLayers: ["inner2"],
    input: {
      layerCount: 4,
      minTraceWidth: 0.08,
      minViaPadDiameter: 0.35,
      minViaHoleDiameter: 0.15,
      minTraceToPadEdgeClearance: 0.1,
      minViaEdgeToPadEdgeClearance: 0.1,
      bounds: { minX: -1, maxX: 3, minY: -1, maxY: 3 },
      obstacles: [
        ...pads.map(
          (center, index): Obstacle => ({
            type: "rect",
            shape: "circle",
            center,
            width: 0.35,
            height: 0.35,
            layers: ["top"],
            componentId: "U1",
            obstacleId: `pad-${index}`,
            connectedTo: [
              `port-${index}`,
              index === 5 || index === 10 ? "GND" : `signal-${index}`,
            ],
          }),
        ),
        ...occupiedSites.map((center, index) => ({
          type: "rect" as const,
          shape: "circle" as const,
          center,
          width: 0.35,
          height: 0.35,
          layers: ["top", "inner1", "inner2", "bottom"],
          connectedTo: [`foreign-${index}`],
          circuitJsonMetadata: { pcb_via_id: `existing-via-${index}` },
        })),
      ],
      connections: [5, 10].map((index) => ({
        name: `ground-${index}`,
        netConnectionName: "GND",
        source_trace_id: `trace-${index}`,
        pointsToConnect: [
          { ...pads[index]!, layer: "top", pcb_port_id: `port-${index}` },
        ],
      })),
    },
  }
  const before = structuredClone(params)
  const solver = new DogboneFanoutSolver(params)
  solver.solve()
  expect(solver.failed).toBeFalse()
  expect(solver.solved).toBeTrue()
  const traces = solver.getOutput()
  expect(traces).toHaveLength(2)
  const vias = traces.map(
    (trace) => trace.route.find((point) => point.route_type === "via")!,
  )
  expect(vias[0]!.x).toBeCloseTo(0.975, 9)
  expect(vias[0]!.y).toBeCloseTo(0.975, 9)
  expect(vias[1]).toEqual(vias[0])
  const drc = validateRoutedCopperDrc({
    inputSrj: { ...params.input, traces: [] },
    routedSrj: {
      ...params.input,
      traces: traces.map((trace, index) => ({
        ...trace,
        connection_name: params.input.connections[index]!.name,
      })),
    },
    clearance: 0.1,
    allowBlindAndBuriedVias: false,
  })
  expect(drc.issues).toEqual([])
  expect(drc.valid).toBeTrue()
  const separateNets = structuredClone(params)
  separateNets.input.connections[1]!.netConnectionName = "POWER"
  separateNets.input.obstacles[10]!.connectedTo = ["port-10", "POWER"]
  const foreign = new DogboneFanoutSolver(separateNets)
  foreign.solve()
  expect(foreign.failed).toBeTrue()
  expect(() => foreign.getOutput()).toThrow(
    "No complete local dogbone assignment",
  )
  expect(params).toEqual(before)
  await expect(
    snapshot(solver, "Diagonal ground pads / one interstitial barrel"),
  ).toMatchSvgSnapshot(import.meta.path)
})
