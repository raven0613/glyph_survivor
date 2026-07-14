import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import {
  spawnExperienceDrop,
  type WorldState,
} from '../runtime/worldState.ts'
import { circlesIntersect } from './combatGeometry.ts'
import { getCreatureDefinition } from '../content/gameContent.ts'

export function runDropSystem(world: WorldState): void {
  for (const enemy of world.enemies) {
    if (
      enemy.phase === 'DEAD' &&
      enemy.rewardEligible &&
      !enemy.rewardCommitted
    ) {
      spawnExperienceDrop(
        world,
        enemy.x,
        enemy.y,
        getCreatureDefinition(world.content, enemy.definitionId).experienceReward,
      )
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
      world.collectedXpThisStep += drop.value
    }
  }
}
