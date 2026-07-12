import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import { spawnProjectile, type WorldState } from '../runtime/worldState.ts'

const PROJECTILE_MUZZLE_DISTANCE = 22

export function runWeaponSystem(world: WorldState, deltaMs: number): void {
  world.weaponCooldownMs -= deltaMs

  if (world.weaponCooldownMs > 0) {
    return
  }

  world.weaponCooldownMs += GAME_CONFIG.weaponCooldownMs
  const player = world.player
  spawnProjectile(
    world,
    player.x + player.aimX * PROJECTILE_MUZZLE_DISTANCE,
    player.y + player.aimY * PROJECTILE_MUZZLE_DISTANCE,
    player.aimX,
    player.aimY,
  )
}
