import type { ResolvedWeaponProfile } from '../systems/resolveWeaponProfile.ts'
import { TARGET_STRATEGY } from '../content/weapons/weaponDefinition.ts'
import type { ProjectileState } from './worldEntities.ts'
import { getNextEntityId, type WorldState } from './worldState.ts'

export interface SpawnProjectileInput {
  readonly sourceWeaponInstanceId: number
  readonly x: number
  readonly y: number
  readonly directionX: number
  readonly directionY: number
  readonly profile: ResolvedWeaponProfile
  readonly targetEnemyId: number | null
}

/** Copies all weapon-owned values needed by one independent projectile. */
export function spawnProjectile(
  world: WorldState,
  input: Readonly<SpawnProjectileInput>,
): ProjectileState {
  if (input.profile.targetStrategyId !== TARGET_STRATEGY.AIM_ASSISTED) {
    throw new TypeError('spawnProjectile requires a projectile weapon profile.')
  }
  const projectile = world.projectilePool.pop()

  if (!projectile) {
    world.diagnostics.projectilePoolMisses += 1
  }

  const attackPattern = input.profile.attackPattern
  const trackingProfile = input.profile.trackingProfile
  const presentation = input.profile.projectilePresentation
  const activeProjectile = projectile ?? ({} as ProjectileState)
  Object.assign(activeProjectile, {
    id: getNextEntityId(world),
    sourceWeaponInstanceId: input.sourceWeaponInstanceId,
    x: input.x,
    y: input.y,
    previousX: input.x,
    previousY: input.y,
    velocityX: input.directionX * attackPattern.projectileSpeed,
    velocityY: input.directionY * attackPattern.projectileSpeed,
    radius: input.profile.damageShape.radius,
    damage: input.profile.damageAmount,
    impactStrengthMultiplier: input.profile.impactStrengthMultiplier,
    damageShapeKind: input.profile.damageShape.kind,
    damageTargetMode: input.profile.damageShape.targetMode,
    destructionProfileId: input.profile.destructionProfileId,
    lifetimeMs: attackPattern.projectileLifetimeMs,
    isAlive: true,
    trackingMode: trackingProfile.mode,
    trackingState:
      input.targetEnemyId !== null
        ? ('LOCKED' as const)
        : trackingProfile.mode === 'ASSISTED'
          ? ('BALLISTIC' as const)
          : ('SEEKING' as const),
    targetEnemyId: input.targetEnemyId,
    launchDirectionX: input.directionX,
    launchDirectionY: input.directionY,
    trackingRange: trackingProfile.range,
    homingResponsiveness: trackingProfile.responsiveness,
    maximumCorrectionCos: trackingProfile.maximumCorrectionCos,
    retargetIntervalMs: trackingProfile.retargetIntervalMs,
    nextTargetSearchTimeMs: world.runTimeMs,
    glyphFrame: presentation.glyphFrame,
    visualScale: presentation.scale,
    visualAlpha: presentation.alpha,
    visualTint: presentation.tint,
  })
  world.projectiles.push(activeProjectile)
  return activeProjectile
}
