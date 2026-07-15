import type { WorldState } from '../runtime/worldState.ts'

export function hasCreatureFinishedReassembling(
  world: WorldState,
  ownerId: number,
): boolean {
  for (const glyph of world.glyphStore.getOwnerGlyphs(ownerId)) {
    if (
      Math.hypot(glyph.offsetX, glyph.offsetY) > 1 ||
      Math.hypot(glyph.velocityX, glyph.velocityY) > 5
    ) {
      return false
    }
  }
  return true
}
