import type { WorldState } from '../runtime/worldState.ts'

export function runEnemySpatialIndexSystem(world: WorldState): void {
  world.enemySpatialHash.clear()
  world.activeEnemyCount = 0

  for (const enemy of world.enemies) {
    enemy.trackingLoad = 0

    if (enemy.phase === 'DEAD') {
      continue
    }

    world.enemySpatialHash.insert(enemy)
    if (enemy.phase === 'ACTIVE') {
      world.activeEnemyCount += 1
    }
  }
}
