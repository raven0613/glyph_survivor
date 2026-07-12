import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import { spawnProjectile, type WorldState } from '../runtime/worldState.ts'
import { ASSISTED_PROJECTILE_TRACKING } from '../content/weapons/projectileTracking.ts'
import { selectBestProjectileTarget } from './targetSelection.ts'

const PROJECTILE_MUZZLE_DISTANCE = 22

export function runWeaponSystem(world: WorldState, deltaMs: number): void {
  world.weaponCooldownMs -= deltaMs

  if (world.weaponCooldownMs > 0) {
    return
  }

  world.weaponCooldownMs += GAME_CONFIG.weaponCooldownMs
  const player = world.player
  const trackingProfile = ASSISTED_PROJECTILE_TRACKING
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

  if (target) {
    target.trackingLoad += 1
  }

  spawnProjectile(
    world,
    player.x + player.aimX * PROJECTILE_MUZZLE_DISTANCE,
    player.y + player.aimY * PROJECTILE_MUZZLE_DISTANCE,
    player.aimX,
    player.aimY,
    trackingProfile,
    target?.id ?? null,
  )
}
