import {
  GLYPH_CELL_STATE,
  isGlyphLivingState,
  type GlyphCellState,
} from '../glyph/glyphStore.ts'

const SLIME_LAYOUT_SPACING = 18
const SLIME_LAYOUT_ASPECT_RATIO = 1.8

export interface SlimeTopologyCell {
  readonly id: number
  readonly state: GlyphCellState
  readonly topologyX: number
  readonly topologyY: number
}

export interface CompiledSlimeAnchor {
  readonly glyphId: number
  readonly topologyX: number
  readonly topologyY: number
  readonly localX: number
  readonly localY: number
  readonly isEye: boolean
}

export interface CompiledSlimeBodyLayout {
  readonly anchors: readonly CompiledSlimeAnchor[]
}

function compareCanonicalCells(
  first: SlimeTopologyCell,
  second: SlimeTopologyCell,
): number {
  return (
    first.topologyY - second.topologyY ||
    first.topologyX - second.topologyX ||
    first.id - second.id
  )
}

export function findLivingConnectedComponents<T extends SlimeTopologyCell>(
  cells: readonly T[],
): T[][] {
  const livingByCoordinate = new Map<string, T>()
  for (const cell of cells) {
    if (isGlyphLivingState(cell.state)) {
      livingByCoordinate.set(`${cell.topologyX},${cell.topologyY}`, cell)
    }
  }

  const visited = new Set<number>()
  const components: T[][] = []
  const orderedCells = [...livingByCoordinate.values()].sort(compareCanonicalCells)
  const neighborOffsets = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const

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
      for (const [offsetX, offsetY] of neighborOffsets) {
        const neighbor = livingByCoordinate.get(
          `${cell.topologyX + offsetX},${cell.topologyY + offsetY}`,
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

  return components.sort(
    (first, second) => first[0].id - second[0].id,
  )
}

interface LayoutCoordinate {
  readonly x: number
  readonly y: number
  readonly score: number
}

function createCompactCoordinates(count: number): LayoutCoordinate[] {
  const extent = Math.max(2, Math.ceil(Math.sqrt(count) * 2))
  const candidates: LayoutCoordinate[] = []
  for (let y = -extent; y <= extent; y += 1) {
    for (let x = -extent; x <= extent; x += 1) {
      candidates.push({
        x,
        y,
        score: (x / SLIME_LAYOUT_ASPECT_RATIO) ** 2 + y ** 2,
      })
    }
  }

  return candidates
    .sort(
      (first, second) =>
        first.score - second.score ||
        first.y - second.y ||
        first.x - second.x,
    )
    .slice(0, count)
}

function selectEyeIds(
  anchors: readonly Omit<CompiledSlimeAnchor, 'isEye'>[],
  cellsById: ReadonlyMap<number, SlimeTopologyCell>,
  eyeEligibleGlyphIds?: ReadonlySet<number>,
): ReadonlySet<number> {
  const livingAnchors = anchors.filter(
    (anchor) =>
      isGlyphLivingState(cellsById.get(anchor.glyphId)!.state) &&
      (eyeEligibleGlyphIds === undefined ||
        eyeEligibleGlyphIds.has(anchor.glyphId)),
  )
  if (livingAnchors.length === 0) {
    return new Set()
  }

  const minimumX = Math.min(...anchors.map((anchor) => anchor.localX))
  const maximumX = Math.max(...anchors.map((anchor) => anchor.localX))
  const minimumY = Math.min(...anchors.map((anchor) => anchor.localY))
  const maximumY = Math.max(...anchors.map((anchor) => anchor.localY))
  const centerX = (minimumX + maximumX) / 2
  const faceY = minimumY + (maximumY - minimumY) * 0.4
  const eyeOffset = (maximumX - minimumX) * 0.2
  const selected = new Set<number>()

  for (const targetX of [centerX - eyeOffset, centerX + eyeOffset]) {
    const candidate = livingAnchors
      .filter((anchor) => !selected.has(anchor.glyphId))
      .sort((first, second) => {
        const firstDistance =
          (first.localX - targetX) ** 2 + (first.localY - faceY) ** 2
        const secondDistance =
          (second.localX - targetX) ** 2 + (second.localY - faceY) ** 2
        return firstDistance - secondDistance || first.glyphId - second.glyphId
      })[0]
    if (candidate) {
      selected.add(candidate.glyphId)
    }
  }
  return selected
}

export function compileSlimeBodyLayout(
  cells: readonly SlimeTopologyCell[],
  eyeEligibleGlyphIds?: ReadonlySet<number>,
): CompiledSlimeBodyLayout {
  if (cells.length === 0) {
    return Object.freeze({ anchors: Object.freeze([]) })
  }

  const orderedLivingCells = cells
    .filter((cell) => isGlyphLivingState(cell.state))
    .sort(compareCanonicalCells)
  const orderedHuskCells = cells
    .filter((cell) => cell.state === GLYPH_CELL_STATE.HUSK)
    .sort(compareCanonicalCells)
  const coordinates = createCompactCoordinates(cells.length)
  const livingCoordinates = coordinates
    .slice(0, orderedLivingCells.length)
    .sort((first, second) => first.y - second.y || first.x - second.x)
  const huskCoordinates = coordinates
    .slice(orderedLivingCells.length)
    .sort((first, second) => first.y - second.y || first.x - second.x)
  const cellsById = new Map(cells.map((cell) => [cell.id, cell]))
  const createAnchor = (
    cell: SlimeTopologyCell,
    coordinate: LayoutCoordinate,
  ) => ({
    glyphId: cell.id,
    topologyX: coordinate.x,
    topologyY: coordinate.y,
    localX: coordinate.x * SLIME_LAYOUT_SPACING,
    localY: coordinate.y * SLIME_LAYOUT_SPACING,
  })
  const anchorsWithoutEyes = [
    ...orderedLivingCells.map((cell, index) =>
      createAnchor(cell, livingCoordinates[index]),
    ),
    ...orderedHuskCells.map((cell, index) =>
      createAnchor(cell, huskCoordinates[index]),
    ),
  ]
  const eyeIds = selectEyeIds(
    anchorsWithoutEyes,
    cellsById,
    eyeEligibleGlyphIds,
  )

  return Object.freeze({
    anchors: Object.freeze(
      anchorsWithoutEyes.map((anchor) =>
        Object.freeze({ ...anchor, isEye: eyeIds.has(anchor.glyphId) }),
      ),
    ),
  })
}
