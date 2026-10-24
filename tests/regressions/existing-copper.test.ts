import { expect, test } from "bun:test"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { DogboneAutorouter } from "../../lib/index"
import type { SimpleRouteJson, SimplifiedPcbTrace } from "../../lib/types"

const input: SimpleRouteJson = {
  layerCount: 4,
  minTraceWidth: 0.1,
  minViaPadDiameter: 0.5,
  minViaHoleDiameter: 0.3,
  minTraceToPadEdgeClearance: 0.1,
  minViaEdgeToPadEdgeClearance: 0.1,
  minViaHoleEdgeToViaHoleEdgeClearance: 0.2,
  minBoardEdgeClearance: 0.1,
  bounds: { minX: -5, maxX: 5, minY: -5, maxY: 5 },
  obstacles: [
    [0, 0],
    [0.8, 0],
    [0, 0.8],
    [0.8, 0.8],
  ].map(([x, y], i) => ({
    type: "rect",
    shape: "circle",
    center: { x: x!, y: y! },
    width: 0.4,
    height: 0.4,
    layers: ["top"],
    componentId: "cpu",
    connectedTo: [i === 0 ? "signal" : "unused"],
  })),
  connections: [
    {
      name: "signal",
      source_trace_id: "source_signal",
      pointsToConnect: [{ x: 0, y: 0, layer: "top", pcb_port_id: "cpu_pad" }],
    },
  ],
  traces: [],
  buses: [],
  differentialPairs: [],
}
export function solve(traces: SimplifiedPcbTrace[] = []) {
  const srj = structuredClone({ ...input, traces })
  const before = JSON.stringify(srj)
  const solver = new DogboneAutorouter({
    input: srj,
    fanoutRoutingLayers: ["bottom"],
  })
  const output = solver.solveSync()
  expect(JSON.stringify(srj)).toBe(before)
  expect(output).toHaveLength(1)
  return output
}
export const unblocked = solve()
const via = unblocked[0]!.route.find((p) => p.route_type === "via")!
if (via.route_type !== "via")
  throw new Error("Expected a completed through-via escape")
export const foreignBarrel: SimplifiedPcbTrace = {
  type: "pcb_trace",
  pcb_trace_id: "fixed_barrel",
  connection_name: "foreign",
  route: [{ ...via }],
}

function snapshot(
  name: string,
  output: SimplifiedPcbTrace[],
  fixed: SimplifiedPcbTrace[] = [],
) {
  const px = (x: number) => 250 + x * 120
  const py = (y: number) => 250 - y * 120
  const copper = (traces: SimplifiedPcbTrace[], color: string) =>
    traces
      .flatMap((t) =>
        t.route.map((p, i) => {
          if (p.route_type === "via")
            return `<circle cx="${px(p.x)}" cy="${py(p.y)}" r="30" fill="${color}"/><circle cx="${px(p.x)}" cy="${py(p.y)}" r="18" fill="#fff"/>`
          const prev = t.route[i - 1]
          if (p.route_type !== "wire" || !prev || !("x" in prev)) return ""
          return `<path d="M${px(prev.x)},${py(prev.y)} L${px(p.x)},${py(p.y)}" stroke="${color}" stroke-width="12"/>`
        }),
      )
      .join("")
  const pads = input.obstacles
    .map(
      (o) =>
        `<circle cx="${px(o.center.x)}" cy="${py(o.center.y)}" r="24" fill="#555"/>`,
    )
    .join("")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="620" height="540" viewBox="0 0 620 540"><rect width="620" height="540" fill="white"/><g font-family="sans-serif" font-size="16"><text x="20" y="28">Completed local source-to-bottom-plane escape</text><text x="20" y="52">0.30 mm drill / 0.50 mm land; 0.80 mm pad pitch</text><text x="20" y="486">Green: generated dogbone; purple: immutable foreign copper</text><text x="20" y="514">Local solver snapshot only; full DDR / SBC remains unfinished</text></g>${pads}${copper(fixed, "#9333aa")}${copper(output, "#008844")}</svg>\n`
  const path = new URL(`./__snapshots__/${name}.svg`, import.meta.url)
  if (process.env.UPDATE_DOGBONE_SNAPSHOTS === "1") {
    mkdirSync(new URL("./__snapshots__", import.meta.url), { recursive: true })
    writeFileSync(path, svg)
  }
  expect(readFileSync(path, "utf8")).toBe(svg)
}

test("completed unblocked escape visual snapshot", () =>
  snapshot("existing-copper-unblocked", unblocked))

test("unblocked source completes its bottom-plane dogbone escape", () => {
  expect(via.from_layer).toBe("top")
  expect(via.to_layer).toBe("bottom")
  expect(via.via_diameter).toBe(0.5)
  expect(via.via_hole_diameter).toBe(0.3)
})

test("foreign existing barrel cannot occupy the selected via site", () => {
  const out = solve([foreignBarrel])
  const next = out[0]!.route.find((p) => p.route_type === "via")!
  expect(Math.hypot(next.x - via.x, next.y - via.y)).toBeGreaterThanOrEqual(
    0.6 - 1e-7,
  )
})

for (const kind of ["wire-wire", "wire-via", "via-wire"] as const) {
  test(`foreign inner1 ${kind} segment blocks a through-via land`, () => {
    const left = {
      route_type: "wire" as const,
      x: via.x - 2,
      y: via.y,
      width: 0.1,
      layer: "inner1",
    }
    const right = { ...left, x: via.x + 2 }
    const barrel = { ...via, x: kind === "wire-via" ? right.x : left.x }
    const route =
      kind === "wire-wire"
        ? [left, right]
        : kind === "wire-via"
          ? [left, barrel]
          : [barrel, right]
    const out = solve([
      {
        type: "pcb_trace",
        pcb_trace_id: "fixed_segment",
        connection_name: "foreign",
        route,
      },
    ])
    const next = out[0]!.route.find((p) => p.route_type === "via")!
    expect(Math.abs(next.y - via.y)).toBeGreaterThanOrEqual(0.4 - 1e-7)
  })
}

test("explicit same-net ownership can reuse a fixed barrel", () => {
  expect(
    solve([{ ...foreignBarrel, connection_name: "signal" }])[0]!.route.find(
      (p) => p.route_type === "via",
    ),
  ).toEqual(via)
})

test("completed escape clears fixed barrel visual snapshot", () =>
  snapshot("existing-copper-cleared", solve([foreignBarrel]), [foreignBarrel]))
