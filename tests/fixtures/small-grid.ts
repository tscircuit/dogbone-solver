import type { DogboneFanoutSolverInput } from "lib"
export function smallGrid(layer = "top"): DogboneFanoutSolverInput {
  const pads = [
    { x: 0, y: 0 },
    { x: 0.8, y: 0 },
    { x: 0, y: 0.8 },
    { x: 0.8, y: 0.8 },
  ]
  return {
    fanoutRoutingLayers: ["inner2"],
    input: {
      layerCount: 4,
      minTraceWidth: 0.1,
      minViaPadDiameter: 0.3,
      minViaHoleDiameter: 0.15,
      bounds: { minX: -2, maxX: 3, minY: -2, maxY: 3 },
      obstacles: pads.map((center, index) => ({
        type: "rect",
        shape: "circle",
        center,
        width: 0.4,
        height: 0.4,
        layers: [layer],
        componentId: "U1",
        obstacleId: `pad_${index}`,
        connectedTo: [`port_${index}`],
      })),
      connections: pads.map((point, index) => ({
        name: `signal_${index}`,
        source_trace_id: `trace_${index}`,
        pointsToConnect: [
          {
            ...point,
            layer,
            pcb_port_id: `port_${index}`,
            pointId: `port_${index}`,
          },
        ],
      })),
    },
  }
}
