import type { Circuit } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"

type RenderedCircuit = InstanceType<typeof Circuit>

function panel(circuit: RenderedCircuit, x: number, reserved: boolean) {
  const json = circuit.getCircuitJson()
  const traces = circuit.db.pcb_trace.list().length
  const vias = circuit.db.pcb_via.list().length
  const title = reserved
    ? "REPRO: unbroken = true"
    : "CONTROL: unbroken = false"
  const color = reserved ? "#b42318" : "#067647"
  const render = (zoom: boolean) => {
    const svg = convertCircuitJsonToPcbSvg(json, {
      width: 560,
      height: zoom ? 290 : 400,
      layer: "top",
      showPcbNotes: !zoom,
      showPinNumbers: true,
      shouldDrawErrors: false,
      shouldDrawRatsNest: false,
      showSolderMask: false,
      showSolderPaste: false,
      includeVersion: false,
      ...(zoom && {
        viewport: { minX: -4.5, maxX: -1.5, minY: -1.5, maxY: 1.5 },
      }),
    })
    // Scope SVG drawing IDs when composing multiple native PCB views.
    const prefix = `${reserved ? "repro" : "control"}-${zoom ? "zoom" : "board"}-`
    return svg
      .replace(/<svg\b/, `<svg x="${x}" y="${zoom ? 558 : 118}"`)
      .replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`)
      .replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`)
      .replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`)
  }
  return `
    <text x="${x}" y="82" fill="${color}" font-size="21" font-weight="bold">${title}</text>
    <text x="${x}" y="108" font-size="17">Actual output: ${traces} escape trace, ${vias} via</text>
    ${render(false)}
    <text x="${x}" y="548" font-size="17">U1 enlarged: center pad is SIGNAL; top copper shown</text>
    ${render(true)}
    <text x="${x}" y="876" fill="${color}" font-size="17">${reserved ? "No escape was produced." : "Native dogbone escape and drilled via are visible."}</text>
  `
}

export function unbrokenPlaneSnapshot(
  control: RenderedCircuit,
  repro: RenderedCircuit,
) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1020" viewBox="0 0 1200 1020">
    <rect width="1200" height="1020" fill="#fff"/>
    <g font-family="sans-serif" fill="#182230">
      <text x="28" y="36" font-size="25" font-weight="bold">Dogbone escape blocked by a reserved inner1 ground plane</text>
      ${panel(control, 28, false)}
      ${panel(repro, 612, true)}
      <path d="M28 899 H1172" stroke="#d0d5dd"/>
      <text x="28" y="928" font-size="18">Expected: SIGNAL crosses inner1 GND through a via with an antipad (a copper-free ring).</text>
      <text x="28" y="957" font-size="17">Actual error: No complete local dogbone assignment within clearance/search limits</text>
      <text x="28" y="986" font-size="16">Both cases have the same ground pour. Only unbroken changes. Local fanout only; not a full-board routing test.</text>
    </g>
  </svg>`
}
