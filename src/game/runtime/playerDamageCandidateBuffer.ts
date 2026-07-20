import type { WorldState } from './worldState.ts'

/** Opens the one shared incoming-damage collection boundary for a fixed step. */
export function beginPlayerDamageCandidateCollection(world: WorldState): void {
  world.playerDamageCandidateCount = 0
}
