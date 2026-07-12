import type { WorldState } from '../runtime/worldState.ts'

export function runDeathSystem(world: WorldState): void {
  for (const enemy of world.enemies) {
    if (
      enemy.phase !== 'DEAD' &&
      world.glyphStore.isOwnerDestroyed(enemy.id)
    ) {
      enemy.phase = 'DEAD'
    }
  }
}
