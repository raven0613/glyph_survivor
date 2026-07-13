import { getGlyphMaterialDefinition } from '../glyph/glyphMaterial.ts'
import type { WorldState } from '../runtime/worldState.ts'

export function runGlyphMaterialSystem(
  world: WorldState,
  deltaMs: number,
): void {
  for (const glyph of world.glyphStore.cells) {
    const ownerPhase = world.enemyById.get(glyph.ownerId)?.phase
    if (ownerPhase === 'COLLAPSING' || ownerPhase === 'DEAD') {
      continue
    }
    world.glyphStore.stepMaterial(
      glyph.id,
      deltaMs,
      getGlyphMaterialDefinition(glyph.material),
      ownerPhase === 'REASSEMBLING',
    )
  }
}
