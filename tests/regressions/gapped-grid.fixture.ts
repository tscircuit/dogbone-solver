export const gappedInput: any = {
  layerCount: 4,
  minTraceWidth: 0.1,
  minViaPadDiameter: 0.5,
  minViaHoleDiameter: 0.3,
  minTraceToPadEdgeClearance: 0.1,
  minViaEdgeToPadEdgeClearance: 0.1,
  minViaHoleEdgeToViaHoleEdgeClearance: 0.2,
  minBoardEdgeClearance: 0.1,
  bounds: { minX: -5, maxX: 3, minY: -3, maxY: 3 },
  obstacles: [-3.2, 0, 0.8].flatMap((x) =>
    [-0.8, 0, 0.8].map((y) => ({
      type: "rect",
      shape: "circle",
      center: { x, y },
      width: 0.4,
      height: 0.4,
      layers: ["top"],
      componentId: "gapped",
      connectedTo: [x === 0 && y === 0 ? "signal" : "unused"],
    })),
  ),
  connections: [
    {
      name: "signal",
      source_trace_id: "signal_source",
      pointsToConnect: [
        { x: 0, y: 0, layer: "top", pcb_port_id: "source_pad" },
      ],
    },
  ],
  traces: [
    {
      type: "pcb_trace",
      pcb_trace_id: "foreign_barrel",
      connection_name: "foreign",
      route: [
        { route_type: "wire", x: 0.4, y: -0.35, layer: "top", width: 0.1 },
        { route_type: "wire", x: 0.4, y: -0.4, layer: "top", width: 0.1 },
        {
          route_type: "via",
          x: 0.4,
          y: -0.4,
          from_layer: "top",
          to_layer: "bottom",
          layers: ["top", "inner1", "inner2", "bottom"],
          via_diameter: 0.5,
          via_hole_diameter: 0.3,
        },
        { route_type: "wire", x: 0.4, y: -0.4, layer: "bottom", width: 0.1 },
        { route_type: "wire", x: 0.4, y: -0.45, layer: "bottom", width: 0.1 },
      ],
    },
  ],
  buses: [],
  differentialPairs: [],
}
