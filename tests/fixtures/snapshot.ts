import { getSvgFromGraphicsObject } from "graphics-debug"
import type { DogboneFanoutSolver } from "lib"
export function snapshot(solver: DogboneFanoutSolver, title: string) {
  const graphics = solver.visualize()
  const pads = solver.params.input.obstacles
  const bounds = {
    minX: Math.min(...pads.map((pad) => pad.center.x)) - 0.5,
    maxX: Math.max(...pads.map((pad) => pad.center.x)) + 0.5,
    maxY: Math.max(...pads.map((pad) => pad.center.y)) + 0.5,
  }
  return getSvgFromGraphicsObject({
    ...graphics,
    texts: [
      {
        x: bounds.minX,
        y: bounds.maxY + 0.7,
        text: title,
        fontSize: (bounds.maxX - bounds.minX) / 35,
        color: "#164e63",
        anchorSide: "center_left",
      },
    ],
  })
}
