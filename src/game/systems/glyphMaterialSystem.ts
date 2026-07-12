import { getGlyphMaterialDefinition } from '../glyph/glyphMaterial.ts'
import { GLYPH_CELL_STATE } from '../glyph/glyphStore.ts'
import type { WorldState } from '../runtime/worldState.ts'

export function runGlyphMaterialSystem(
  world: WorldState,
  deltaMs: number,
): void {
  for (const glyph of world.glyphStore.cells) {
    if (glyph.state === GLYPH_CELL_STATE.ALIVE) {
      world.glyphStore.stepMaterial(
        glyph.id,
        deltaMs,
        getGlyphMaterialDefinition(glyph.material),
      )
    }
  }
}
