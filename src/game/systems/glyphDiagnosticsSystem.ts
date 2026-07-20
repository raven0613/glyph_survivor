import { GLYPH_CELL_STATE } from '../glyph/glyphStore.ts'
import { GLYPH_STATUS_FLAG, hasGlyphStatus } from '../glyph/glyphStatus.ts'
import type { WorldState } from '../runtime/worldState.ts'

export function runGlyphDiagnosticsSystem(world: WorldState): void {
  let healthyGlyphCount = 0
  let damagedGlyphCount = 0
  let huskGlyphCount = 0
  let orphanedGlyphCount = 0
  let multiplyOwnedGlyphCount = 0
  let activeCrackedGlyphCount = 0
  let activeDisconnectedLatchedGlyphCount = 0
  world.glyphDiagnosticSeenIds.clear()

  for (const glyph of world.glyphStore.cells) {
    if (world.glyphDiagnosticSeenIds.has(glyph.id)) {
      multiplyOwnedGlyphCount += 1
    } else {
      world.glyphDiagnosticSeenIds.add(glyph.id)
    }
    if (!world.enemyById.has(glyph.ownerId)) {
      orphanedGlyphCount += 1
    }
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
    if (hasGlyphStatus(glyph, GLYPH_STATUS_FLAG.CRACKED)) {
      activeCrackedGlyphCount += 1
    }
    if (
      hasGlyphStatus(glyph, GLYPH_STATUS_FLAG.DISCONNECTED_LATCHED)
    ) {
      activeDisconnectedLatchedGlyphCount += 1
    }
  }

  world.diagnostics.healthyGlyphCount = healthyGlyphCount
  world.diagnostics.damagedGlyphCount = damagedGlyphCount
  world.diagnostics.huskGlyphCount = huskGlyphCount
  world.diagnostics.orphanedGlyphCount = orphanedGlyphCount
  world.diagnostics.multiplyOwnedGlyphCount = multiplyOwnedGlyphCount
  world.diagnostics.activeCrackedGlyphCount = activeCrackedGlyphCount
  world.diagnostics.activeDisconnectedLatchedGlyphCount =
    activeDisconnectedLatchedGlyphCount
}
