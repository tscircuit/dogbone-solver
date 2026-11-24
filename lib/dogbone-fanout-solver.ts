import { BaseSolver } from "@tscircuit/solver-utils"
import {
  matchComponentDogboneViaSites,
  type PreparedBus,
  type DogboneViaSiteGeometryRules,
} from "@tscircuit/fanout-solver"
import { layer_ref, type PcbPort, type SourceTrace } from "circuit-json"
import type { GraphicsObject } from "graphics-debug"
import type { Obstacle, SimpleRouteJson, SimplifiedPcbTrace } from "./types"
import { getViaBoardLayers } from "./get-via-board-layers"

const ROTATION_TOLERANCE_RAD = (0.5 * Math.PI) / 180
const MAX_SNAP_DISPLACEMENT_MM = 0.002
const COORDINATE_CLUSTER_PITCH_RATIO = 0.05
const FALLBACK_COORDINATE_CLUSTER_MM = 0.005

function findMinPadDistance(pads: Obstacle[]): number {
  let minDist = Number.POSITIVE_INFINITY
  for (let i = 0; i < pads.length; i++) {
    for (let j = i + 1; j < pads.length; j++) {
      const d = Math.hypot(
        pads[j]!.center.x - pads[i]!.center.x,
        pads[j]!.center.y - pads[i]!.center.y,
      )
      if (d > 1e-6 && d < minDist) minDist = d
    }
  }
  return minDist
}

function clusterCoordinates(values: number[], tolerance: number): number[] {
  const sorted = [
    ...new Set(values.map((v) => Math.round(v * 1e6) / 1e6)),
  ].sort((a, b) => a - b)
  if (sorted.length <= 1 || tolerance <= 0) return sorted
  const result: number[] = []
  let clusterStart = sorted[0]!
  let clusterSum = clusterStart
  let clusterCount = 1
  for (let i = 1; i < sorted.length; i++) {
    const v = sorted[i]!
    if (v - clusterStart <= tolerance) {
      clusterSum += v
      clusterCount++
    } else {
      result.push(
        clusterCount === 1
          ? clusterStart
          : Math.round((clusterSum / clusterCount) * 1e6) / 1e6,
      )
      clusterStart = v
      clusterSum = v
      clusterCount = 1
    }
  }
  result.push(
    clusterCount === 1
      ? clusterStart
      : Math.round((clusterSum / clusterCount) * 1e6) / 1e6,
  )
  return result
}

function rotatePoint(
  point: { x: number; y: number },
  origin: { x: number; y: number },
  radians: number,
): { x: number; y: number } {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  }
}

function rotateObstacle(
  obstacle: Obstacle,
  origin: { x: number; y: number },
  radians: number,
): Obstacle {
  const deltaDeg = (radians * 180) / Math.PI
  return {
    ...obstacle,
    center: rotatePoint(obstacle.center, origin, radians),
    ...(obstacle.ccwRotationDegrees !== undefined || obstacle.shape !== "circle"
      ? { ccwRotationDegrees: (obstacle.ccwRotationDegrees ?? 0) + deltaDeg }
      : {}),
  }
}

function rotateBounds(
  bounds: SimpleRouteJson["bounds"],
  origin: { x: number; y: number },
  radians: number,
): SimpleRouteJson["bounds"] {
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.minX, y: bounds.maxY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
  ].map((corner) => rotatePoint(corner, origin, radians))
  return {
    minX: Math.min(...corners.map((c) => c.x)),
    maxX: Math.max(...corners.map((c) => c.x)),
    minY: Math.min(...corners.map((c) => c.y)),
    maxY: Math.max(...corners.map((c) => c.y)),
  }
}

function inferGridRotationRadians(
  pads: Obstacle[],
  minDist: number,
  origin: { x: number; y: number },
): number {
  if (pads.length < 2 || !Number.isFinite(minDist)) return 0

  // Collect nearest-neighbor edge angles folded into [0, pi/2) using circular mean on 4*theta.
  let sumCos = 0
  let sumSin = 0
  let count = 0
  for (let i = 0; i < pads.length; i++) {
    for (let j = i + 1; j < pads.length; j++) {
      const dx = pads[j]!.center.x - pads[i]!.center.x
      const dy = pads[j]!.center.y - pads[i]!.center.y
      const d = Math.hypot(dx, dy)
      if (d < minDist * 0.98 || d > minDist * 1.02) continue
      const angle = Math.atan2(dy, dx)
      sumCos += Math.cos(4 * angle)
      sumSin += Math.sin(4 * angle)
      count++
    }
  }
  if (count === 0) return 0

  const mean4 = Math.atan2(sumSin, sumCos)
  const theta = (((mean4 / 4) % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2)
  const distToAxis = Math.min(theta, Math.PI / 2 - theta)
  const distToDiag = Math.abs(theta - Math.PI / 4)
  const residualRad = Math.min(distToAxis, distToDiag)
  let maxRadius = 0
  for (const pad of pads) {
    const r = Math.hypot(pad.center.x - origin.x, pad.center.y - origin.y)
    if (r > maxRadius) maxRadius = r
  }
  const residualDisplacement = maxRadius * Math.sin(residualRad)
  if (
    residualRad <= ROTATION_TOLERANCE_RAD &&
    residualDisplacement <= MAX_SNAP_DISPLACEMENT_MM
  ) {
    return distToAxis <= distToDiag ? 0 : Math.PI / 4
  }
  const deg = (theta * 180) / Math.PI
  throw new Error(
    `Dogbone fanout requires pad grid rotation to be a multiple of 45 degrees (detected ${deg.toFixed(1)}°)`,
  )
}

/** Serializable board-world points in mm: +X right, +Y up, +Z above,
 * right-handed. Pad placement/rotation/reflection has already been applied. */
export interface DogboneFanoutSolverInput {
  input: SimpleRouteJson
  fanoutRoutingLayers?: string[]
}

export interface DogboneFanoutTrace extends SimplifiedPcbTrace {
  source_trace_id?: SourceTrace["source_trace_id"]
}

/** Local dogbone assignment, replayable without a Circuit or component tree.
 * Each step advances one component assignment or one validated escape trace. */
export class DogboneFanoutSolver extends BaseSolver {
  phase: "preparing" | "assigning_sites" | "creating_traces" | "complete" =
    "preparing"
  private sources: {
    port: Pick<
      PcbPort,
      "pcb_port_id" | "pcb_component_id" | "x" | "y" | "layers"
    >
    sourceTraceId?: SourceTrace["source_trace_id"]
  }[] = []
  private sites = new Map<number, { x: number; y: number }>()
  private traces: DogboneFanoutTrace[] = []
  private steps: Generator<void>

  constructor(public readonly params: DogboneFanoutSolverInput) {
    super()
    this.MAX_ITERATIONS = params.input.connections.length * 2 + 10
    this.steps = this.solveSteps()
  }

  getConstructorParams(): [DogboneFanoutSolverInput] {
    return [this.params]
  }

  _step() {
    try {
      if (this.steps.next().done) {
        this.phase = "complete"
        this.progress = 1
        this.solved = true
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      this.failed = true
    }
  }

  getOutput(): DogboneFanoutTrace[] {
    if (!this.solved)
      throw new Error(this.error ?? "Dogbone fanout is not solved")
    return this.traces
  }

  visualize(): GraphicsObject {
    return {
      rects: this.params.input.obstacles
        .filter((pad) => pad.shape !== "circle")
        .map((pad) => ({
          center: pad.center,
          width: pad.width,
          height: pad.height,
          fill: "rgba(200,40,40,0.3)",
        })),
      circles: [
        ...this.params.input.obstacles
          .filter((pad) => pad.shape === "circle")
          .map((pad) => ({
            center: pad.center,
            radius: pad.width / 2,
            fill: "rgba(200,40,40,0.3)",
          })),
        ...[...this.sites.values()].map((center) => ({
          center,
          radius:
            (this.params.input.minViaPadDiameter ??
              this.params.input.minViaDiameter ??
              0.6) / 2,
          fill: "orange",
        })),
      ],
      lines: [...this.sites].map(([index, via]) => ({
        points: [this.sources[index]!.port, via],
        strokeColor: "orange",
        strokeWidth: this.params.input.minTraceWidth,
      })),
    }
  }

  private *solveSteps(): Generator<void> {
    const { input, fanoutRoutingLayers } = this.params
    const traceWidth = input.minTraceWidth
    const clearance = input.minTraceToPadEdgeClearance ?? 0.1
    const viaDiameter = input.minViaPadDiameter ?? input.minViaDiameter ?? 0.6
    const holeDiameter = input.minViaHoleDiameter ?? 0.3
    const viaClearance = input.minViaEdgeToPadEdgeClearance ?? clearance
    const boardEdgeClearance = input.minBoardEdgeClearance ?? clearance
    const holeClearance =
      input.minViaHoleEdgeToViaHoleEdgeClearance ?? clearance
    this.sources = input.connections.map((connection) => {
      const point = connection.pointsToConnect.find(
        (point) =>
          point.pcb_port_id &&
          input.obstacles.some(
            (pad) =>
              pad.componentId &&
              Math.hypot(pad.center.x - point.x, pad.center.y - point.y) < 1e-6,
          ),
      )
      if (!point?.pcb_port_id)
        throw new Error(
          `Dogbone connection ${connection.name} has no source pad`,
        )
      const pad = input.obstacles.find(
        (pad) =>
          pad.componentId &&
          Math.hypot(pad.center.x - point.x, pad.center.y - point.y) < 1e-6,
      )!
      return {
        port: {
          pcb_port_id: point.pcb_port_id,
          pcb_component_id: pad.componentId!,
          x: point.x,
          y: point.y,
          layers: [layer_ref.parse(point.layer)],
        },
        sourceTraceId: connection.source_trace_id,
      }
    })
    const sources = this.sources
    const layers = getViaBoardLayers(input.layerCount)
    const allowedLayers = fanoutRoutingLayers ?? layers
    if (
      allowedLayers.some(
        (layer) => !layers.some((boardLayer) => boardLayer === layer),
      )
    )
      throw new Error("Dogbone fanout targets an unavailable board layer")
    const busContexts: Array<{
      bus: PreparedBus
      origin: { x: number; y: number }
      rotationRad: number
      rotatedObstacles: Obstacle[]
      rotatedObstacleMap: Map<Obstacle, Obstacle>
    }> = []
    const targets = sources.map(({ port, sourceTraceId }, connectionIndex) => {
      const sourceObstacle = input.obstacles.find(
        (obstacle) =>
          obstacle.componentId === port.pcb_component_id &&
          Math.hypot(obstacle.center.x - port.x, obstacle.center.y - port.y) <
            1e-6,
      )
      if (!sourceObstacle)
        throw new Error(
          "Dogbone fanout requires a component pad at each source port",
        )
      if (port.layers.length !== 1 || !layers.includes(port.layers[0]!)) {
        throw new Error("Dogbone fanout requires a single-layer SMT source pad")
      }
      const sourceLayer = port.layers[0]!
      const targetLayer = allowedLayers.find((layer) => layer !== sourceLayer)
      if (!targetLayer)
        throw new Error(
          "Dogbone fanout requires a legal layer distinct from the source pad",
        )
      let busCtx = busContexts.find(
        (ctx) => ctx.bus.componentId === sourceObstacle.componentId,
      )
      if (!busCtx) {
        const rawPads = input.obstacles.filter(
          (obstacle) => obstacle.componentId === sourceObstacle.componentId,
        )
        const origin = {
          x:
            (Math.min(...rawPads.map((p) => p.center.x)) +
              Math.max(...rawPads.map((p) => p.center.x))) /
            2,
          y:
            (Math.min(...rawPads.map((p) => p.center.y)) +
              Math.max(...rawPads.map((p) => p.center.y))) /
            2,
        }
        const minPadDist = findMinPadDistance(rawPads)
        const rotationRad = inferGridRotationRadians(
          rawPads,
          minPadDist,
          origin,
        )
        const rotatedObstacleMap = new Map<Obstacle, Obstacle>()
        const rotatedObstacles =
          rotationRad === 0
            ? input.obstacles
            : input.obstacles.map((o) => {
                const rot = rotateObstacle(o, origin, -rotationRad)
                rotatedObstacleMap.set(o, rot)
                return rot
              })
        const pads =
          rotationRad === 0
            ? rawPads
            : rawPads.map((pad) => rotatedObstacleMap.get(pad)!)
        const clusterTolerance = Number.isFinite(minPadDist)
          ? minPadDist * COORDINATE_CLUSTER_PITCH_RATIO
          : FALLBACK_COORDINATE_CLUSTER_MM
        const xs = clusterCoordinates(
          pads.map((pad) => pad.center.x),
          clusterTolerance,
        )
        const ys = clusterCoordinates(
          pads.map((pad) => pad.center.y),
          clusterTolerance,
        )
        if (xs.length < 2 || ys.length < 2)
          throw new Error("Dogbone fanout requires a two-dimensional pad grid")
        const pitch = (coordinates: number[]) =>
          Math.min(...coordinates.slice(1).map((v, i) => v - coordinates[i]!))
        const bus: PreparedBus = {
          busId: sourceObstacle.componentId!,
          componentId: sourceObstacle.componentId!,
          componentObstacles: pads,
          connections: [],
          direction: "down",
          // Local pad-to-via escapes require straight/45-degree candidates.
          termination: { type: "plane", layer: targetLayer },
          componentBounds: {
            minX: xs[0]!,
            maxX: xs.at(-1)!,
            minY: ys[0]!,
            maxY: ys.at(-1)!,
          },
          sharedBoundary:
            rotationRad === 0
              ? input.bounds
              : rotateBounds(input.bounds, origin, -rotationRad),
          xCoordinates: xs,
          yCoordinates: ys,
          pitchX: pitch(xs),
          pitchY: pitch(ys),
        }
        busCtx = {
          bus,
          origin,
          rotationRad,
          rotatedObstacles,
          rotatedObstacleMap,
        }
        busContexts.push(busCtx)
      }
      const localPortPos =
        busCtx.rotationRad === 0
          ? { x: port.x, y: port.y }
          : rotatePoint(port, busCtx.origin, -busCtx.rotationRad)
      const localSourceObstacle =
        busCtx.rotationRad === 0
          ? sourceObstacle
          : busCtx.rotatedObstacleMap.get(sourceObstacle)!
      const sourcePoint = {
        x: localPortPos.x,
        y: localPortPos.y,
        layer: sourceLayer,
        pcb_port_id: port.pcb_port_id,
      }
      busCtx.bus.connections.push({
        connectionIndex,
        connection: { name: port.pcb_port_id, pointsToConnect: [sourcePoint] },
        sourcePoint,
        sourcePointIndex: 0,
        sourceLayer,
        sourceObstacle: localSourceObstacle,
        targetPoint: sourcePoint,
      })
      return { sourceTraceId, port, sourceLayer, targetLayer }
    })
    const sites = this.sites
    const blockingSegments: NonNullable<
      DogboneViaSiteGeometryRules["blockingSegments"]
    >[number][] = []
    const blockingVias: NonNullable<
      DogboneViaSiteGeometryRules["blockingVias"]
    >[number][] = []
    // Earlier phases own immutable copper. Share sites only with an explicitly
    // matching net; unnamed traces must never accidentally become same-net.
    for (const [traceIndex, trace] of (input.traces ?? []).entries()) {
      const aliases = [trace.connection_name, trace.source_trace_id].filter(
        Boolean,
      )
      const owner = input.connections.findIndex((connection) =>
        [connection.name, connection.source_trace_id].some(
          (id) => id && aliases.includes(id),
        ),
      )
      const connectionIndex = owner >= 0 ? owner : -traceIndex - 1
      for (const [index, point] of trace.route.entries()) {
        const prior = trace.route[index - 1]
        if (
          point.route_type === "wire" &&
          prior?.route_type === "wire" &&
          point.layer === prior.layer
        ) {
          blockingSegments.push({
            connectionIndex,
            segment: {
              start: prior,
              end: point,
              width: Math.max(prior.width, point.width),
              layer: point.layer,
            },
          })
        } else if (point.route_type === "via" && prior?.route_type === "wire") {
          blockingSegments.push({
            connectionIndex,
            segment: {
              start: prior,
              end: point,
              width: prior.width,
              layer: prior.layer,
            },
          })
        } else if (point.route_type === "wire" && prior?.route_type === "via") {
          blockingSegments.push({
            connectionIndex,
            segment: {
              start: prior,
              end: point,
              width: point.width,
              layer: point.layer,
            },
          })
        }
        // The barrel still blocks every spanned layer when it also terminates
        // a segment. Logical endpoints alone do not describe its copper land.
        if (point.route_type === "via") {
          const from = layers.indexOf(
            point.from_layer as (typeof layers)[number],
          )
          const to = layers.indexOf(point.to_layer as (typeof layers)[number])
          blockingVias.push({
            connectionIndex,
            center: point,
            diameter: point.via_diameter ?? viaDiameter,
            spanLayers:
              point.layers ??
              (from >= 0 && to >= 0
                ? layers.slice(Math.min(from, to), Math.max(from, to) + 1)
                : layers),
          })
        }
      }
    }
    for (const { bus, origin, rotationRad, rotatedObstacles } of busContexts) {
      this.phase = "assigning_sites"
      yield
      const solverObstacles = rotatedObstacles
      const solverBlockingSegments =
        rotationRad === 0
          ? blockingSegments
          : blockingSegments.map((item) => ({
              ...item,
              segment: {
                ...item.segment,
                start: rotatePoint(item.segment.start, origin, -rotationRad),
                end: rotatePoint(item.segment.end, origin, -rotationRad),
              },
            }))
      const solverBlockingVias =
        rotationRad === 0
          ? blockingVias
          : blockingVias.map((item) => ({
              ...item,
              center: rotatePoint(item.center, origin, -rotationRad),
            }))
      const assignment = matchComponentDogboneViaSites([bus], {
        traceWidth,
        clearance: Math.max(clearance, viaClearance),
        viaDiameter,
        viaHoleDiameter: holeDiameter,
        holeToHoleClearance: holeClearance,
        additionalObstacles: solverObstacles,
        blockingSegments: solverBlockingSegments,
        blockingVias: solverBlockingVias,
      })
      if (!assignment || assignment.size !== bus.connections.length)
        throw new Error(
          "No complete local dogbone assignment within clearance/search limits",
        )
      for (const connection of bus.connections) {
        const connectionIndex = connection.connectionIndex
        const localVia = assignment.get(connectionIndex)!
        const via =
          rotationRad === 0
            ? localVia
            : rotatePoint(localVia, origin, rotationRad)
        const worldStart = targets[connectionIndex]!.port
        sites.set(connectionIndex, via)
        blockingSegments.push({
          connectionIndex,
          segment: {
            start: worldStart,
            end: via,
            width: traceWidth,
            layer: connection.sourceLayer,
          },
        })
        blockingVias.push({
          connectionIndex,
          center: via,
          diameter: viaDiameter,
          spanLayers: layers,
        })
      }
    }
    this.phase = "creating_traces"
    for (const [
      index,
      { sourceTraceId, port, sourceLayer, targetLayer },
    ] of targets.entries()) {
      const via = sites.get(index)!
      const dx = Math.abs(via.x - port.x),
        dy = Math.abs(via.y - port.y)
      if (dx > 1e-6 && dy > 1e-6 && Math.abs(dx - dy) > 1e-6)
        throw new Error(
          "Dogbone fanout requires straight or 45-degree local escapes",
        )
      const margin = viaDiameter / 2 + boardEdgeClearance
      if (
        via.x < input.bounds.minX + margin ||
        via.x > input.bounds.maxX - margin ||
        via.y < input.bounds.minY + margin ||
        via.y > input.bounds.maxY - margin
      )
        throw new Error("Dogbone via violates board-edge clearance")
      this.traces.push({
        type: "pcb_trace",
        pcb_trace_id: `dogbone_${port.pcb_port_id}`,
        source_trace_id: sourceTraceId,
        connectsTo: [port.pcb_port_id],
        route: [
          {
            route_type: "wire",
            x: port.x,
            y: port.y,
            layer: sourceLayer,
            width: traceWidth,
          },
          { route_type: "wire", ...via, layer: sourceLayer, width: traceWidth },
          {
            route_type: "via",
            ...via,
            from_layer: sourceLayer,
            to_layer: targetLayer,
            via_diameter: viaDiameter,
            via_hole_diameter: holeDiameter,
            layers,
          },
          { route_type: "wire", ...via, layer: targetLayer, width: traceWidth },
          { route_type: "wire", ...via, layer: targetLayer, width: traceWidth },
        ],
      })
      this.progress = (index + 1) / targets.length
      yield
    }
  }
}
