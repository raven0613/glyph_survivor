import { GLYPH_CELL_STATE } from '../glyph/glyphStore.ts'
import type { WorldState } from '../runtime/worldState.ts'

export function runGlyphDiagnosticsSystem(world: WorldState): void {
  let healthyGlyphCount = 0
  let damagedGlyphCount = 0
  let huskGlyphCount = 0

  for (const glyph of world.glyphStore.cells) {
    switch (glyph.state) {
      case GLYPH_CELL_STATE.HEALTHY:
        healthyGlyphCount += 1
        break
      case GLYPH_CELL_STATE.DAMAGED:
        damagedGlyphCount += 1
        break
      case GLYPH_CELL_STATE.HUSK:
        huskGlyphCount += 1
        break
    }
  }

  world.diagnostics.healthyGlyphCount = healthyGlyphCount
  world.diagnostics.damagedGlyphCount = damagedGlyphCount
  world.diagnostics.huskGlyphCount = huskGlyphCount
}
