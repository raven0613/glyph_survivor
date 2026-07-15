import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import { resolvePlayerDamageStep } from '../runtime/playerSurvival.ts'
import { recordPlayerSurvivalPresentation } from '../runtime/playerSurvivalPresentation.ts'
import type { WorldState } from '../runtime/worldState.ts'

export function runPlayerSurvivalSystem(world: WorldState): boolean {
  resolvePlayerDamageStep(
    world.player.survival,
    world.playerDamageCandidates,
    world.playerDamageCandidateCount,
    world.runTimeMs,
    GAME_CONFIG,
    world.playerDamageStepOutcome,
  )
  recordPlayerSurvivalPresentation(
    world.player.survivalPresentation,
    world.player.survival,
    world.playerDamageStepOutcome,
    world.runTimeMs,
  )
  return world.playerDamageStepOutcome.playerDied
}
