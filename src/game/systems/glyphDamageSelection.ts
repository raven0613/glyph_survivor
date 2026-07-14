import {
  GLYPH_CELL_STATE,
  type GlyphCellState,
} from '../glyph/glyphStore.ts'
import {
  DAMAGE_TARGET_MODE,
  type DamageTargetMode,
} from '../glyph/localDamage.ts'
import { intersectsDamageShape } from './damageSpreadGeometry.ts'

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
  readonly damageTargets: readonly T[]
  readonly frontierTransfers: readonly Readonly<{
    sourceImpactCell: T
    targetCell: T
  }>[]
}

const NEIGHBOR_OFFSETS = Object.freeze([
  Object.freeze([0, -1] as const),
  Object.freeze([1, 0] as const),
  Object.freeze([0, 1] as const),
  Object.freeze([-1, 0] as const),
])

function isLiving(cell: DamageSelectionCell): boolean {
  return cell.state !== GLYPH_CELL_STATE.HUSK
}

function distanceSquaredToShape(
  cell: DamageSelectionCell,
  shape: DamageSelectionShape,
): number {
  return (cell.worldX - shape.x) ** 2 + (cell.worldY - shape.y) ** 2
}

interface TopologyReach {
  readonly distance: number
  readonly sourceImpactCellId: number
}

function findTopologyReach<T extends DamageSelectionCell>(
  cells: readonly T[],
  impactCells: readonly T[],
): ReadonlyMap<number, Readonly<TopologyReach>> {
  const cellsByCoordinate = new Map<string, T[]>()
  for (const cell of cells) {
    const key = `${cell.topologyX},${cell.topologyY}`
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

  const reachById = new Map<number, TopologyReach>()
  const queue = [...impactCells].sort((first, second) => first.id - second.id)
  for (const cell of queue) {
    reachById.set(cell.id, { distance: 0, sourceImpactCellId: cell.id })
  }

  for (let index = 0; index < queue.length; index += 1) {
    const cell = queue[index]
    const currentReach = reachById.get(cell.id)
    if (!currentReach) {
      continue
    }
    const nextDistance = currentReach.distance + 1
    for (const [offsetX, offsetY] of NEIGHBOR_OFFSETS) {
      const neighbors = cellsByCoordinate.get(
        `${cell.topologyX + offsetX},${cell.topologyY + offsetY}`,
      )
      if (!neighbors) {
        continue
      }
      for (const neighbor of neighbors) {
        const previousReach = reachById.get(neighbor.id)
        if (
          previousReach &&
          (previousReach.distance < nextDistance ||
            (previousReach.distance === nextDistance &&
              previousReach.sourceImpactCellId <=
                currentReach.sourceImpactCellId))
        ) {
          continue
        }
        reachById.set(neighbor.id, {
          distance: nextDistance,
          sourceImpactCellId: currentReach.sourceImpactCellId,
        })
        queue.push(neighbor)
      }
    }
  }

  return reachById
}

/** Separates local outline impacts from deterministic living durability targets. */
export function selectGlyphDamage<T extends DamageSelectionCell>(
  cells: readonly T[],
  shape: DamageSelectionShape,
  targetMode: DamageTargetMode,
): GlyphDamageSelection<T> {
  const impactCells = cells
    .filter((cell) => intersectsDamageShape(cell, shape))
    .sort(
      (first, second) =>
        distanceSquaredToShape(first, shape) -
          distanceSquaredToShape(second, shape) || first.id - second.id,
    )
  if (impactCells.length === 0) {
    return { impactCells, damageTargets: [], frontierTransfers: [] }
  }

  const targetQuota =
    targetMode === DAMAGE_TARGET_MODE.SINGLE ? 1 : impactCells.length
  const damageTargets = impactCells.filter(isLiving).slice(0, targetQuota)
  if (damageTargets.length === targetQuota) {
    return { impactCells, damageTargets, frontierTransfers: [] }
  }

  const selectedIds = new Set(damageTargets.map((cell) => cell.id))
  const impactIds = new Set(impactCells.map((cell) => cell.id))
  const topologyReach = findTopologyReach(cells, impactCells)
  const frontierTargets = cells
    .filter(
      (cell) =>
        isLiving(cell) &&
        !impactIds.has(cell.id) &&
        topologyReach.has(cell.id),
    )
    .sort(
      (first, second) =>
        (topologyReach.get(first.id)?.distance ?? Number.POSITIVE_INFINITY) -
          (topologyReach.get(second.id)?.distance ?? Number.POSITIVE_INFINITY) ||
        distanceSquaredToShape(first, shape) -
          distanceSquaredToShape(second, shape) ||
        first.id - second.id,
    )

  const impactById = new Map(impactCells.map((cell) => [cell.id, cell]))
  const frontierTransfers: Array<{
    sourceImpactCell: T
    targetCell: T
  }> = []
  for (const cell of frontierTargets) {
    if (damageTargets.length >= targetQuota || selectedIds.has(cell.id)) {
      continue
    }
    damageTargets.push(cell)
    selectedIds.add(cell.id)
    const sourceImpactCell = impactById.get(
      topologyReach.get(cell.id)?.sourceImpactCellId ?? -1,
    )
    if (sourceImpactCell) {
      frontierTransfers.push({ sourceImpactCell, targetCell: cell })
    }
  }

  return { impactCells, damageTargets, frontierTransfers }
}
