import type { ProjectileState } from '../runtime/worldEntities.ts'

export interface SteeringTarget {
  readonly x: number
  readonly y: number
}

export function steerProjectileTowardTarget(
  projectile: ProjectileState,
  target: SteeringTarget,
  deltaMs: number,
): void {
  const deltaX = target.x - projectile.x
  const deltaY = target.y - projectile.y
  const distance = Math.hypot(deltaX, deltaY)
  const speed = Math.hypot(projectile.velocityX, projectile.velocityY)

  if (distance === 0 || speed === 0) {
    return
  }

  const desiredVelocityX = (deltaX / distance) * speed
  const desiredVelocityY = (deltaY / distance) * speed
  const steeringBlend = Math.min(
    1,
    projectile.homingResponsiveness * (deltaMs / 1_000),
  )
  const blendedVelocityX =
    projectile.velocityX +
    (desiredVelocityX - projectile.velocityX) * steeringBlend
  const blendedVelocityY =
    projectile.velocityY +
    (desiredVelocityY - projectile.velocityY) * steeringBlend
  const blendedSpeed = Math.hypot(blendedVelocityX, blendedVelocityY)

  if (blendedSpeed === 0) {
    return
  }

  projectile.velocityX = (blendedVelocityX / blendedSpeed) * speed
  projectile.velocityY = (blendedVelocityY / blendedSpeed) * speed
}
