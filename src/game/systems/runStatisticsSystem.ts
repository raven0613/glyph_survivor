import { advanceEquippedWeaponTime } from '../runtime/runStatistics.ts'
import type { WorldState } from '../runtime/worldState.ts'

export function runStatisticsSystem(
  world: WorldState,
  deltaMs: number,
): void {
  advanceEquippedWeaponTime(
    world.runStatistics,
    world.weaponLoadout,
    deltaMs,
  )
}
