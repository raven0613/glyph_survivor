import type {
  ProjectileTrackingMode,
  ProjectileTrackingState,
} from '../content/weapons/projectileTracking.ts'
import type { EnemyPhase } from '../runtime/worldEntities.ts'

export interface TrackingProjectile {
  readonly trackingMode: ProjectileTrackingMode
  readonly x: number
  readonly y: number
  readonly velocityX: number
  readonly velocityY: number
  readonly launchDirectionX: number
  readonly launchDirectionY: number
  readonly trackingRange: number
  readonly maximumCorrectionCos: number
}

export interface TrackingTarget {
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly phase: EnemyPhase
}

export function getStateAfterTargetLoss(
  trackingMode: ProjectileTrackingMode,
): ProjectileTrackingState {
  return trackingMode === 'ASSISTED' ? 'BALLISTIC' : 'SEEKING'
}

export function canMaintainTargetLock(
  projectile: TrackingProjectile,
  target: TrackingTarget,
): boolean {
  if (target.phase !== 'ACTIVE') {
    return false
  }

  const deltaX = target.x - projectile.x
  const deltaY = target.y - projectile.y
  const distanceSquared = deltaX * deltaX + deltaY * deltaY

  if (distanceSquared > projectile.trackingRange * projectile.trackingRange) {
    return false
  }

  if (projectile.trackingMode === 'HOMING' || distanceSquared <= target.radius ** 2) {
    return true
  }

  if (projectile.velocityX * deltaX + projectile.velocityY * deltaY <= 0) {
    return false
  }

  const inverseDistance = 1 / Math.sqrt(distanceSquared)
  const launchDirectionCos =
    (projectile.launchDirectionX * deltaX +
      projectile.launchDirectionY * deltaY) *
    inverseDistance

  return launchDirectionCos >= projectile.maximumCorrectionCos
}
