import { getSvgFromGraphicsObject } from "graphics-debug"
import type { DogboneFanoutSolver } from "lib"

export function importedGridSnapshot(solver: DogboneFanoutSolver) {
  const graphics = solver.visualize()
  const [start, via] = graphics.lines![0]!.points
  const dx = Math.abs(via!.x - start!.x)
  const dy = Math.abs(via!.y - start!.y)
  const output = solver.solved ? solver.getOutput() : []
  const color = solver.solved ? "#067647" : "#b42318"
  const status = solver.solved
    ? "ACCEPTED: 1 escape, 1 via"
    : "REJECTED: 0 output traces or vias"
  const render = (zoom: boolean) => {
    // View only: omit the plane/resistor and crop the right panel around W13.
    // All original obstacles remain in the solver input.
    const circles = graphics.circles!.filter(
      ({ center }) =>
        !zoom ||
        (Math.abs(center.x - start!.x) < 1.3 &&
          Math.abs(center.y - start!.y) < 1.3),
    )
    return getSvgFromGraphicsObject(
      {
        circles,
        lines: graphics.lines,
        points: [{ x: start!.x, y: start!.y, color: "#175cd3", label: "W13" }],
      },
      { svgWidth: 550, svgHeight: 490 },
    ).replace(/<svg\b/, `<svg x="${zoom ? 620 : 30}" y="160"`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="905" viewBox="0 0 1200 905">
    <rect width="1200" height="905" fill="white"/>
    <g font-family="sans-serif" fill="#182230">
      <text x="30" y="39" font-size="26" font-weight="bold">Imported STM32MP157DAB1: native dogbone angle rejection</text>
      <text x="30" y="74" font-size="18">All 354 JLCPCB C1236721 pads retained, including their original coordinate precision.</text>
      <text x="30" y="108" font-size="20" font-weight="bold" fill="${color}">${status}</text>
      <text x="30" y="145" font-size="18">Complete imported pad field</text>
      <text x="620" y="145" font-size="18">W13 enlarged: selected pad-to-via candidate</text>
      ${render(false)}
      ${render(true)}
      <text x="30" y="683" font-size="18" fill="${color}">${output.length ? "Orange: accepted native escape trace and via." : "Orange: rejected candidate only; no routed copper is returned."}</text>
      <text x="30" y="716" font-size="18">Pad (${start!.x.toFixed(6)}, ${start!.y.toFixed(6)}) → via (${via!.x.toFixed(6)}, ${via!.y.toFixed(6)}) mm</text>
      <text x="30" y="749" font-size="18">X offset = ${dx.toFixed(6)} mm; Y offset = ${dy.toFixed(6)} mm; difference = ${Math.abs(dx - dy).toFixed(6)} mm.</text>
      <text x="30" y="782" font-size="18">${solver.solved ? "The matcher selects an equal-offset diagonal before copper is emitted." : "The 45° check allows only 0.000001 mm difference; this candidate exceeds it."}</text>
      <path d="M30 804 H1170" stroke="#d0d5dd"/>
      <text x="30" y="834" font-size="17">Expected: choose a clearance-valid straight/45° candidate before committing the assignment.</text>
      <text x="30" y="865" font-size="16">Local escape only (top → inner3); R1 stays unrouted. Inner1 GND and antipads are not drawn.</text>
      <text x="30" y="888" font-size="15">Captured TSX input, native solver, no saved routes or moved pads. This does not prove full-board routing.</text>
    </g>
  </svg>`.replace(/[\t ]+$/gm, "")
}
