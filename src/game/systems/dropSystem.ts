import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import {
  spawnExperienceDrop,
  type WorldState,
} from '../runtime/worldState.ts'
import { circlesIntersect } from './combatGeometry.ts'

export function runDropSystem(world: WorldState): void {
  for (const enemy of world.enemies) {
    if (enemy.phase === 'DEAD' && !enemy.rewardCommitted) {
      spawnExperienceDrop(world, enemy.x, enemy.y)
      enemy.rewardCommitted = true
    }
  }

  for (const drop of world.drops) {
    if (
      drop.isAlive &&
      circlesIntersect(
        world.player.x,
        world.player.y,
        GAME_CONFIG.pickupRadius,
        drop.x,
        drop.y,
        8,
      )
    ) {
      drop.isAlive = false
      world.player.xp += drop.value
    }
  }
}
