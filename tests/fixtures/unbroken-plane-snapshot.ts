import { getSvgFromGraphicsObject } from "graphics-debug"
import type { DogboneFanoutSolver } from "lib"

function panel(solver: DogboneFanoutSolver, x: number, reserved: boolean) {
  const output = solver.solved ? solver.getOutput() : []
  const vias = output.flatMap((trace) =>
    trace.route.filter((point) => point.route_type === "via"),
  ).length
  const graphics = solver.visualize()
  const title = reserved
    ? "RESERVED: unbroken = true"
    : "CONTROL: unbroken = false"
  const color = solver.solved ? "#067647" : "#b42318"
  const render = (zoom: boolean) =>
    getSvgFromGraphicsObject(
      // The enlarged view omits rectangles (plane/resistor) to show pad escape.
      // This only changes the view; the solver's obstacles remain untouched.
      zoom ? { ...graphics, rects: [] } : graphics,
      { svgWidth: 560, svgHeight: 300 },
    ).replace(/<svg\b/, `<svg x="${x}" y="${zoom ? 460 : 125}"`)

  return `
    <text x="${x}" y="82" fill="${color}" font-size="21" font-weight="bold">${title}</text>
    <text x="${x}" y="108" font-size="17">Actual output: ${output.length} escape trace, ${vias} via</text>
    ${render(false)}
    <text x="${x}" y="448" font-size="17">U1 enlarged: pads and native escape geometry only</text>
    ${render(true)}
    <text x="${x}" y="787" fill="${color}" font-size="17">Orange: actual native escape trace and via.</text>
  `
}

export function unbrokenPlaneSnapshot(
  control: DogboneFanoutSolver,
  repro: DogboneFanoutSolver,
) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="955" viewBox="0 0 1200 955">
    <rect width="1200" height="955" fill="#fff"/>
    <g font-family="sans-serif" fill="#182230">
      <text x="28" y="36" font-size="25" font-weight="bold">Native dogbone solver: reserved plane allows the same escape</text>
      ${panel(control, 28, false)}
      ${panel(repro, 612, true)}
      <path d="M28 809 H1172" stroke="#d0d5dd"/>
      <text x="28" y="838" font-size="17">Both TSX cases contain inner1 GND. Only the reserved pour is passed to the router as an obstacle.</text>
      <text x="28" y="867" font-size="17">The via reaches inner2 through inner1; the pour renderer must leave a copper-free ring (antipad).</text>
      <text x="28" y="896" font-size="17">Both inputs return identical escape geometry. Ground-plane copper and antipads are not rendered here.</text>
      <text x="28" y="925" font-size="16">Native solver visualization from captured TSX inputs. Local escape only; no saved routes or full-board claim.</text>
    </g>
  </svg>`
}
