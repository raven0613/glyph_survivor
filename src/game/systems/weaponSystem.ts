import { spawnProjectile } from '../runtime/spawnProjectile.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { selectBestProjectileTarget } from './targetSelection.ts'
import { TARGET_STRATEGY } from '../content/weapons/weaponDefinition.ts'
import {
  DAMAGE_PRIMARY_SCOPE,
  LOCAL_DAMAGE_SHAPE,
} from '../glyph/localDamage.ts'
import { spawnFlameEmitter } from '../runtime/spawnFlameEmitter.ts'
import type { ResolvedConeWeaponProfile } from './resolveWeaponProfile.ts'
import { getNextDamageEventId } from '../runtime/worldState.ts'
import { getCenteredEmissionAngleOffset } from './attackEmissionAngles.ts'

function rotateDirectionX(
  directionX: number,
  directionY: number,
  cosine: number,
  sine: number,
): number {
  return directionX * cosine - directionY * sine
}

function rotateDirectionY(
  directionX: number,
  directionY: number,
  cosine: number,
  sine: number,
): number {
  return directionX * sine + directionY * cosine
}

function emitConeAttack(
  world: WorldState,
  weaponId: number,
  attackSequence: number,
  profile: ResolvedConeWeaponProfile,
): void {
  const { player } = world
  for (
    let streamIndex = 0;
    streamIndex < profile.attackPattern.emissionCount;
    streamIndex += 1
  ) {
    const angleOffset = getCenteredEmissionAngleOffset(
      streamIndex,
      profile.attackPattern.emissionCount,
      profile.attackPattern.emissionAngleSpacingRadians,
    )
    const cosine = Math.cos(angleOffset)
    const sine = Math.sin(angleOffset)
    const directionX = rotateDirectionX(
      player.aimX,
      player.aimY,
      cosine,
      sine,
    )
    const directionY = rotateDirectionY(
      player.aimX,
      player.aimY,
      cosine,
      sine,
    )
    const originX =
      player.x + directionX * profile.attackPattern.muzzleDistance
    const originY =
      player.y + directionY * profile.attackPattern.muzzleDistance
    world.glyphDamageQueue.enqueue({
      attackEventId: getNextDamageEventId(world),
      primaryScope: DAMAGE_PRIMARY_SCOPE.ALL_INTERSECTING_OWNERS,
      shapeKind: LOCAL_DAMAGE_SHAPE.CONE,
      shapeX: originX,
      shapeY: originY,
      shapeRadius: 0,
      shapeDirectionX: directionX,
      shapeDirectionY: directionY,
      shapeRange: profile.damageShape.range,
      shapeHalfAngleRadians: profile.damageShape.fullAngleRadians / 2,
      targetMode: profile.damageShape.targetMode,
      amount: profile.damageAmount,
      damageSpreadProfile: profile.damageSpreadProfile,
      impactStrengthMultiplier: profile.impactStrengthMultiplier,
      impactDirectionX: directionX,
      impactDirectionY: directionY,
    })
    world.diagnostics.attackEmissionCount += 1
    spawnFlameEmitter(
      world,
      weaponId,
      attackSequence,
      streamIndex,
      originX,
      originY,
      directionX,
      directionY,
      profile,
    )
  }
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
      target.trackingLoad += attackPattern.emissionCount
    }

    for (
      let emissionIndex = 0;
      emissionIndex < attackPattern.emissionCount;
      emissionIndex += 1
    ) {
      const angleOffset = getCenteredEmissionAngleOffset(
        emissionIndex,
        attackPattern.emissionCount,
        attackPattern.emissionAngleSpacingRadians,
      )
      const cosine = Math.cos(angleOffset)
      const sine = Math.sin(angleOffset)
      const directionX = rotateDirectionX(
        player.aimX,
        player.aimY,
        cosine,
        sine,
      )
      const directionY = rotateDirectionY(
        player.aimX,
        player.aimY,
        cosine,
        sine,
      )
      spawnProjectile(world, {
        sourceWeaponInstanceId: weapon.id,
        x: player.x + directionX * attackPattern.muzzleDistance,
        y: player.y + directionY * attackPattern.muzzleDistance,
        directionX,
        directionY,
        profile,
        targetEnemyId: target?.id ?? null,
      })
    }
    weapon.attackSequence += 1
  }
}
