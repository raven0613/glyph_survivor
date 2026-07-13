import {
  GLYPH_CELL_STATE,
  type GlyphCellState,
} from '../glyph/glyphStore.ts'
import {
  DAMAGE_TARGET_MODE,
  type DamageTargetMode,
} from '../glyph/localDamage.ts'

export { DAMAGE_TARGET_MODE } from '../glyph/localDamage.ts'
export type { DamageTargetMode } from '../glyph/localDamage.ts'

export interface CircleDamageShape {
  readonly kind: 'CIRCLE'
  readonly x: number
  readonly y: number
  readonly radius: number
}

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
  shape: CircleDamageShape,
): number {
  return (cell.worldX - shape.x) ** 2 + (cell.worldY - shape.y) ** 2
}

function intersectsCircle(
  cell: DamageSelectionCell,
  shape: CircleDamageShape,
): boolean {
  const combinedRadius = cell.collisionRadius + shape.radius
  return distanceSquaredToShape(cell, shape) <= combinedRadius ** 2
}

function findTopologyDistances<T extends DamageSelectionCell>(
  cells: readonly T[],
  impactCells: readonly T[],
): ReadonlyMap<number, number> {
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

  const distanceById = new Map<number, number>()
  const queue = [...impactCells]
  for (const cell of impactCells) {
    distanceById.set(cell.id, 0)
  }

  for (let index = 0; index < queue.length; index += 1) {
    const cell = queue[index]
    const nextDistance = (distanceById.get(cell.id) ?? 0) + 1
    for (const [offsetX, offsetY] of NEIGHBOR_OFFSETS) {
      const neighbors = cellsByCoordinate.get(
        `${cell.topologyX + offsetX},${cell.topologyY + offsetY}`,
      )
      if (!neighbors) {
        continue
      }
      for (const neighbor of neighbors) {
        if (distanceById.has(neighbor.id)) {
          continue
        }
        distanceById.set(neighbor.id, nextDistance)
        queue.push(neighbor)
      }
    }
  }

  return distanceById
}

/** Separates local outline impacts from deterministic living durability targets. */
export function selectGlyphDamage<T extends DamageSelectionCell>(
  cells: readonly T[],
  shape: CircleDamageShape,
  targetMode: DamageTargetMode,
): GlyphDamageSelection<T> {
  const impactCells = cells
    .filter((cell) => intersectsCircle(cell, shape))
    .sort(
      (first, second) =>
        distanceSquaredToShape(first, shape) -
          distanceSquaredToShape(second, shape) || first.id - second.id,
    )
  if (impactCells.length === 0) {
    return { impactCells, damageTargets: [] }
  }

  const targetQuota =
    targetMode === DAMAGE_TARGET_MODE.SINGLE ? 1 : impactCells.length
  const damageTargets = impactCells.filter(isLiving).slice(0, targetQuota)
  if (damageTargets.length === targetQuota) {
    return { impactCells, damageTargets }
  }

  const selectedIds = new Set(damageTargets.map((cell) => cell.id))
  const impactIds = new Set(impactCells.map((cell) => cell.id))
  const topologyDistances = findTopologyDistances(cells, impactCells)
  const frontierTargets = cells
    .filter(
      (cell) =>
        isLiving(cell) &&
        !impactIds.has(cell.id) &&
        topologyDistances.has(cell.id),
    )
    .sort(
      (first, second) =>
        (topologyDistances.get(first.id) ?? Number.POSITIVE_INFINITY) -
          (topologyDistances.get(second.id) ?? Number.POSITIVE_INFINITY) ||
        distanceSquaredToShape(first, shape) -
          distanceSquaredToShape(second, shape) ||
        first.id - second.id,
    )

  for (const cell of frontierTargets) {
    if (damageTargets.length >= targetQuota || selectedIds.has(cell.id)) {
      continue
    }
    damageTargets.push(cell)
    selectedIds.add(cell.id)
  }

  return { impactCells, damageTargets }
}
