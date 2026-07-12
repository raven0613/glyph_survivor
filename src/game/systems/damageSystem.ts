import type { WorldState } from '../runtime/worldState.ts'
import { GLYPH_CELL_STATE } from '../glyph/glyphStore.ts'
import {
  getGlyphDurabilityTint,
  getGlyphMaterialDefinition,
} from '../glyph/glyphMaterial.ts'

export function runDamageSystem(world: WorldState): void {
  world.glyphDamageQueue.drain((event) => {
    const glyph = world.glyphStore.getById(event.glyphId)
    if (!glyph) {
      return
    }

    const appliedDamage = world.glyphStore.applyDamage(
      event.glyphId,
      event.amount,
    )
    if (appliedDamage === 0 || glyph.state === GLYPH_CELL_STATE.DESTROYED) {
      return
    }

    const material = getGlyphMaterialDefinition(glyph.material)
    world.glyphStore.applyMaterialHit(
      glyph.id,
      event.impactDirectionX,
      event.impactDirectionY,
      material,
      getGlyphDurabilityTint(material, glyph.currentDurability),
    )
  })
}
