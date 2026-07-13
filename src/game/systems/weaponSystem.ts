import { spawnProjectile } from '../runtime/spawnProjectile.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { selectBestProjectileTarget } from './targetSelection.ts'

export function runWeaponSystem(world: WorldState, deltaMs: number): void {
  for (const weapon of world.weaponLoadout.equipped) {
    weapon.cooldownRemainingMs -= deltaMs

    if (weapon.cooldownRemainingMs > 0) {
      continue
    }

    const profile = weapon.resolvedProfile
    const player = world.player
    const trackingProfile = profile.trackingProfile
    const attackPattern = profile.attackPattern
    weapon.cooldownRemainingMs += profile.fireIntervalMs
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
