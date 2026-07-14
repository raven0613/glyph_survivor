import type { WorldState } from '../runtime/worldState.ts'

export function runProjectileSystem(world: WorldState, deltaMs: number): void {
  const deltaSeconds = deltaMs / 1_000

  for (const projectile of world.projectiles) {
    if (!projectile.isAlive) {
      continue
    }

    projectile.previousX = projectile.x
    projectile.previousY = projectile.y
    const stepX = projectile.velocityX * deltaSeconds
    const stepY = projectile.velocityY * deltaSeconds
    const requestedDistance = Math.hypot(stepX, stepY)
    const travelledDistance = Math.min(
      requestedDistance,
      projectile.remainingTravelDistance,
    )
    const movementScale =
      requestedDistance > 0 ? travelledDistance / requestedDistance : 0

    projectile.x += stepX * movementScale
    projectile.y += stepY * movementScale
    projectile.remainingTravelDistance = Math.max(
      0,
      projectile.remainingTravelDistance - travelledDistance,
    )
    projectile.rangeExhausted = projectile.remainingTravelDistance === 0
  }
}
