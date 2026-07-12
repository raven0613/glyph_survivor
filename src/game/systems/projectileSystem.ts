import type { WorldState } from '../runtime/worldState.ts'

export function runProjectileSystem(world: WorldState, deltaMs: number): void {
  const deltaSeconds = deltaMs / 1_000

  for (const projectile of world.projectiles) {
    if (!projectile.isAlive) {
      continue
    }

    projectile.previousX = projectile.x
    projectile.previousY = projectile.y
    projectile.x += projectile.velocityX * deltaSeconds
    projectile.y += projectile.velocityY * deltaSeconds
    projectile.lifetimeMs -= deltaMs

    if (projectile.lifetimeMs <= 0) {
      projectile.isAlive = false
    }
  }
}
