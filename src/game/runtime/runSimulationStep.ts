import { runCleanupSystem } from '../systems/cleanupSystem.ts'
import { runAimSystem } from '../systems/aimSystem.ts'
import { runCollisionSystem } from '../systems/collisionSystem.ts'
import { runDamageSystem } from '../systems/damageSystem.ts'
import { runDeathSystem } from '../systems/deathSystem.ts'
import { runDirectorSystem } from '../systems/directorSystem.ts'
import { runDropSystem } from '../systems/dropSystem.ts'
import { runEnemySpatialIndexSystem } from '../systems/enemySpatialIndexSystem.ts'
import { runMovementSystem } from '../systems/movementSystem.ts'
import { runProjectileSystem } from '../systems/projectileSystem.ts'
import {
  prepareProjectileTargetingSystem,
  runProjectileTargetingSystem,
} from '../systems/projectileTargetingSystem.ts'
import { runWeaponSystem } from '../systems/weaponSystem.ts'
import { runFlamePresentationSystem } from '../systems/flamePresentationSystem.ts'
import { runUpgradeSystem } from '../systems/upgradeSystem.ts'
import { runBossSpawnSystem } from '../systems/bossSpawnSystem.ts'
import { runGlyphMaterialSystem } from '../systems/glyphMaterialSystem.ts'
import { runGlyphDiagnosticsSystem } from '../systems/glyphDiagnosticsSystem.ts'
import { runSlimeSplitSystem } from '../systems/slimeSplitSystem.ts'
import { runOrbitWeaponSystem } from '../systems/orbitWeaponSystem.ts'
import { runPlayerContactSystem } from '../systems/playerContactSystem.ts'
import { runPlayerSurvivalSystem } from '../systems/playerSurvivalSystem.ts'
import { runPendingDamageTransferSystem } from '../systems/pendingDamageTransferSystem.ts'
import { runStatisticsSystem } from '../systems/runStatisticsSystem.ts'
import { runModifierPresentationSystem } from '../systems/modifierPresentationSystem.ts'
import { runDisconnectedTopologySystem } from '../systems/disconnectedTopologySystem.ts'
import { runVolatileReactionSystem } from '../systems/volatileReactionSystem.ts'
import { runBossModifierRewardSystem } from '../systems/bossModifierRewardSystem.ts'
import { finalizeRunResult } from './runResult.ts'
import { beginWorldDeathReview } from './runDeathReviewStep.ts'
import type { WorldState } from './worldState.ts'

export const SIMULATION_STEP_RESULT = Object.freeze({
  CONTINUE: 'CONTINUE',
  MODIFIER_REWARD_OFFERED: 'MODIFIER_REWARD_OFFERED',
  UPGRADE_OFFERED: 'UPGRADE_OFFERED',
  PLAYER_DIED: 'PLAYER_DIED',
} as const)

export type SimulationStepResult =
  (typeof SIMULATION_STEP_RESULT)[keyof typeof SIMULATION_STEP_RESULT]

export function runSimulationStep(
  world: WorldState,
  deltaMs: number,
): SimulationStepResult {
  world.runTimeMs += deltaMs
  runStatisticsSystem(world, deltaMs)
  world.diagnostics.simulationStepCount += 1
  runAimSystem(world)
  runMovementSystem(world, deltaMs)
  runGlyphMaterialSystem(world, deltaMs)
  runModifierPresentationSystem(world, deltaMs)
  runEnemySpatialIndexSystem(world)
  runDirectorSystem(world, deltaMs)
  runBossSpawnSystem(world)
  prepareProjectileTargetingSystem(world)
  runFlamePresentationSystem(world, deltaMs)
  runWeaponSystem(world, deltaMs)
  runOrbitWeaponSystem(world, deltaMs)
  runProjectileTargetingSystem(world, deltaMs)
  runProjectileSystem(world, deltaMs)
  runCollisionSystem(world)
  runPendingDamageTransferSystem(world, deltaMs)
  runDamageSystem(world)
  runVolatileReactionSystem(world, deltaMs)
  runSlimeSplitSystem(world)
  runDisconnectedTopologySystem(world)
  runDeathSystem(world, deltaMs)
  runPlayerContactSystem(world)
  if (runPlayerSurvivalSystem(world)) {
    finalizeRunResult(world)
    beginWorldDeathReview(world)
    runGlyphDiagnosticsSystem(world)
    return SIMULATION_STEP_RESULT.PLAYER_DIED
  }
  const modifierOfferCreated = runBossModifierRewardSystem(world) !== null
  runDropSystem(world)
  const upgradeOfferCreated = runUpgradeSystem(world)
  runCleanupSystem(world)
  runGlyphDiagnosticsSystem(world)
  if (modifierOfferCreated) {
    return SIMULATION_STEP_RESULT.MODIFIER_REWARD_OFFERED
  }
  return upgradeOfferCreated
    ? SIMULATION_STEP_RESULT.UPGRADE_OFFERED
    : SIMULATION_STEP_RESULT.CONTINUE
}
