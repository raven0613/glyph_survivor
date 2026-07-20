import type { WorldState } from '../runtime/worldState.ts'
import { HOSTILE_PROJECTILE_PHASE } from '../runtime/hostileProjectileState.ts'
import { removeCreatureCollapsePresentation } from './creatureCollapseSystem.ts'

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

  for (
    let index = world.hostileProjectiles.length - 1;
    index >= 0;
    index -= 1
  ) {
    if (
      world.hostileProjectiles[index].phase === HOSTILE_PROJECTILE_PHASE.SPENT
    ) {
      world.hostileProjectilePool.push(
        removeAtSwap(world.hostileProjectiles, index),
      )
      world.diagnostics.hostileProjectilesReturnedToPool += 1
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
      if (enemy.rootBossId === enemy.id && enemy.encounterId !== null) {
        world.bossEncounters.delete(enemy.encounterId)
      }
      world.enemyById.delete(enemy.id)
      removeCreatureCollapsePresentation(world, enemy.id)
      world.glyphStore.removeOwner(enemy.id)
      world.enemyPool.push(removeAtSwap(world.enemies, index))
    }
  }
}
