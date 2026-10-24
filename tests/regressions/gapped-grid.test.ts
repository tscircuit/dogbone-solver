import { validateRoutedCopperDrc } from "@tscircuit/fanout-solver"
import { expect, test } from "bun:test"
import { readFileSync, writeFileSync } from "node:fs"
import { DogboneAutorouter } from "../../lib/index"
import { gappedInput } from "./gapped-grid.fixture"

export function solveGapped(withBlocker = true) {
  const input = structuredClone(gappedInput)
  if (!withBlocker) input.traces = []
  const before = JSON.stringify(input)
  const solver = new DogboneAutorouter({
    input,
    fanoutRoutingLayers: ["bottom"],
  })
  try {
    return solver.solveSync()
  } finally {
    expect(JSON.stringify(input)).toBe(before)
  }
}

export function snapshot(name: string, traces: any[], withBlocker: boolean) {
  const x = (v: number) => 480 + v * 100,
    y = (v: number) => 240 - v * 100
  const pads = gappedInput.obstacles
    .map(
      (p: any) =>
        `<circle cx="${x(p.center.x)}" cy="${y(p.center.y)}" r="20" fill="#666"/>`,
    )
    .join("")
  const copper = [...(withBlocker ? gappedInput.traces : []), ...traces]
    .flatMap((t: any) =>
      t.route.map((p: any, i: number) => {
        const color = t.connection_name === "foreign" ? "#9933aa" : "#008844"
        if (p.route_type === "via")
          return `<circle cx="${x(p.x)}" cy="${y(p.y)}" r="25" fill="${color}"/><circle cx="${x(p.x)}" cy="${y(p.y)}" r="15" fill="white"/>`
        const a = t.route[i - 1]
        return a
          ? `<path d="M${x(a.x)},${y(a.y)} L${x(p.x)},${y(p.y)}" stroke="${color}" stroke-width="10"/>`
          : ""
      }),
    )
    .join("")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="460"><rect width="720" height="460" fill="white"/><g font-family="sans-serif" font-size="16"><text x="20" y="28">Completed gapped-grid escape${withBlocker ? ": fixed barrel" : " control"}</text><text x="20" y="52">0.30 mm drill / 0.50 mm land; green generated, purple fixed</text><text x="20" y="432">Local fanout proof only; full AM3352 DDR / SBC is unfinished</text></g>${pads}${copper}</svg>\n`
  const path = new URL(`./__snapshots__/${name}.svg`, import.meta.url)
  if (process.env.UPDATE_DOGBONE_SNAPSHOTS === "1") writeFileSync(path, svg)
  expect(readFileSync(path, "utf8")).toBe(svg)
}

test("gapped-grid control completes a valid escape", () => {
  const traces = solveGapped(false)
  expect(traces).toHaveLength(1)
  snapshot("gapped-grid-control", traces, false)
})

test("fixed barrel leaves a valid octilinear escape on the gapped grid", () => {
  const traces = solveGapped()
  expect(traces).toHaveLength(1)
  const trace = traces[0]!,
    a = trace.route[0],
    via = trace.route.find((p) => p.route_type === "via")!
  const dx = Math.abs(via.x - a.x),
    dy = Math.abs(via.y - a.y)
  expect(dx < 1e-7 || dy < 1e-7 || Math.abs(dx - dy) < 1e-7).toBe(true)
  expect(via.via_diameter).toBe(0.5)
  expect(via.via_hole_diameter).toBe(0.3)
  expect(via.layers).toEqual(["top", "inner1", "inner2", "bottom"])
  const auditInput = {
    ...gappedInput,
    connections: [
      ...gappedInput.connections,
      {
        name: "foreign",
        pointsToConnect: [
          { x: 0.4, y: -0.35, layer: "top" },
          { x: 0.4, y: -0.45, layer: "bottom" },
        ],
      },
    ],
  }
  const drc = validateRoutedCopperDrc({
    inputSrj: auditInput,
    routedSrj: { ...auditInput, traces: [...gappedInput.traces, ...traces] },
    clearance: 0.1,
    allowBlindAndBuriedVias: false,
  })
  expect(drc.valid).toBe(true)
  expect(drc.checkedViaCount).toBe(2)
  snapshot("gapped-grid-fixed-barrel", traces, true)
})
