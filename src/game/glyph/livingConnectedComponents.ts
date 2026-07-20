import { isGlyphLivingState, type GlyphCellState } from './glyphCell.ts'
import { DEFAULT_GLYPH_TOPOLOGY_COMPONENT_ID } from './glyphLayout.ts'

export interface LivingTopologyCell {
  readonly id: number
  readonly topologyComponentId?: string
  readonly state: GlyphCellState
  readonly topologyX: number
  readonly topologyY: number
}

const NEIGHBOR_OFFSETS = Object.freeze([
  Object.freeze([0, -1] as const),
  Object.freeze([1, 0] as const),
  Object.freeze([0, 1] as const),
  Object.freeze([-1, 0] as const),
])

function compareCanonicalCells(
  first: LivingTopologyCell,
  second: LivingTopologyCell,
): number {
  return (
    (first.topologyComponentId ?? DEFAULT_GLYPH_TOPOLOGY_COMPONENT_ID).localeCompare(
      second.topologyComponentId ?? DEFAULT_GLYPH_TOPOLOGY_COMPONENT_ID,
    ) ||
    first.topologyY - second.topologyY ||
    first.topologyX - second.topologyX ||
    first.id - second.id
  )
}

export function findLivingConnectedComponents<T extends LivingTopologyCell>(
  cells: readonly T[],
): T[][] {
  const livingByCoordinate = new Map<string, T>()
  for (const cell of cells) {
    if (isGlyphLivingState(cell.state)) {
      livingByCoordinate.set(
        `${cell.topologyComponentId ?? DEFAULT_GLYPH_TOPOLOGY_COMPONENT_ID}:${cell.topologyX},${cell.topologyY}`,
        cell,
      )
    }
  }
  const visited = new Set<number>()
  const components: T[][] = []
  const orderedCells = [...livingByCoordinate.values()].sort(
    compareCanonicalCells,
  )
  for (const start of orderedCells) {
    if (visited.has(start.id)) {
      continue
    }
    const component: T[] = []
    const queue = [start]
    visited.add(start.id)
    for (let index = 0; index < queue.length; index += 1) {
      const cell = queue[index]
      component.push(cell)
      for (const [offsetX, offsetY] of NEIGHBOR_OFFSETS) {
        const neighbor = livingByCoordinate.get(
          `${cell.topologyComponentId ?? DEFAULT_GLYPH_TOPOLOGY_COMPONENT_ID}:${cell.topologyX + offsetX},${cell.topologyY + offsetY}`,
        )
        if (neighbor && !visited.has(neighbor.id)) {
          visited.add(neighbor.id)
          queue.push(neighbor)
        }
      }
    }
    component.sort(compareCanonicalCells)
    components.push(component)
  }
  return components.sort((first, second) => first[0].id - second[0].id)
}
