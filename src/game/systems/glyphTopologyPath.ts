export interface GlyphTopologyCell {
  readonly id: number
  readonly topologyX: number
  readonly topologyY: number
  readonly worldX: number
  readonly worldY: number
}

export interface GlyphTopologyIndex<T extends GlyphTopologyCell> {
  readonly cellById: ReadonlyMap<number, T>
  readonly neighborsById: ReadonlyMap<number, readonly T[]>
}

export interface TopologyPathDirection {
  readonly x: number
  readonly y: number
}

const NEIGHBOR_OFFSETS = Object.freeze([
  Object.freeze([0, -1] as const),
  Object.freeze([1, 0] as const),
  Object.freeze([0, 1] as const),
  Object.freeze([-1, 0] as const),
])

function coordinateKey(x: number, y: number): string {
  return `${x},${y}`
}

export function createGlyphTopologyIndex<T extends GlyphTopologyCell>(
  cells: readonly T[],
): GlyphTopologyIndex<T> {
  const cellById = new Map<number, T>()
  const cellsByCoordinate = new Map<string, T[]>()
  for (const cell of cells) {
    cellById.set(cell.id, cell)
    const key = coordinateKey(cell.topologyX, cell.topologyY)
    const occupants = cellsByCoordinate.get(key)
    if (occupants) {
      occupants.push(cell)
    } else {
      cellsByCoordinate.set(key, [cell])
    }
  }
  for (const occupants of cellsByCoordinate.values()) {
    occupants.sort((first, second) => first.id - second.id)
  }

  const neighborsById = new Map<number, readonly T[]>()
  for (const cell of cells) {
    const neighbors: T[] = []
    for (const [offsetX, offsetY] of NEIGHBOR_OFFSETS) {
      const occupants = cellsByCoordinate.get(
        coordinateKey(cell.topologyX + offsetX, cell.topologyY + offsetY),
      )
      if (occupants) {
        neighbors.push(...occupants)
      }
    }
    neighbors.sort((first, second) => first.id - second.id)
    neighborsById.set(cell.id, neighbors)
  }

  return { cellById, neighborsById }
}

export function findTopologyDistances<T extends GlyphTopologyCell>(
  topology: GlyphTopologyIndex<T>,
  sourceId: number,
): ReadonlyMap<number, number> {
  if (!topology.cellById.has(sourceId)) {
    return new Map()
  }
  const distanceById = new Map<number, number>([[sourceId, 0]])
  const queue = [sourceId]
  for (let index = 0; index < queue.length; index += 1) {
    const currentId = queue[index]
    const nextDistance = (distanceById.get(currentId) ?? 0) + 1
    for (const neighbor of topology.neighborsById.get(currentId) ?? []) {
      if (distanceById.has(neighbor.id)) {
        continue
      }
      distanceById.set(neighbor.id, nextDistance)
      queue.push(neighbor.id)
    }
  }
  return distanceById
}

function comparePathSteps<T extends GlyphTopologyCell>(
  first: T,
  second: T,
  source: T,
  direction: Readonly<TopologyPathDirection> | null,
): number {
  if (direction) {
    const firstDeltaX = first.worldX - source.worldX
    const firstDeltaY = first.worldY - source.worldY
    const secondDeltaX = second.worldX - source.worldX
    const secondDeltaY = second.worldY - source.worldY
    const firstForward =
      firstDeltaX * direction.x + firstDeltaY * direction.y
    const secondForward =
      secondDeltaX * direction.x + secondDeltaY * direction.y
    if (firstForward !== secondForward) {
      return secondForward - firstForward
    }
    const firstLateral = Math.abs(
      firstDeltaX * direction.y - firstDeltaY * direction.x,
    )
    const secondLateral = Math.abs(
      secondDeltaX * direction.y - secondDeltaY * direction.x,
    )
    if (firstLateral !== secondLateral) {
      return firstLateral - secondLateral
    }
  }
  return first.id - second.id
}

export function findDeterministicTopologyPath<T extends GlyphTopologyCell>(
  topology: GlyphTopologyIndex<T>,
  sourceId: number,
  targetId: number,
  direction: Readonly<TopologyPathDirection> | null,
): readonly T[] {
  const source = topology.cellById.get(sourceId)
  const target = topology.cellById.get(targetId)
  if (!source || !target) {
    return []
  }
  const distanceToTarget = findTopologyDistances(topology, targetId)
  const initialDistance = distanceToTarget.get(sourceId)
  if (initialDistance === undefined) {
    return []
  }

  const path = [source]
  let current = source
  let remainingDistance: number = initialDistance
  while (remainingDistance > 0) {
    const nextDistance: number = remainingDistance - 1
    const candidates = (topology.neighborsById.get(current.id) ?? [])
      .filter((cell) => distanceToTarget.get(cell.id) === nextDistance)
      .sort((first, second) =>
        comparePathSteps(first, second, source, direction),
      )
    const next = candidates[0]
    if (!next) {
      return []
    }
    path.push(next)
    current = next
    remainingDistance = nextDistance
  }
  return path
}
