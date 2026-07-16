import {
  GLYPH_CELL_STATE,
  type GlyphCellState,
} from '../glyph/glyphStore.ts'
import {
  DAMAGE_FRONTIER_TRAVERSAL,
  DAMAGE_TARGET_MODE,
  type DamageFrontierTraversal,
  type DamageTargetMode,
} from '../glyph/localDamage.ts'
import { intersectsDamageShape } from './damageSpreadGeometry.ts'
import {
  createGlyphTopologyIndex,
  findDeterministicTopologyPath,
  findTopologyDistances,
  type TopologyPathDirection,
} from './glyphTopologyPath.ts'

export { DAMAGE_TARGET_MODE } from '../glyph/localDamage.ts'
export type { DamageTargetMode } from '../glyph/localDamage.ts'

export interface CircleDamageShape {
  readonly kind: 'CIRCLE'
  readonly x: number
  readonly y: number
  readonly radius: number
}

export interface ConeDamageShape {
  readonly kind: 'CONE'
  readonly x: number
  readonly y: number
  readonly directionX: number
  readonly directionY: number
  readonly range: number
  readonly halfAngleRadians: number
}

export type DamageSelectionShape = CircleDamageShape | ConeDamageShape

export interface DamageSelectionCell {
  readonly id: number
  readonly state: GlyphCellState
  readonly topologyX: number
  readonly topologyY: number
  readonly worldX: number
  readonly worldY: number
  readonly collisionRadius: number
}

export interface GlyphDamageSelection<T extends DamageSelectionCell> {
  readonly impactCells: readonly T[]
  readonly immediateDamageTargets: readonly T[]
  readonly frontierTransfers: readonly Readonly<{
    sourceImpactCell: T
    targetCell: T
    pathCells: readonly T[]
  }>[]
}

interface ForwardCandidate<T extends DamageSelectionCell> {
  readonly cell: T
  readonly firstIntersection: number
  readonly lateralDistance: number
  readonly topologyDistance: number
}

function isLiving(cell: DamageSelectionCell): boolean {
  return cell.state !== GLYPH_CELL_STATE.HUSK
}

function distanceSquaredToShape(
  cell: DamageSelectionCell,
  shape: DamageSelectionShape,
): number {
  return (cell.worldX - shape.x) ** 2 + (cell.worldY - shape.y) ** 2
}

function normalizeDirection(
  x: number,
  y: number,
): Readonly<TopologyPathDirection> | null {
  const length = Math.hypot(x, y)
  return length === 0 ? null : { x: x / length, y: y / length }
}

function getSourceDirection(
  source: DamageSelectionCell,
  shape: DamageSelectionShape,
  traversal: DamageFrontierTraversal,
): Readonly<TopologyPathDirection> | null {
  if (traversal.kind === DAMAGE_FRONTIER_TRAVERSAL.FIXED_DIRECTION) {
    return normalizeDirection(traversal.directionX, traversal.directionY)
  }
  return (
    normalizeDirection(source.worldX - shape.x, source.worldY - shape.y) ??
    (shape.kind === 'CONE'
      ? normalizeDirection(shape.directionX, shape.directionY)
      : null)
  )
}

function getForwardCandidate<T extends DamageSelectionCell>(
  source: T,
  cell: T,
  direction: Readonly<TopologyPathDirection>,
  topologyDistance: number,
): ForwardCandidate<T> | null {
  const deltaX = cell.worldX - source.worldX
  const deltaY = cell.worldY - source.worldY
  const forwardDistance = deltaX * direction.x + deltaY * direction.y
  if (forwardDistance <= 0) {
    return null
  }
  const lateralDistance = Math.abs(
    deltaX * direction.y - deltaY * direction.x,
  )
  if (lateralDistance > cell.collisionRadius) {
    return null
  }
  const intersectionOffset = Math.sqrt(
    Math.max(0, cell.collisionRadius ** 2 - lateralDistance ** 2),
  )
  const lastIntersection = forwardDistance + intersectionOffset
  if (lastIntersection < 0) {
    return null
  }
  return {
    cell,
    firstIntersection: Math.max(0, forwardDistance - intersectionOffset),
    lateralDistance,
    topologyDistance,
  }
}

function selectTargetForSource<T extends DamageSelectionCell>(
  cells: readonly T[],
  source: T,
  selectedIds: ReadonlySet<number>,
  topologyDistanceById: ReadonlyMap<number, number>,
  direction: Readonly<TopologyPathDirection> | null,
): T | undefined {
  if (direction) {
    const forwardCandidates: ForwardCandidate<T>[] = []
    for (const cell of cells) {
      const topologyDistance = topologyDistanceById.get(cell.id)
      if (
        topologyDistance === undefined ||
        !isLiving(cell) ||
        selectedIds.has(cell.id)
      ) {
        continue
      }
      const candidate = getForwardCandidate(
        source,
        cell,
        direction,
        topologyDistance,
      )
      if (candidate) {
        forwardCandidates.push(candidate)
      }
    }
    forwardCandidates.sort(
      (first, second) =>
        first.firstIntersection - second.firstIntersection ||
        first.lateralDistance - second.lateralDistance ||
        first.topologyDistance - second.topologyDistance ||
        first.cell.id - second.cell.id,
    )
    if (forwardCandidates[0]) {
      return forwardCandidates[0].cell
    }
  }

  return cells
    .filter(
      (cell) =>
        isLiving(cell) &&
        !selectedIds.has(cell.id) &&
        topologyDistanceById.has(cell.id),
    )
    .sort(
      (first, second) =>
        (topologyDistanceById.get(first.id) ?? Number.POSITIVE_INFINITY) -
          (topologyDistanceById.get(second.id) ?? Number.POSITIVE_INFINITY) ||
        first.id - second.id,
    )[0]
}

/** Separates local outline impacts from deterministic remote damage paths. */
export function selectGlyphDamage<T extends DamageSelectionCell>(
  cells: readonly T[],
  shape: DamageSelectionShape,
  targetMode: DamageTargetMode,
  traversal: DamageFrontierTraversal,
): GlyphDamageSelection<T> {
  const impactCells = cells
    .filter((cell) => intersectsDamageShape(cell, shape))
    .sort(
      (first, second) =>
        distanceSquaredToShape(first, shape) -
          distanceSquaredToShape(second, shape) || first.id - second.id,
    )
  if (impactCells.length === 0) {
    return {
      impactCells,
      immediateDamageTargets: [],
      frontierTransfers: [],
    }
  }

  const targetQuota =
    targetMode === DAMAGE_TARGET_MODE.SINGLE ? 1 : impactCells.length
  const immediateDamageTargets = impactCells
    .filter(isLiving)
    .slice(0, targetQuota)
  if (immediateDamageTargets.length === targetQuota) {
    return { impactCells, immediateDamageTargets, frontierTransfers: [] }
  }

  const topology = createGlyphTopologyIndex(cells)
  const selectedIds = new Set(immediateDamageTargets.map((cell) => cell.id))
  const frontierTransfers: Array<{
    sourceImpactCell: T
    targetCell: T
    pathCells: readonly T[]
  }> = []
  for (const source of impactCells) {
    if (
      source.state !== GLYPH_CELL_STATE.HUSK ||
      immediateDamageTargets.length + frontierTransfers.length >= targetQuota
    ) {
      continue
    }
    const direction = getSourceDirection(source, shape, traversal)
    const topologyDistanceById = findTopologyDistances(topology, source.id)
    const target = selectTargetForSource(
      cells,
      source,
      selectedIds,
      topologyDistanceById,
      direction,
    )
    if (!target) {
      continue
    }
    const pathCells = findDeterministicTopologyPath(
      topology,
      source.id,
      target.id,
      direction,
    )
    if (pathCells.length === 0) {
      continue
    }
    selectedIds.add(target.id)
    frontierTransfers.push({
      sourceImpactCell: source,
      targetCell: target,
      pathCells,
    })
  }

  return { impactCells, immediateDamageTargets, frontierTransfers }
}
