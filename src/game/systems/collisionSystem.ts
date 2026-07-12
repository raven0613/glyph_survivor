import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { circlesIntersect } from './combatGeometry.ts'

export function runCollisionSystem(world: WorldState): void {
  for (const projectile of world.projectiles) {
    if (!projectile.isAlive) {
      continue
    }

    const candidates = world.enemySpatialHash.queryCircle(
      projectile.x,
      projectile.y,
      projectile.radius + GAME_CONFIG.enemyRadius,
      world.collisionCandidates,
    )

    for (const enemy of candidates) {
      if (
        enemy.phase !== 'ACTIVE' ||
        !circlesIntersect(
          projectile.x,
          projectile.y,
          projectile.radius,
          enemy.x,
          enemy.y,
          enemy.radius,
        )
      ) {
        continue
      }

      enemy.hp -= projectile.damage
      projectile.isAlive = false

      if (enemy.hp <= 0) {
        enemy.phase = 'DEAD'
      }
      break
    }
  }
}
