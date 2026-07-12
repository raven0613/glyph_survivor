import type { WorldState } from '../runtime/worldState.ts'

function removeAtSwap<T>(items: T[], index: number): T {
  const removed = items[index]
  const last = items.pop()

  if (last && index < items.length) {
    items[index] = last
  }

  return removed
}

export function runCleanupSystem(world: WorldState): void {
  for (let index = world.projectiles.length - 1; index >= 0; index -= 1) {
    if (!world.projectiles[index].isAlive) {
      world.projectilePool.push(removeAtSwap(world.projectiles, index))
    }
  }

  for (let index = world.drops.length - 1; index >= 0; index -= 1) {
    if (!world.drops[index].isAlive) {
      world.dropPool.push(removeAtSwap(world.drops, index))
    }
  }

  for (let index = world.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = world.enemies[index]

    if (enemy.phase === 'DEAD' && enemy.rewardCommitted) {
      world.enemyById.delete(enemy.id)
      world.glyphStore.removeOwner(enemy.id)
      world.enemyPool.push(removeAtSwap(world.enemies, index))
    }
  }
}
