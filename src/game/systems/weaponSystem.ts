import { spawnProjectile } from '../runtime/spawnProjectile.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { selectBestProjectileTarget } from './targetSelection.ts'
import {
  TARGET_STRATEGY,
} from '../content/weapons/weaponDefinition.ts'
import { LOCAL_DAMAGE_SHAPE } from '../glyph/localDamage.ts'
import { spawnFlameEmitter } from '../runtime/spawnFlameEmitter.ts'
import type { ResolvedConeWeaponProfile } from './resolveWeaponProfile.ts'

function emitConeAttack(
  world: WorldState,
  weaponId: number,
  attackSequence: number,
  profile: ResolvedConeWeaponProfile,
): void {
  const { player } = world
  const originX = player.x + player.aimX * profile.attackPattern.muzzleDistance
  const originY = player.y + player.aimY * profile.attackPattern.muzzleDistance
  const candidates = world.enemySpatialHash.queryCircle(
    originX,
    originY,
    profile.damageShape.range + world.maximumEnemyQueryRadius,
    world.targetCandidates,
  )
  for (const enemy of candidates) {
    world.glyphDamageQueue.enqueue({
      ownerId: enemy.id,
      shapeKind: LOCAL_DAMAGE_SHAPE.CONE,
      shapeX: originX,
      shapeY: originY,
      shapeRadius: 0,
      shapeDirectionX: player.aimX,
      shapeDirectionY: player.aimY,
      shapeRange: profile.damageShape.range,
      shapeHalfAngleRadians: profile.damageShape.fullAngleRadians / 2,
      targetMode: profile.damageShape.targetMode,
      amount: profile.damageAmount,
      impactStrengthMultiplier: profile.impactStrengthMultiplier,
      impactDirectionX: player.aimX,
      impactDirectionY: player.aimY,
    })
  }
  spawnFlameEmitter(
    world,
    weaponId,
    attackSequence,
    originX,
    originY,
    player.aimX,
    player.aimY,
    profile,
  )
}

export function runWeaponSystem(world: WorldState, deltaMs: number): void {
  for (const weapon of world.weaponLoadout.equipped) {
    const profile = weapon.resolvedProfile
    if (profile.targetStrategyId === TARGET_STRATEGY.OWNER_RELATIVE) {
      continue
    }
    weapon.cooldownRemainingMs -= deltaMs

    if (weapon.cooldownRemainingMs > 0) {
      continue
    }

    const player = world.player
    weapon.cooldownRemainingMs += profile.fireIntervalMs
    if (profile.targetStrategyId === TARGET_STRATEGY.PLAYER_AIM) {
      emitConeAttack(world, weapon.id, weapon.attackSequence, profile)
      weapon.attackSequence += 1
      continue
    }
    const trackingProfile = profile.trackingProfile
    const attackPattern = profile.attackPattern
    const candidates = world.enemySpatialHash.queryCircle(
      player.x,
      player.y,
      trackingProfile.range,
      world.targetCandidates,
    )
    const target = selectBestProjectileTarget(
      candidates,
      player.x,
      player.y,
      player.aimX,
      player.aimY,
      trackingProfile.range,
      trackingProfile.maximumCorrectionCos,
    )
    world.diagnostics.targetSearchCount += 1

    if (target) {
      target.trackingLoad += 1
    }

    spawnProjectile(world, {
      sourceWeaponInstanceId: weapon.id,
      x: player.x + player.aimX * attackPattern.muzzleDistance,
      y: player.y + player.aimY * attackPattern.muzzleDistance,
      directionX: player.aimX,
      directionY: player.aimY,
      profile,
      targetEnemyId: target?.id ?? null,
    })
    weapon.attackSequence += 1
  }
}
