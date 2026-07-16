import type { GlyphCell, OwnerDurability } from './glyphCell.ts'

interface GlyphOwnerRemovalState<
  TCell extends GlyphCell,
  TDurability extends OwnerDurability,
> {
  readonly cells: TCell[]
  readonly recycledCells: TCell[]
  readonly recycledOwnerCells: TCell[][]
  readonly cellById: Map<number, TCell>
  readonly cellIndexById: Map<number, number>
  readonly cellsByOwner: Map<number, TCell[]>
  readonly durabilityByOwner: Map<number, TDurability>
}

export function removeGlyphOwner<
  TCell extends GlyphCell,
  TDurability extends OwnerDurability,
>(
  ownerId: number,
  state: GlyphOwnerRemovalState<TCell, TDurability>,
): void {
  const ownerCells = state.cellsByOwner.get(ownerId)
  if (!ownerCells) {
    return
  }

  for (const cell of ownerCells) {
    const cellIndex = state.cellIndexById.get(cell.id)
    if (cellIndex === undefined || state.cellById.get(cell.id) !== cell) {
      throw new Error(`Glyph ${cell.id} is missing from its owned store.`)
    }
    const lastCell = state.cells.pop()
    if (!lastCell) {
      throw new Error('Glyph Store active cell index is inconsistent.')
    }
    if (cellIndex < state.cells.length) {
      state.cells[cellIndex] = lastCell
      state.cellIndexById.set(lastCell.id, cellIndex)
    }
    state.cellById.delete(cell.id)
    state.cellIndexById.delete(cell.id)
    state.recycledCells.push(cell)
  }

  state.cellsByOwner.delete(ownerId)
  ownerCells.length = 0
  state.recycledOwnerCells.push(ownerCells)
  state.durabilityByOwner.delete(ownerId)
}
