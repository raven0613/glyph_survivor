import type { ResolvedWeaponProfile } from '../systems/resolveWeaponProfile.ts'
import { TARGET_STRATEGY } from '../content/weapons/weaponDefinition.ts'
import type { ProjectileState } from './worldEntities.ts'
import { getNextEntityId, type WorldState } from './worldState.ts'
import { getPlayerAttackAppearance } from '../content/visuals/combatVisualTheme.ts'

export interface SpawnProjectileInput {
  readonly sourceWeaponInstanceId: number
  readonly x: number
  readonly y: number
  readonly directionX: number
  readonly directionY: number
  readonly profile: ResolvedWeaponProfile
  readonly targetEnemyId: number | null
  readonly targetAnchorId?: string | null
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
  const appearance = getPlayerAttackAppearance(
    world.content.combatVisualTheme,
    presentation.visualRoleId,
  )
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
    damageSpreadProfile: input.profile.damageSpreadProfile,
    damageShapeKind: input.profile.damageShape.kind,
    damageTargetMode: input.profile.damageShape.targetMode,
    destructionProfileId: input.profile.destructionProfileId,
    remainingTravelDistance: attackPattern.maximumTravelDistance,
    rangeExhausted: false,
    isAlive: true,
    trackingMode: trackingProfile.mode,
    trackingState:
      input.targetEnemyId !== null
        ? ('LOCKED' as const)
        : trackingProfile.mode === 'ASSISTED'
          ? ('BALLISTIC' as const)
          : ('SEEKING' as const),
    targetEnemyId: input.targetEnemyId,
    targetAnchorId: input.targetAnchorId ?? null,
    launchDirectionX: input.directionX,
    launchDirectionY: input.directionY,
    trackingRange: trackingProfile.range,
    homingResponsiveness: trackingProfile.responsiveness,
    maximumCorrectionCos: trackingProfile.maximumCorrectionCos,
    retargetIntervalMs: trackingProfile.retargetIntervalMs,
    nextTargetSearchTimeMs: world.runTimeMs,
    glyphFrame: presentation.glyphFrame,
    visualRoleId: presentation.visualRoleId,
    visualScale: presentation.scale,
    visualAlpha: appearance.core.alpha,
    visualTint: appearance.core.tint,
  })
  world.projectiles.push(activeProjectile)
  world.diagnostics.attackEmissionCount += 1
  return activeProjectile
}
