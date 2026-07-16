import type { WorldState } from '../runtime/worldState.ts'
import { isEnemyCombatPhase } from '../runtime/worldEntities.ts'
import { getCreatureDefinition } from '../content/gameContent.ts'

function updateEnemyRadius(world: WorldState, enemyId: number): number {
  const enemy = world.enemyById.get(enemyId)
  if (!enemy) {
    return 0
  }
  if (enemy.phase !== 'REASSEMBLING') {
    return getCreatureDefinition(world.content, enemy.definitionId)
      .broadPhaseRadius
  }

  let radius = 0
  for (const glyph of world.glyphStore.getOwnerGlyphs(enemy.id)) {
    radius = Math.max(
      radius,
      Math.hypot(
        glyph.localX + glyph.offsetX,
        glyph.localY + glyph.offsetY,
      ) + glyph.collisionRadius,
    )
  }
  return radius
}

export function runEnemySpatialIndexSystem(world: WorldState): void {
  world.enemySpatialHash.clear()
  world.activeEnemyCount = 0
  world.maximumEnemyQueryRadius =
    world.content.maximumEnemyBroadPhaseRadius
  world.maximumEnemyStepDistance = 0

  for (const enemy of world.enemies) {
    enemy.trackingLoad = 0

    if (enemy.phase === 'DEAD' || enemy.phase === 'COLLAPSING') {
      continue
    }

    enemy.radius = updateEnemyRadius(world, enemy.id)
    world.maximumEnemyStepDistance = Math.max(
      world.maximumEnemyStepDistance,
      Math.hypot(enemy.x - enemy.previousX, enemy.y - enemy.previousY),
    )
    world.maximumEnemyQueryRadius = Math.max(
      world.maximumEnemyQueryRadius,
      enemy.radius,
    )
    world.enemySpatialHash.insert(enemy)
    if (isEnemyCombatPhase(enemy.phase)) {
      world.activeEnemyCount += 1
    }
  }
}
